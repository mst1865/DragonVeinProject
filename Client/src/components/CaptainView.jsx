import React, { useState, useEffect } from 'react';
import { Trophy, ShieldAlert, Swords, Crown, AlertCircle } from 'lucide-react';

// --- 排序权重常量 (保持不变) ---
const SUIT_ORDER = { '♠': 4, '♥': 3, '♣': 2, '♦': 1 };
const RANK_ORDER = {
  'RJ': 20, 'BJ': 19,
  'A': 14, 'K': 13, 'Q': 12, 'J': 11,
  '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
};

// 辅助：获取花色颜色
const getSuitColor = (suit) => (suit === '♥' || suit === '♦') ? 'text-red-500' : 'text-slate-800';

const CaptainView = ({ teamId, teamCards, onPlaySuccess,isCaptain }) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [tableState, setTableState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  

  // 1. 轮询获取实时战况
  const fetchTable = async () => {
    try {
      const res = await fetch('/api/game/table-state');
      if (res.ok) setTableState(await res.json());
    } catch (e) {}
  };

  useEffect(() => {
    fetchTable();
    const timer = setInterval(fetchTable, 2000); // 2秒刷新一次
    return () => clearInterval(timer);
  }, []);

  // 2. 排序手牌
  const sortedHand = [...teamCards].sort((a, b) => {
    const rankA = RANK_ORDER[a.rank] || 0;
    const rankB = RANK_ORDER[b.rank] || 0;
    if (rankA !== rankB) return rankB - rankA;
    return (SUIT_ORDER[b.suit] || 0) - (SUIT_ORDER[a.suit] || 0);
  });

  const sortedTableCards = React.useMemo(() => {
    if (!tableState?.lastCards) return [];
    return [...tableState.lastCards].sort((a, b) => {
        // 1. 比点数
        const rankA = RANK_ORDER[a.rank] || 0;
        const rankB = RANK_ORDER[b.rank] || 0;
        if (rankA !== rankB) return rankB - rankA; // 降序
        // 2. 比花色
        const suitA = SUIT_ORDER[a.suit] || 0;
        const suitB = SUIT_ORDER[b.suit] || 0;
        return suitB - suitA; // 降序
    });
  }, [tableState]);

  // 3. 选牌操作
  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setErrorMsg('');
  };

  // 4. 出牌操作
  const handlePlay = async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/game/play-cards', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ cardIds: selectedIds })
      });

      if (res.ok) {
        // ✅ 成功后：
        setSelectedIds([]); // 清空选择
        setErrorMsg('');
        fetchTable();       // 立即刷新战况
        if (onPlaySuccess) onPlaySuccess(); // 刷新手牌
        alert("⚔️ 压制成功！当前战场由我方接管！");
      } else {
        const msg = await res.text();
        setErrorMsg(msg.replace(/"/g, ''));
      }
    } catch (e) {
      setErrorMsg("网络错误");
    } finally {
      setLoading(false);
    }
  };

  // --- 状态判断 ---
  // 当前是谁的牌？
  const currentOwnerId = tableState?.lastTeamId || 0;
  const isMyTable = currentOwnerId === teamId;
  const isEmptyTable = currentOwnerId === 0;

  return (
    <div className="flex flex-col h-full pb-32"> {/* pb-32 防止底部导航遮挡 */}
      
      {/* === 上半部分：实时战况 (战场) === */}
      <div className={`
        flex-1 rounded-xl border-2 p-4 mb-4 relative overflow-hidden flex flex-col items-center justify-center transition-all duration-500
        ${isMyTable 
            ? 'bg-yellow-900/30 border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.2)]' 
            : isEmptyTable 
                ? 'bg-slate-800 border-slate-700 border-dashed'
                : 'bg-red-900/20 border-red-500/50'
        }
      `}>
        {/* 状态标签 */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-center">
            <div className="text-xs font-mono font-bold flex items-center gap-2">
                {isMyTable && <><Crown size={14} className="text-yellow-400"/> <span className="text-yellow-400">我方获胜占领中</span></>}
                {!isMyTable && !isEmptyTable && <><Swords size={14} className="text-red-400"/> <span className="text-red-400">敌方占据 - 需压制</span></>}
                {isEmptyTable && <span className="text-slate-400">战场空闲 - 等待首发</span>}
            </div>
        </div>

        {/* 牌面展示区 */}
        {tableState?.lastCards?.length > 0 ? (
          <div className="text-center animate-fade-in-up w-full">
            {/* 队伍名称 */}
            <div className={`text-lg font-black mb-4 ${isMyTable ? 'text-yellow-400' : 'text-red-400'}`}>
                {isMyTable ? '👑 我们是冠军' : `⛔ ${tableState.lastTeamName} 领先`}
            </div>

            {/* 具体的牌 */}
            <div className="flex justify-center flex-wrap gap-1 px-4">
               {sortedTableCards.map((c, i) => (
                <div 
                    key={i} 
                    className={`
                        bg-slate-100 w-12 h-16 rounded shadow-lg flex items-center justify-center border border-slate-300 
                        transform hover:scale-110 transition-transform
                        ${c.isWildGenerated ? 'ring-2 ring-yellow-400 bg-yellow-50' : ''} /* 给通配牌加点特效 */
                    `}
                >
                    <span className={`text-xl font-bold ${getSuitColor(c.suit)}`}>
                        {c.suit}{c.rank}
                    </span>
                </div>
              ))}
            </div>
            
            {/* 牌型提示 (可选，如果有牌型数据的话) */}
            {/* <div className="mt-2 text-xs text-white/40">炸弹 (4张)</div> */}
          </div>
        ) : (
          <div className="text-slate-500 text-sm flex flex-col items-center">
              <ShieldAlert className="mb-2 opacity-20" size={40}/>
              <div>暂无出牌记录</div>
              <div className="text-xs opacity-50">请打出第一手牌</div>
          </div>
        )}
      </div>

      {/* === 下半部分：手牌操作区 === */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-xl">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm text-yellow-500 font-bold">指挥官手牌 ({sortedHand.length})</h3>
            <span className="text-xs text-slate-400">已选: {selectedIds.length}</span>
        </div>

        {/* 堆叠手牌 */}
        <div className="flex flex-wrap content-start pl-2 pt-8 pb-4 min-h-[220px] max-h-[300px] overflow-y-auto">
           {sortedHand.length === 0 && <span className="text-slate-500 text-xs w-full text-center mt-10">弹药耗尽...</span>}
           
           {sortedHand.map((c, idx) => {
             const isSelected = selectedIds.includes(c.id);
             
             // 动态样式
             const isWild = c.isWildGenerated;
             const isRed = c.suit === '♥' || c.suit === '♦';
             const baseStyle = isWild 
                ? 'bg-gradient-to-br from-yellow-100 to-yellow-300 border-yellow-600 text-yellow-900' 
                : isRed ? 'bg-slate-100 border-red-300 text-red-600' : 'bg-slate-100 border-slate-300 text-slate-900';

             return (
               <div 
                 key={c.id}
                 onClick={() => toggleSelect(c.id)}
                 className={`
                    relative 
                    w-16 h-24  /* 牌尺寸 */
                    rounded-lg border shadow-md 
                    cursor-pointer transition-transform duration-200
                    flex flex-col
                    
                    /* 叠牌核心逻辑 */
                    -ml-10 mb-4 
                    /* 第一张牌不向左缩进 */
                    first:ml-0 
                    
                    /* 选中状态：上浮 */
                    ${isSelected ? '-translate-y-6 z-[100] ring-2 ring-yellow-500 shadow-xl' : 'hover:-translate-y-2'}
                    ${baseStyle}
                 `}
                 // 必须按顺序层叠，保证左边的在底下，或者右边的压住左边(看你喜好)
                 // 这里 idx 越大 zIndex 越高 => 右边的压住左边的。
                 // 配合 -ml-10，每张牌露出左侧约 1.5rem (w-16是4rem, 4 - 2.5 = 1.5)
                 style={{ zIndex: isSelected ? 100 : idx }}
               >
                 {/* === 左侧信息条 (Stacking 可见区域) === */}
                 <div className="absolute top-1 left-1.5 leading-none text-center w-4 flex flex-col items-center">
                    <div className="text-base font-black font-mono tracking-tighter">{c.rank}</div>
                    <div className="text-sm mt-0.5">{c.suit}</div>
                 </div>
                 
                 {/* === 中间装饰 (被遮挡部分) === */}
                 <div className="flex-1 flex items-end justify-end p-1 opacity-20">
                    <span className="text-3xl">{c.suit}</span>
                 </div>

                 {/* 选中高亮遮罩 */}
                 {isSelected && <div className="absolute inset-0 bg-yellow-500/10 rounded-lg pointer-events-none"></div>}
               </div>
             )
           })}
        </div>

        {/* 操作区 */}
        <div className="mt-4 flex flex-col gap-3">
            {/* 错误提示 */}
            {errorMsg && (
                <div className="text-red-300 text-xs flex items-center justify-center bg-red-900/50 py-2 rounded border border-red-800 animate-pulse">
                    <AlertCircle size={14} className="mr-1"/> {errorMsg}
                </div>
            )}
            
            {/* 按钮状态逻辑 */}
            {isMyTable ? (
                // 如果是我方占领 -> 禁止出牌，显示“守擂中”
                <button disabled className="w-full py-3 rounded font-bold bg-yellow-600/50 text-yellow-100 cursor-not-allowed border border-yellow-600/50 flex items-center justify-center gap-2">
                    <Crown size={18}/> 我方守擂中...
                </button>
            ) : (
                // 如果是敌方/空 -> 允许出牌
                <button 
                    onClick={handlePlay}
                    disabled={selectedIds.length === 0 || loading}
                    className={`w-full py-3 rounded font-bold uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2
                        ${selectedIds.length > 0 
                            ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30' 
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
                    `}
                >
                    {loading ? '判定中...' : (isEmptyTable ? '🚀 抢占先机 (首发)' : '⚔️ 发起挑战 (压制)')}
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default CaptainView;