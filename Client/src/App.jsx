import React, { useState, useEffect } from 'react';
import { getDistance } from './utils/geo';
import { useGeoLocation } from './utils/useGeoLocation';
import { INTRO_TEXT } from './data/gameConfig';
import LoginPage from './components/LoginPage';
import CaptainView from './components/CaptainView';
import CardModal from './components/CardModal';
import { Shield, MapPin, Navigation, User, Trophy, Loader2 } from 'lucide-react';
import { Map } from 'lucide-react'; // 引入地图图标
import MapTab from './components/MapTab'; // 引入新组件

// --- 辅助：卡牌排序权重 ---
const SUIT_ORDER = { '♠': 4, '♥': 3, '♣': 2, '♦': 1 };
const RANK_ORDER = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };

const App = () => {
  // --- 核心状态 ---
  const [user, setUser] = useState(null);
  const [stage, setStage] = useState('loading');
  const [isAssigning, setIsAssigning] = useState(false);
  const { coords, error } = useGeoLocation();
  const [allUsers, setAllUsers] = useState([]); // 全员位置数据
  // --- 游戏状态 ---
  const [activeTab, setActiveTab] = useState('checkin');
  const [locations, setLocations] = useState([]);
  const [teamCards, setTeamCards] = useState([]); 
  const [newCard, setNewCard] = useState(null);

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

  // --- 新增：位置同步心跳 ---
  useEffect(() => {
    if (stage !== 'game' || !user || !coords.lat) return;

    const syncLocation = async () => {
      const token = localStorage.getItem('token');
      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      };

      try {
        // 1. 上传自己位置
        await fetch('/api/game/location', {
          method: 'POST',
          headers,
          body: JSON.stringify({ lat: coords.lat, lng: coords.lng })
        });

        // 2. 拉取全员位置
        const res = await fetch('/api/game/locations/all', { headers });
        if (res.ok) {
          const usersData = await res.json();
          setAllUsers(usersData);
        }
      } catch (err) {
        console.error("Location sync failed", err);
      }
    };

    // 立即执行一次
    syncLocation();
    // 每 5 秒同步一次
    const timer = setInterval(syncLocation, 5000);

    return () => clearInterval(timer);
  }, [stage, user, coords.lat, coords.lng]); // 当位置变化或用户状态变化时生效

  // --- 2. 加载游戏数据 ---
  useEffect(() => {
    if (stage === 'game') {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const fetchLocations = async () => {
        try {
          const res = await fetch('/api/game/locations');
          if (res.ok) setLocations(await res.json());
        } catch (err) { console.error(err); }
      };

      const fetchTeamCards = async () => {
        try {
          const res = await fetch('/api/game/team-cards', { headers });
          if (res.ok) setTeamCards(await res.json());
        } catch (err) { console.error(err); }
      };

      fetchLocations();
      fetchTeamCards();
    }
  }, [stage]);

  // --- 3. 业务逻辑 ---
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

  // --- 4. 视图辅助 ---
  // 对手牌进行排序：先按花色，再按点数
  const sortedCards = [...teamCards].sort((a, b) => {
    const suitDiff = SUIT_ORDER[b.suit] - SUIT_ORDER[a.suit];
    if (suitDiff !== 0) return suitDiff;
    return RANK_ORDER[b.rank] - RANK_ORDER[a.rank];
  });

  // --- 渲染 ---
  if (stage === 'loading') return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-yellow-500"><Loader2 className="w-10 h-10 animate-spin"/><span className="ml-3">正在连接矩阵...</span></div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-20">
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
          <div className="sticky top-0 z-20 bg-slate-800 p-4 border-b border-slate-700 shadow-md flex justify-between items-center">
            <div>
              <h1 className="font-bold text-yellow-500 flex items-center gap-2"><Shield size={18}/> {user.teamName}</h1>
              <p className="text-xs text-slate-400">特工: {user.name || user.RealName}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">信号塔距离</div>
              <div className="font-mono text-xs text-green-400">{locations.length > 0 ? '已连接' : '扫描中...'}</div>
            </div>
          </div>

          <div className="p-4 h-[calc(100vh-140px)]"> {/* 调整高度以适配地图 */}
            {/* Tab 1: Map */}
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

            {/* ✅ Tab 1.5: 地图模式 (新增) */}
            {activeTab === 'map' && (
               <div className="w-full h-full border-2 border-slate-700 rounded-xl bg-slate-800">
                 {/* 传入 locations(任务点), allUsers(全员), user(自己) */}
                 <MapTab locations={locations} users={allUsers} currentUser={user} />
               </div>
            )}

            {/* Tab 2: Team Cards (叠牌效果) */}
            {activeTab === 'mycards' && (
              <div>
                <h3 className="text-center text-yellow-500 text-sm mb-6">—— 战队资源 ({sortedCards.length}张) ——</h3>
                
                {sortedCards.length === 0 && <p className="text-center text-slate-500 mt-10">暂无数据</p>}

                {/* 叠牌容器：pl-10 是为了给第一张牌留出位置，之后每张牌都用 -ml-12 往左盖 */}
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
                      style={{ zIndex: idx }} // 保证后面的压住前面的
                    >
                      {/* 左上角关键信息 */}
                      <div className="absolute top-1 left-1 leading-none text-center min-w-[1rem]">
                        <div className="text-sm font-black font-mono">{c.rank}</div>
                        <div className="text-sm">{c.suit}</div>
                      </div>

                      {/* 中间大花色 (被遮挡也没关系) */}
                      <div className="flex-1 flex items-center justify-center text-2xl opacity-20">
                        {c.suit}
                      </div>

                      {/* 属于我的牌标记 */}
                      {user.id === c.userId && (
                        <div className="absolute bottom-0 inset-x-0 bg-yellow-500/90 text-white text-[8px] text-center py-0.5 rounded-b-[4px]">
                          MY
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <p className="text-center text-xs text-slate-500 mt-8">
                  提示：卡牌已按花色点数自动整理
                </p>
              </div>
            )}

            {/* Tab 3: Captain */}
            {activeTab === 'captain' && (
               user.isCaptain 
                ? <CaptainView teamId={user.teamId} teamCards={teamCards} onPlayCards={handleCaptainPlay}/>
                : <div className="text-center mt-20 text-slate-500">⚠️ 权限不足<br/>仅队长可访问指挥台</div>
            )}
          </div>

          <div className="fixed bottom-0 w-full bg-slate-800 border-t border-slate-700 flex justify-around p-2 pb-4 z-30 shadow-lg">
             <button onClick={() => setActiveTab('checkin')} className={`flex flex-col items-center ${activeTab === 'checkin' ? 'text-yellow-500' : 'text-slate-400'}`}><Navigation className="w-6 h-6"/><span className="text-[10px] mt-1">打卡</span></button>
             <button onClick={() => setActiveTab('map')} className={`flex flex-col items-center ${activeTab === 'map' ? 'text-yellow-500' : 'text-slate-400'}`}>
                <Map className="w-6 h-6"/><span className="text-[10px] mt-1">天眼</span>
             </button>
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