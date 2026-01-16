import React, { useState, useEffect } from 'react';
import { Trophy, Flame, AlertCircle } from 'lucide-react';

// 样式辅助：花色颜色
const getSuitColor = (suit) => (suit === '♥' || suit === '♦') ? 'text-red-500' : 'text-slate-800';

const CaptainView = ({ teamId, teamCards, onPlayCards }) => { // onPlayCards 暂时不用，组件内处理
  const [selectedIds, setSelectedIds] = useState([]);
  const [tableState, setTableState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 轮询牌桌状态 (每2秒)
  useEffect(() => {
    const fetchTable = async () => {
      try {
        const res = await fetch('/api/game/table-state');
        if (res.ok) setTableState(await res.json());
      } catch (e) {}
    };
    fetchTable();
    const timer = setInterval(fetchTable, 2000);
    return () => clearInterval(timer);
  }, []);

  // 切换选牌
  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setErrorMsg(''); // 清除错误
  };

  // 出牌动作
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
        // 出牌成功
        setSelectedIds([]);
        // 触发父组件刷新手牌 (需要 App.jsx 传递 refresh 函数，或者简单 window.location.reload 也可以，建议父组件传递)
        window.location.reload(); // 简单粗暴刷新，生产环境建议用回调
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

  // 排序手牌
  const sortedHand = [...teamCards].sort((a, b) => {
    // 简单排序逻辑，可以复用 App.jsx 里的
    return 0; 
  });

  return (
    <div className="flex flex-col h-full">
      {/* 上半部分：战场 (牌桌) */}
      <div className="flex-1 bg-green-900/30 rounded-xl border border-green-800 p-4 mb-4 relative overflow-hidden flex flex-col items-center justify-center">
        <div className="absolute top-2 left-2 text-xs text-green-400 font-mono flex items-center">
            <Flame size={12} className="mr-1"/> 实时战况
        </div>
        
        {tableState?.lastCards?.length > 0 ? (
          <div className="text-center animate-fade-in-up">
            <div className="text-yellow-400 text-sm font-bold mb-2">
               {tableState.lastTeamId === teamId ? '我方' : tableState.lastTeamName} 出牌:
            </div>
            <div className="flex justify-center gap-1">
               {tableState.lastCards.map(c => (
                 <div key={c.id} className="bg-slate-100 w-10 h-14 rounded shadow-lg flex items-center justify-center border border-slate-300">
                    <span className={`text-lg font-bold ${getSuitColor(c.suit)}`}>
                        {c.suit}{c.rank}
                    </span>
                 </div>
               ))}
            </div>
          </div>
        ) : (
          <div className="text-slate-500 text-sm">等待开局...</div>
        )}
      </div>

      {/* 下半部分：手牌操作区 */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm text-yellow-500 font-bold">请选择手牌</h3>
            <span className="text-xs text-slate-400">已选: {selectedIds.length}张</span>
        </div>

        {/* 堆叠手牌展示 */}
        <div className="flex flex-wrap justify-center pl-8 pt-2 min-h-[120px]">
           {teamCards.length === 0 && <span className="text-slate-500 text-xs">手牌已打光！</span>}
           {teamCards.map((c, idx) => {
             const isSelected = selectedIds.includes(c.id);
             return (
               <div 
                 key={c.id}
                 onClick={() => toggleSelect(c.id)}
                 className={`
                    relative w-14 h-20 rounded shadow-md border bg-slate-100 -ml-8 mb-2 cursor-pointer transition-transform duration-200
                    ${isSelected ? '-translate-y-6 z-50 ring-2 ring-yellow-500' : 'hover:-translate-y-2'}
                    ${getSuitColor(c.suit)}
                 `}
                 style={{ zIndex: isSelected ? 100 : idx }}
               >
                 <div className="absolute top-0.5 left-1 text-xs font-bold leading-none">
                    {c.rank}<br/>{c.suit}
                 </div>
                 {/* 选中标记 */}
                 {isSelected && <div className="absolute inset-0 bg-yellow-500/20 rounded"></div>}
               </div>
             )
           })}
        </div>

        {/* 操作栏 */}
        <div className="mt-4 flex flex-col gap-2">
            {errorMsg && (
                <div className="text-red-400 text-xs flex items-center justify-center bg-red-900/20 py-1 rounded">
                    <AlertCircle size={12} className="mr-1"/> {errorMsg}
                </div>
            )}
            
            <button 
                onClick={handlePlay}
                disabled={selectedIds.length === 0 || loading}
                className={`w-full py-3 rounded font-bold uppercase tracking-wider transition-all
                    ${selectedIds.length > 0 
                        ? 'bg-yellow-600 text-white shadow-[0_0_15px_rgba(234,179,8,0.4)] hover:bg-yellow-500' 
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
                `}
            >
                {loading ? '出牌中...' : '打出牌型'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default CaptainView;