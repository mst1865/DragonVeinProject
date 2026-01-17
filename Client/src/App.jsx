import React, { useState, useEffect, useRef } from 'react';
import { getDistance } from './utils/geo';
import { useGeoLocation } from './utils/useGeoLocation';
import { INTRO_TEXT } from './data/gameConfig';
import LoginPage from './components/LoginPage';
import CaptainView from './components/CaptainView';
import CardModal from './components/CardModal';
import MapTab from './components/MapTab'; // 引入地图组件
import { Shield, MapPin, Navigation, User, Trophy, Loader2, Map } from 'lucide-react'; // 确保引入了 Map 图标

// --- 辅助：卡牌排序权重 ---
const SUIT_ORDER = { '♠': 4, '♥': 3, '♣': 2, '♦': 1 };
const RANK_ORDER = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };

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
  const [newCard, setNewCard] = useState(null);
  const [allUsers, setAllUsers] = useState([]); // 全员位置数据

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
          setStage(data.user.teamId ? 'game' : 'intro');
        } else {
          localStorage.removeItem('token');
          setStage('login');
        }
      } catch (err) { setStage('login'); }
    };
    initGame();
  }, []);

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
      setStage(data.user.teamId ? 'game' : 'intro');
    } catch (err) { alert("网络错误"); }
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

  const handleUnlock = async (site) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/game/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ locationId: site.id })
      });

      if (res.ok) {
        const data = await res.json();
        setNewCard(data.card);
        setTeamCards(prev => [...prev, data.card]); 
        if (data.progress.isFirstBonus && data.progress.collected === 1) {
          alert("⚡ 触发时空奖励！首达战队额外+1卡槽！");
        }
      } else {
        alert((await res.text()).replace(/"/g, ''));
      }
    } catch (err) { alert("网络错误"); }
  };

  const handleCaptainPlay = (ids) => {
    const newHand = teamCards.filter(c => !ids.includes(c.id));
    setTeamCards(newHand);
    alert(`队长指令：打出 ${ids.length} 张牌！`);
  };

  const sortedCards = [...teamCards].sort((a, b) => {
    const suitDiff = SUIT_ORDER[b.suit] - SUIT_ORDER[a.suit];
    if (suitDiff !== 0) return suitDiff;
    return RANK_ORDER[b.rank] - RANK_ORDER[a.rank];
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
              <p className="text-xs text-slate-400">特工: {user.name || user.RealName}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">信号塔距离</div>
              <div className="font-mono text-xs text-green-400">{locations.length > 0 ? '已连接' : '扫描中...'}</div>
            </div>
          </div>

          {/* ✅ 关键修复：
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
              <div>
                <h3 className="text-center text-yellow-500 text-sm mb-6">—— 战队资源 ({sortedCards.length}张) ——</h3>
                {sortedCards.length === 0 && <p className="text-center text-slate-500 mt-10">暂无数据</p>}
                <div className="flex flex-wrap justify-center pl-10 pt-2">
                  {sortedCards.map((c, idx) => (
                    <div 
                      key={`${c.id}-${idx}`} 
                      className={`
                        relative w-16 h-24 rounded-lg shadow-2xl border-2 flex flex-col -ml-10 mb-4 
                        transition-all duration-300 ease-out hover:-translate-y-6 hover:z-50 hover:scale-110 cursor-pointer
                        ${(c.suit === '♥' || c.suit === '♦') ? 'bg-slate-100 border-red-200 text-red-600' : 'bg-slate-100 border-slate-300 text-slate-900'}
                        ${user.id === c.userId ? 'ring-2 ring-yellow-500 ring-offset-1 ring-offset-slate-900' : ''}
                      `}
                      style={{ zIndex: idx }}
                    >
                      <div className="absolute top-1 left-1 leading-none text-center min-w-[1rem]">
                        <div className="text-sm font-black font-mono">{c.rank}</div>
                        <div className="text-sm">{c.suit}</div>
                      </div>
                      <div className="flex-1 flex items-center justify-center text-2xl opacity-20">{c.suit}</div>
                      {user.id === c.userId && <div className="absolute bottom-0 inset-x-0 bg-yellow-500/90 text-white text-[8px] text-center py-0.5 rounded-b-[4px]">MY</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 4: Captain */}
            {activeTab === 'captain' && (
                user.isCaptain 
                ? <CaptainView teamId={user.teamId} teamCards={teamCards} onPlayCards={handleCaptainPlay}/>
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

      <CardModal card={newCard} onClose={() => setNewCard(null)} />
    </div>
  );
};

export default App;