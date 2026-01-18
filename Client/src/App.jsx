import React, { useState, useEffect, useRef } from 'react';
import { getDistance } from './utils/geo';
import { useGeoLocation } from './utils/useGeoLocation';
import { INTRO_TEXT } from './data/gameConfig';
import LoginPage from './components/LoginPage';
import AdminPage from './components/AdminPage';
import CaptainView from './components/CaptainView';
import CardModal from './components/CardModal';
import MapTab from './components/MapTab'; // 引入地图组件
import { Shield, MapPin, Navigation, User, Trophy, Loader2, Map,Sparkles, RefreshCw, Gift, Puzzle } from 'lucide-react'; // 确保引入了 Map 图标

// --- 辅助：卡牌排序权重 ---
const SUIT_ORDER = { '♠': 4, '♥': 3, '♣': 2, '♦': 1 };
const RANK_ORDER = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
// 增加枚举映射
const ItemType = { Wild: 0, Swap: 1, Fragment: 2, Gift: 3 };

const App = () => {
  // --- 核心状态 ---
  const [user, setUser] = useState(null);
  const [stage, setStage] = useState('loading');
  const [isAssigning, setIsAssigning] = useState(false);
  const { coords, error } = useGeoLocation();
  
  // --- 游戏状态 ---
  const [activeTab, setActiveTab] = useState('checkin');
  const [locations, setLocations] = useState([]);
  const [teamCards, setTeamCards] = useState([]);
  const [myItems, setMyItems] = useState([]); // 我的道具
  const [teams, setTeams] = useState([]);     // 用于调换牌选择目标队伍
  const [reward, setReward] = useState(null); // { type, data }
  const [allUsers, setAllUsers] = useState([]); // 全员位置数据
  // ... 弹窗状态
  const [showWildModal, setShowWildModal] = useState(null); // 存 itemId
  const [showSwapModal, setShowSwapModal] = useState(null); // 存 itemId

  const [isAdminMode, setIsAdminMode] = useState(window.location.pathname === '/admin');

  // 如果在 admin 模式，直接渲染 AdminPage
  if (isAdminMode) {
      return <AdminPage />;
  }

  // --- 1. 初始化 ---
  useEffect(() => {
    const initGame = async () => {
      const token = localStorage.getItem('token');
      if (!token) { setStage('login'); return; }
      try {
        const res = await fetch('/api/game/me', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          if (data.user.username === 'admin') {
              window.location.href = '/admin'; // 强制刷新跳转
              return;
          }
          setStage(data.user.teamId ? 'game' : 'intro');
        } else {
          localStorage.removeItem('token');
          setStage('login');
        }
      } catch (err) { setStage('login'); }
    };
    initGame();
  }, []);
  // 监听 Tab 切换，进入卡库时自动刷新数据 ---
  useEffect(() => {
    // 只有在游戏进行中，且当前 Tab 是 'mycards' 时才执行
    if (stage === 'game' && activeTab === 'mycards') {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const refreshCardData = async () => {
        try {
          // 并行请求：同时拉取 团队卡牌、我的道具、队伍列表
          // Promise.all 能加快加载速度
          const [cardsRes, itemsRes] = await Promise.all([
            fetch('/api/game/team-cards', { headers }),
            fetch('/api/game/my-items', { headers })
          ]);

          if (cardsRes.ok) setTeamCards(await cardsRes.json());
          if (itemsRes.ok) setMyItems(await itemsRes.json());
          
          // 如果您实现了 fetchTeams (获取队伍列表用于调换牌)，也可以在这里调用
          // fetchTeams(); 

        } catch (err) {
          console.error("刷新卡库数据失败", err);
        }
      };

      refreshCardData();
    }
  }, [activeTab, stage]);

  // --- 2. 加载数据 & 位置同步心跳 ---
  useEffect(() => {
    if (stage === 'game') {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // 加载基础数据
      const fetchData = async () => {
        try {
          const [locRes, cardRes] = await Promise.all([
            fetch('/api/game/locations'),
            fetch('/api/game/team-cards', { headers })
          ]);
          if (locRes.ok) setLocations(await locRes.json());
          if (cardRes.ok) setTeamCards(await cardRes.json());
        } catch (e) { console.error(e); }
      };
      fetchData();

      fetchMyItems(); 
      fetchTeams(); // 获取所有队伍列表(用于调换牌)

      // 位置同步循环 (每5秒)
      const syncLocation = async () => {
        if (!coords.lat) return;
        try {
          // 上传自己
          await fetch('/api/game/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ lat: coords.lat, lng: coords.lng })
          });
          // 拉取全员
          const res = await fetch('/api/game/locations/all', { headers });
          if (res.ok) setAllUsers(await res.json());
        } catch (e) { console.error("Location sync error", e); }
      };
      
      syncLocation(); // 立即执行一次
      const timer = setInterval(syncLocation, 5000);
      return () => clearInterval(timer);
    }
  }, [stage, coords.lat]); // 依赖 coords.lat 确保获取到位置后才开始上传

  const fetchMyItems = async () => {
    const res = await fetch('/api/game/my-items', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
    if(res.ok) setMyItems(await res.json());
  };
  // 抽卡处理 (结果可能是牌也可能是道具)
  const handleUnlock = async (site) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/game/draw', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ locationId: site.id })
      });

      if (res.ok) {
        const body = await res.json();
        const { type, data, card, item } = body.result; 

        // --- 逻辑分支 ---
        if (type === 'card') {
          // 抽到普通卡
          setTeamCards(prev => [...prev, data]);
          setReward({ type: 'card', data: data }); // 🎁 触发弹窗
        } 
        else if (type === 'item') {
          // 抽到道具
          setMyItems(prev => [...prev, data]);
          setReward({ type: 'item', data: data }); // 🎁 触发弹窗
        } 
        else if (type === 'fragment_bonus') {
          // 碎片刚好集齐触发奖励
          // 这里我们优先展示获得的“线索卡”，因为那个价值更高
          // 或者你可以设计一个通过 CardModal 连续展示的逻辑，这里简化为展示线索卡
          setTeamCards(prev => [...prev, card]);
          setMyItems(prev => [...prev, item]); // 碎片也要加进去显示一下

          // 稍微 hack 一下，让它显示“碎片集齐奖励”
          const bonusDisplay = { ...card, isWildGenerated: true }; //借用金卡特效
          setReward({ type: 'card', data: bonusDisplay }); 

          // 也可以选择先弹碎片，关掉后再弹卡，比较复杂，暂不展开
        }

      } else {
        alert((await res.text()).replace(/"/g, ''));
      }
    } catch (err) {
      alert("网络错误");
    }
  };



  // --- 道具操作 ---

  // 专门用于刷新团队手牌的方法
  const refreshTeamCards = async () => {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch('/api/game/team-cards', { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        if (res.ok) {
            setTeamCards(await res.json());
        }
    } catch (e) {
        console.error("刷新手牌失败", e);
    }
  };


  // --- 1. 获取其他战队列表 (用于调换牌) ---
  const fetchTeams = async () => {
    // 临时模拟数据，或者调用真实接口 /api/game/teams
    // 这里假设只有5个固定队伍
    const allTeams = [
        {id: 1, name: '南镇抚司'}, {id: 2, name: '神机营'}, {id: 3, name: '督察院'}, 
        {id: 4, name: '军统局'}, {id: 5, name: '中华民族复兴社'}
    ];
    // 过滤掉自己所在的队伍
    setTeams(allTeams.filter(t => t.id !== user.teamId));
  };

  // --- 2. 使用通配牌逻辑 ---
  const handleUseWild = async (suit, rank) => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch('/api/game/use-wild', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ itemId: showWildModal, suit, rank })
        });
        if (res.ok) {
            const data = await res.json();
            setTeamCards(prev => [...prev, data.card]); // 立即更新显示
            setMyItems(prev => prev.filter(i => i.id !== showWildModal)); // 移除已用道具
            setShowWildModal(null); // 关闭弹窗
            alert("✨ 变形成功！线索卡已加入团队库。");
        } else {
            alert(await res.text());
        }
      } catch (e) { alert("网络错误"); }
  };

  // --- 3. 使用调换牌逻辑 ---
  const handleUseSwap = async (myCardId, targetTeamId) => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch('/api/game/use-swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ itemId: showSwapModal, myCardId, targetTeamId })
        });
        if (res.ok) {
            const data = await res.json();
            alert(data.message); // 显示 "失去了... 夺取了..."
            setMyItems(prev => prev.filter(i => i.id !== showSwapModal)); // 移除已用道具
            setShowSwapModal(null); // 关闭弹窗
            // 重新刷新手牌（因为有一张被换走了）
            const cRes = await fetch('/api/game/team-cards', { headers: { 'Authorization': `Bearer ${token}` }});
            if(cRes.ok) setTeamCards(await cRes.json());
        } else {
            alert((await res.text()).replace(/"/g, ''));
        }
      } catch (e) { alert("网络错误"); }
  };


  // --- 3. 业务逻辑 (保持不变) ---
  const handleLogin = async (loginData) => {
    try {
      const res = await fetch('/api/game/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: String(loginData.id), realName: String(loginData.name) })
      });
      if (!res.ok) { alert(await res.text()); return; }
      const data = await res.json();
      localStorage.setItem('token', data.token);
      setUser(data.user);
      if (data.user.username === 'admin') {
          window.location.href = '/admin'; // 强制刷新跳转
          return;
      }

      setStage(data.user.teamId ? 'game' : 'intro');
    } catch (err) { alert(`网络错误${err}`); }
  };

  const handleAssignTeam = async () => {
    if (isAssigning) return;
    setIsAssigning(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/game/assign-team', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(prev => ({ ...prev, ...data }));
        setStage('team_reveal');
      } else { alert("匹配失败"); }
    } catch (err) { alert("网络错误"); }
    finally { setIsAssigning(false); }
  };

  const sortedCards = [...teamCards].sort((a, b) => {
      // 第一步：比较点数 (从大到小)
      // 获取权重，如果没有定义(防止报错)则默认为0
      const rankA = RANK_ORDER[a.rank] || 0;
      const rankB = RANK_ORDER[b.rank] || 0;
      if (rankA !== rankB) {
          return rankB - rankA; // B - A 表示降序 (大的在前)
      }
      // 第二步：如果点数相同，比较花色 (从大到小)
      const suitA = SUIT_ORDER[a.suit] || 0;
      const suitB = SUIT_ORDER[b.suit] || 0;
      return suitB - suitA;
  });

  // --- 渲染 ---
  if (stage === 'loading') return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-yellow-500"><Loader2 className="w-10 h-10 animate-spin"/><span className="ml-3">正在连接矩阵...</span></div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      {stage === 'login' && <LoginPage onLogin={handleLogin} />}
      
      {stage === 'intro' && (
        <div onClick={handleAssignTeam} className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-8 space-y-6 text-center animate-fade-in cursor-pointer">
          {INTRO_TEXT.map((line,i)=><p key={i} className="text-lg font-serif text-yellow-500/90">{line}</p>)}
          <p className="mt-10 text-xs text-slate-500 animate-pulse">{isAssigning ? '匹配中...' : '点击屏幕 开启金陵折叠...'}</p>
        </div>
      )}

      {stage === 'team_reveal' && (
        <div onClick={()=>setStage('game')} className="fixed inset-0 z-50 bg-red-900/90 flex flex-col items-center justify-center p-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">{user?.teamName}</h1>
          <p className="text-yellow-200 mb-8">{user?.teamDesc}</p>
          <button className="px-8 py-3 bg-yellow-600 rounded-full font-bold">接受任务</button>
        </div>
      )}

      {stage === 'game' && user && (
        <>
          <div className="sticky top-0 z-40 bg-slate-800 p-4 border-b border-slate-700 shadow-md flex justify-between items-center">
            <div>
              <h1 className="font-bold text-yellow-500 flex items-center gap-2"><Shield size={18}/> {user.teamName}</h1>
              <p className="text-xs text-slate-400">特工: {user.realName}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">信号塔距离</div>
              <div className="font-mono text-xs text-green-400">{locations.length > 0 ? '已连接' : '扫描中...'}</div>
            </div>
          </div>

          {/* 
            - 如果是 'map'，使用固定高度 calc(100vh-140px)，防止地图无限拉长。
            - 如果是 'checkin' 或其他，移除固定高度，使用 pb-32 增加底部留白，允许页面自然滚动。
          */}
          <div className={`p-4 ${activeTab === 'map' ? 'h-[calc(100vh-140px)] overflow-hidden' : 'pb-32 min-h-screen'}`}>
            
            {/* Tab 1: Map (天眼) */}
            {activeTab === 'map' && (
               <div className="w-full h-full border-2 border-slate-700 rounded-xl bg-slate-800 relative z-0">
                 <MapTab locations={locations} users={allUsers} currentUser={user} />
               </div>
            )}

            {/* Tab 2: Checkin (列表) */}
            {activeTab === 'checkin' && (
              <div className="space-y-4">
                {locations.length === 0 ? <p className="text-center text-slate-500 mt-10">正在加载时空坐标...</p> : locations.map(site => {
                  const dist = getDistance(coords.lat, coords.lng, site.lat, site.lng);
                  const isUnlockable = dist <= site.radius;
                  return (
                    <div key={site.id} className={`relative p-5 rounded-xl border-2 transition-all ${isUnlockable?'bg-slate-800 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]':'bg-slate-800/50 border-slate-700 opacity-70'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div><h3 className="font-bold text-lg">{site.name}</h3><p className="text-sm text-slate-400">{site.sub}</p></div>
                        <span className={`px-2 py-1 rounded text-xs font-mono ${isUnlockable?'bg-green-900 text-green-300':'bg-slate-700 text-slate-400'}`}>距 {Math.round(dist)}m</span>
                      </div>
                      <button disabled={!isUnlockable} onClick={()=>handleUnlock(site)} className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${isUnlockable?'bg-yellow-600 hover:bg-yellow-500 text-white animate-bounce-slight':'bg-slate-700 text-slate-500'}`}>
                        {isUnlockable ? <><Navigation size={18}/> 激活节点</> : <><MapPin size={18}/> 信号微弱</>}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Tab 3: My Cards */}
            {activeTab === 'mycards' && (
                <div className="flex flex-col h-full overflow-y-auto pb-32">
                    
                    {/* --- 上半部分：团队资源 (修复了不显示的问题) --- */}
                    <div className="bg-slate-800 p-4 border-b border-slate-700 min-h-[300px]">
                        <h3 className="text-center text-yellow-500 text-sm mb-6">—— 战队公共资源 ({teamCards.length}) ——</h3>
                        
                        {teamCards.length === 0 && <p className="text-center text-slate-500 mt-10">暂无数据</p>}

                        {/* 叠牌容器 */}
                        <div className="flex flex-wrap justify-center pl-10 pt-2">
                            {/* 使用 sortedCards 进行渲染*/}
                            {sortedCards.map((c, idx) => {
                              // 判断是否是通配牌生成的
                              const isWild = c.isWildGenerated;
                              return(
                                <div 
                                    key={`${c.id}-${idx}`} 
                                    className={`
                                        relative w-16 h-24 rounded-lg shadow-2xl border-2 flex flex-col -ml-10 mb-4 
                                        transition-all duration-300 ease-out hover:-translate-y-6 hover:z-50 hover:scale-110 cursor-pointer
                                        ${(c.suit === '♥' || c.suit === '♦') ? 'bg-slate-100 border-red-200 text-red-600' : 'bg-slate-100 border-slate-300 text-slate-900'}
                                        ${/* 样式逻辑：如果是通配牌，用金色渐变 + 金色边框；否则用普通样式 */ ''}
                                        ${isWild 
                                            ? 'bg-gradient-to-br from-yellow-100 to-yellow-300 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.6)]' 
                                            : (c.suit === '♥' || c.suit === '♦') ? 'bg-slate-100 border-red-200 text-red-600 shadow-2xl' : 'bg-slate-100 border-slate-300 text-slate-900 shadow-2xl'
                                        }
                                        ${user.id === c.userId ? 'ring-2 ring-yellow-500 ring-offset-1 ring-offset-slate-900' : ''}
                                    `}
                                    style={{ zIndex: idx }}
                                >
                                    <div className="absolute top-1 left-1 leading-none text-center min-w-[1rem]">
                                        <div className="text-sm font-black font-mono">{c.rank}</div>
                                        <div className="text-sm">{c.suit}</div>
                                    </div>
                                    <div className="flex-1 flex items-center justify-center text-2xl opacity-20">
                                        {c.suit}
                                    </div>
                                    {user.id === c.userId && (
                                        <div className="absolute bottom-0 inset-x-0 bg-yellow-500/90 text-white text-[8px] text-center py-0.5 rounded-b-[4px]">
                                            MY
                                        </div>
                                    )}
                                </div>
                            )
})
                          }
                        </div>
                    </div>

                    {/* --- 下半部分：个人道具 (保持不变) --- */}
                    <div className="p-4 bg-slate-900 flex-1 min-h-[300px]">
                        <h3 className="text-center text-blue-400 text-sm mb-4">—— 个人道具包 ({myItems.length}) ——</h3>
                        
                        <div className="grid grid-cols-2 gap-3">
                            {myItems.map(item => (
                                <div key={item.id} className="bg-slate-800 border border-slate-600 rounded-lg p-3 flex flex-col justify-between relative overflow-hidden shadow-lg">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            {item.type === 0 && <Sparkles className="text-purple-400" size={16}/>}
                                            {item.type === 1 && <RefreshCw className="text-green-400" size={16}/>}
                                            {item.type === 2 && <Puzzle className="text-orange-400" size={16}/>}
                                            {item.type === 3 && <Gift className="text-red-400" size={16}/>}
                                            <span className="font-bold text-white text-sm">{item.name}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 mb-2 leading-relaxed">{item.description}</p>
                                    </div>

                                    {/* 操作按钮 */}
                                    {item.type === 0 && (
                                        <button onClick={() => setShowWildModal(item.id)} className="w-full py-1.5 bg-purple-700 hover:bg-purple-600 text-xs rounded text-white font-bold transition-colors">使用</button>
                                    )}
                                    {item.type === 1 && (
                                        <button onClick={() => setShowSwapModal(item.id)} className="w-full py-1.5 bg-green-700 hover:bg-green-600 text-xs rounded text-white font-bold transition-colors">发动</button>
                                    )}
                                    {item.type === 3 && (
                                        <button disabled className="w-full py-1.5 bg-slate-700 text-xs rounded text-slate-500 cursor-not-allowed border border-slate-600">联系管理员兑换</button>
                                    )}
                                    {item.type === 2 && (
                                        <div className="text-[10px] text-center text-orange-400 bg-orange-900/20 border border-orange-900/50 rounded py-1">
                                            自动积攒中
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {myItems.length === 0 && <p className="text-center text-slate-600 text-xs mt-10">暂无道具，请去站点搜寻...</p>}
                    </div>

                    {/* === 1. 通配牌弹窗 (Wild Modal) === */}
                    {showWildModal && (
                        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-fade-in">
                            <div className="bg-slate-800 p-6 rounded-xl w-full max-w-sm border border-slate-600 shadow-2xl">
                                <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                                    <Sparkles className="text-purple-400"/> 通配变形
                                </h3>
                                
                                {/* 临时状态：用于存储用户当前选中的花色和点数 */}
                                {/* 注意：为了简化，这里直接用 DOM 或者局部变量，最好拆分成子组件，但这里直接写在 App 里 */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-slate-400 block mb-2">选择花色</label>
                                        <div className="grid grid-cols-4 gap-2" id="wild-suits">
                                            {['♠','♥','♣','♦'].map(s => (
                                                <button key={s} onClick={(e) => {
                                                    // 简单的选中样式切换逻辑
                                                    document.querySelectorAll('#wild-suits button').forEach(b=>b.className='p-2 rounded bg-slate-700 text-2xl');
                                                    e.target.className='p-2 rounded bg-purple-600 text-white text-2xl ring-2 ring-purple-300';
                                                    e.target.dataset.selected = "true";
                                                }} data-value={s} className="p-2 rounded bg-slate-700 text-2xl transition-all">{s}</button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs text-slate-400 block mb-2">选择点数</label>
                                        <select id="wild-rank" className="w-full bg-slate-700 text-white p-3 rounded outline-none focus:ring-2 focus:ring-purple-500">
                                            {['A','2','3','4','5','6','7','8','9','10','J','Q','K'].map(r => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-8">
                                    <button onClick={() => setShowWildModal(null)} className="px-4 py-2 text-slate-400 font-bold">取消</button>
                                    <button onClick={() => {
                                        // 获取选中的值
                                        const suitBtn = document.querySelector('#wild-suits button[data-selected="true"]');
                                        const rankVal = document.getElementById('wild-rank').value;
                                        if(!suitBtn) return alert("请先选择花色！");
                                        handleUseWild(suitBtn.dataset.value, rankVal);
                                    }} className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded text-white font-bold shadow-lg">确认变形</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* === 2. 调换牌弹窗 (Swap Modal) === */}
                    {showSwapModal && (
                        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-fade-in">
                            <div className="bg-slate-800 p-6 rounded-xl w-full max-w-sm border border-slate-600 shadow-2xl">
                                <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                                    <RefreshCw className="text-green-400"/> 发动调换
                                </h3>
                                
                                {/* 确保打开弹窗时加载了队伍数据 */}
                                {/* 可以加一个 onEffect 或在 onClick 时调用 fetchTeams，这里假设 fetchTeams 已在 useEffect 中调用 */}
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-slate-400 block mb-2">1. 献祭一张己方手牌</label>
                                        <select id="swap-my-card" className="w-full bg-slate-700 text-white p-3 rounded border border-slate-600">
                                            {teamCards.length === 0 && <option disabled>我方无牌，无法发动</option>}
                                            {teamCards.map(c => (
                                                <option key={c.id} value={c.id}>{c.suit} {c.rank}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-400 block mb-2">2. 选择受害者战队</label>
                                        <select id="swap-target-team" className="w-full bg-slate-700 text-white p-3 rounded border border-slate-600" onClick={fetchTeams}>
                                            {teams.length === 0 && <option>正在加载战队列表...</option>}
                                            {teams.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-8">
                                    <button onClick={() => setShowSwapModal(null)} className="px-4 py-2 text-slate-400 font-bold">取消</button>
                                    <button onClick={() => {
                                        const cId = document.getElementById('swap-my-card').value;
                                        const tId = document.getElementById('swap-target-team').value;
                                        if(!cId) return alert("没有可献祭的牌");
                                        if(!tId) return alert("请选择目标");
                                        handleUseSwap(parseInt(cId), parseInt(tId));
                                    }} className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded text-white font-bold shadow-lg">确认调换</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tab 4: Captain */}
            {activeTab === 'captain' && (
                user.isCaptain 
                ? <CaptainView 
                      teamId={user.teamId} 
                      teamCards={teamCards} 
                      onPlaySuccess={refreshTeamCards} /* 重拉 */
                      isCaptain={user.isCaptain}
                  />
                : <div className="text-center mt-20 text-slate-500">⚠️ 权限不足<br/>仅队长可访问指挥台</div>
             )}
          </div>

          <div className="fixed bottom-0 w-full bg-slate-800 border-t border-slate-700 flex justify-around p-2 pb-4 z-50 shadow-lg">
             <button onClick={() => setActiveTab('checkin')} className={`flex flex-col items-center ${activeTab === 'checkin' ? 'text-yellow-500' : 'text-slate-400'}`}><Navigation className="w-6 h-6"/><span className="text-[10px] mt-1">列表</span></button>
             <button onClick={() => setActiveTab('map')} className={`flex flex-col items-center ${activeTab === 'map' ? 'text-yellow-500' : 'text-slate-400'}`}><Map className="w-6 h-6"/><span className="text-[10px] mt-1">天眼</span></button>
             <button onClick={() => setActiveTab('mycards')} className={`flex flex-col items-center ${activeTab === 'mycards' ? 'text-yellow-500' : 'text-slate-400'}`}><User className="w-6 h-6"/><span className="text-[10px] mt-1">卡库</span></button>
             <button onClick={() => setActiveTab('captain')} className={`flex flex-col items-center ${activeTab === 'captain' ? 'text-yellow-500' : 'text-slate-400'}`}><Trophy className="w-6 h-6"/><span className="text-[10px] mt-1">队长</span></button>
          </div>
        </>
      )}

      <CardModal reward={reward} onClose={() => setReward(null)} />
    </div>
  );
};

export default App;