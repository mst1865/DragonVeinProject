import React, { useState, useEffect } from 'react';
import { getDistance } from './utils/geo';
import { useGeoLocation } from './utils/useGeoLocation';
import { LOCATIONS, INTRO_TEXT } from './data/gameConfig';
import LoginPage from './components/LoginPage';
import CaptainView from './components/CaptainView'; // ✅ 恢复引入
import CardModal from './components/CardModal';     // ✅ 恢复引入
import { Shield, MapPin, Navigation, User, Trophy } from 'lucide-react';

const App = () => {
  // --- 核心状态 ---
  const [user, setUser] = useState(null);
  const [stage, setStage] = useState('login'); // 'login' | 'intro' | 'team_reveal' | 'game'
  const { coords, error } = useGeoLocation(); // 实时防抖坐标
  
  // --- 游戏状态 (恢复的功能) ---
  const [activeTab, setActiveTab] = useState('checkin'); // 'checkin' | 'mycards' | 'captain'
  const [myCards, setMyCards] = useState([]);   // 个人卡库
  const [teamCards, setTeamCards] = useState([]); // 团队卡库 (队长用)
  const [newCard, setNewCard] = useState(null);   // 获得的卡牌弹窗

  // --- 1. 登录逻辑 (增加 isCaptain 随机分配) ---
  const handleLogin = async (loginData) => {
    // loginData 是 { id, name, teamId, isCaptain, token }
    
    const mockResponse = {
        user: { 
            id: loginData.id,       // 使用传入的 ID
            name: loginData.name,   // 使用传入的 name 字符串
            teamId: loginData.teamId, // 使用传入的 teamId
            teamName: "神机营", 
            teamDesc: "明朝三大营 (火器部队)", 
            isFirst: true 
        },
    };
    
    setUser(mockResponse.user);
    console.log("Current User State:", mockResponse.user);
    
    if (mockResponse.user.isFirst) {
      setStage('intro');
    } else {
      setStage('game');
    }
  };

  const finishIntro = () => setStage('team_reveal');

  // --- 2. 打卡与获得卡牌逻辑 ---
  const handleUnlock = (site) => {
    // 模拟抽卡逻辑
    const suits = ['♠', '♥', '♣', '♦'];
    const ranks = ['10', 'J', 'Q', 'K', 'A'];
    const randomSuit = suits[Math.floor(Math.random() * suits.length)];
    const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
    const card = { 
      id: Date.now().toString(), 
      suit: randomSuit, 
      rank: randomRank, 
      display: `${randomSuit}${randomRank}` 
    };

    // 更新状态
    setNewCard(card); // 弹窗
    setMyCards(prev => [...prev, card]);
    setTeamCards(prev => [...prev, card]);
  };

  const handleCaptainPlay = (ids) => {
    const newHand = teamCards.filter(c => !ids.includes(c.id));
    setTeamCards(newHand);
    alert(`队长指令：成功打出 ${ids.length} 张牌！`); // 简单提示，实际应调用API
  };

  // --- 渲染部分 ---
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-20">
      {/* 1. 登录页 */}
      {stage === 'login' && <LoginPage onLogin={handleLogin} />}

      {/* 2. 核心文案 (Intro) */}
      {stage === 'intro' && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-8 space-y-6 text-center animate-fade-in" onClick={finishIntro}>
          {INTRO_TEXT.map((line, i) => (
            <p key={i} className="text-lg font-serif text-yellow-500/90" style={{animationDelay: `${i*1.5}s`}}>{line}</p>
          ))}
          <p className="text-xs text-slate-500 mt-10 animate-pulse">点击屏幕 开启金陵折叠...</p>
        </div>
      )}

      {/* 3. 战队揭晓 */}
      {stage === 'team_reveal' && (
        <div className="fixed inset-0 z-50 bg-red-900/90 flex flex-col items-center justify-center p-8 text-center" onClick={() => setStage('game')}>
          <h2 className="text-2xl font-bold mb-4">系统已匹配您的基因...</h2>
          <div className="p-6 border-4 border-yellow-500 rounded-xl bg-black/50 mb-8 transform scale-125 transition-all">
             <Shield className="w-16 h-16 mx-auto text-yellow-500 mb-2"/>
             <h1 className="text-4xl font-bold text-white mb-2">{user.teamName}</h1>
             <p className="text-yellow-200">{user.teamDesc}</p>
             {user.isCaptain && <span className="inline-block mt-2 bg-yellow-600 px-2 py-1 rounded text-xs">👑 队长权限已授予</span>}
          </div>
          <button className="px-8 py-3 bg-yellow-600 rounded-full font-bold">接受任务</button>
        </div>
      )}

      {/* 4. 游戏主流程 (包含 Tab 切换) */}
      {stage === 'game' && (
        <>
          {/* 顶部栏 */}
          <div className="sticky top-0 z-10 bg-slate-800 p-4 border-b border-slate-700 shadow-md flex justify-between items-center">
            <div>
              <h1 className="font-bold text-yellow-500 flex items-center gap-2">
                <Shield size={18}/> {user.teamName}
              </h1>
              <p className="text-xs text-slate-400">
                特工: {user.name} {user.isCaptain ? '(队长)' : ''}
              </p>
            </div>
            <div className="text-right">
               <div className="text-xs text-slate-500">当前定位</div>
               <div className="font-mono text-xs text-green-400">
                 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
               </div>
            </div>
          </div>

          {/* 内容区域：根据 activeTab 切换 */}
          <div className="p-4">
            
            {/* Tab 1: 打卡地图 */}
            {activeTab === 'checkin' && (
              <div className="space-y-4">
                {LOCATIONS.map((site) => {
                  const dist = getDistance(coords.lat, coords.lng, site.lat, site.lng);
                  const isUnlockable = dist <= 30; // 30米判定

                  return (
                    <div key={site.id} className={`relative p-5 rounded-xl border-2 transition-all ${
                      isUnlockable 
                        ? 'bg-slate-800 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]' 
                        : 'bg-slate-800/50 border-slate-700 opacity-70'
                    }`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-lg text-white">{site.name}</h3>
                          <p className="text-sm text-slate-400">{site.sub}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-mono ${isUnlockable ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-400'}`}>
                          距 {Math.round(dist)}m
                        </span>
                      </div>
                      <button 
                        disabled={!isUnlockable}
                        className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${
                          isUnlockable 
                            ? 'bg-yellow-600 hover:bg-yellow-500 text-white animate-bounce-slight' 
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                        onClick={() => handleUnlock(site)}
                      >
                        {isUnlockable ? <><Navigation size={18}/> 激活裂缝节点</> : <><MapPin size={18}/> 信号微弱 - 请靠近</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab 2: 个人卡库 */}
            {activeTab === 'mycards' && (
              <div className="grid grid-cols-4 gap-2">
                {myCards.length === 0 && <p className="col-span-4 text-center text-slate-500 mt-10">暂无双代密码，请前往站点打卡获取。</p>}
                {myCards.map((c, idx) => (
                  <div key={`${c.id}-${idx}`} className={`aspect-[2/3] rounded-lg flex items-center justify-center font-bold text-xl bg-slate-200 ${(c.suit === '♥' || c.suit === '♦') ? 'text-red-600' : 'text-slate-900'}`}>
                    {c.display}
                  </div>
                ))}
              </div>
            )}

            {/* Tab 3: 队长控制台 */}
            {activeTab === 'captain' && (
              user.isCaptain 
                ? <CaptainView teamId={user.teamId} teamCards={teamCards} onPlayCards={handleCaptainPlay}/>
                : <div className="text-center mt-20 text-slate-500">⚠️ 权限不足<br/>仅队长可访问指挥台</div>
            )}
          </div>

          {/* 底部导航栏 (恢复) */}
          <div className="fixed bottom-0 w-full bg-slate-800 border-t border-slate-700 flex justify-around p-2 pb-4 z-20">
            <button 
              onClick={() => setActiveTab('checkin')} 
              className={`flex flex-col items-center ${activeTab === 'checkin' ? 'text-yellow-500' : 'text-slate-400'}`}
            >
              <Navigation className="w-6 h-6"/>
              <span className="text-[10px] mt-1">打卡</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('mycards')} 
              className={`flex flex-col items-center ${activeTab === 'mycards' ? 'text-yellow-500' : 'text-slate-400'}`}
            >
              <User className="w-6 h-6"/>
              <span className="text-[10px] mt-1">卡库</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('captain')} 
              className={`flex flex-col items-center ${activeTab === 'captain' ? 'text-yellow-500' : 'text-slate-400'}`}
            >
              <Trophy className="w-6 h-6"/>
              <span className="text-[10px] mt-1">队长</span>
            </button>
          </div>
        </>
      )}

      {/* 获得卡牌弹窗 */}
      <CardModal card={newCard} onClose={() => setNewCard(null)} />
    </div>
  );
};

export default App;