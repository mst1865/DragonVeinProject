import React, { useState, useEffect } from 'react';
import { getDistance } from './utils/geo';
import { useGeoLocation } from './utils/useGeoLocation';
import { LOCATIONS, INTRO_TEXT } from './data/gameConfig';
import LoginPage from './components/LoginPage'; // 复用你的登录组件
import { Shield, MapPin, Navigation } from 'lucide-react';

const App = () => {
  const [user, setUser] = useState(null);
  const [stage, setStage] = useState('login'); // 'login' | 'intro' | 'team_reveal' | 'game'
  const { coords, error } = useGeoLocation(); // 实时防抖坐标
  
  // 模拟登录API调用
  const handleLogin = async (username) => {
    // 真实场景：调用 POST /api/game/login
    // 这里模拟返回数据
    const mockResponse = {
        user: { id: 1, name: username, teamId: 1, teamName: "神机营", teamDesc: "前端/移动端组 (火力输出)", isFirst: true },
        // isFirst: Math.random() > 0.5 // 模拟是否第一次
    };
    
    setUser(mockResponse.user);
    console.log("Current User State:", user);
    if (mockResponse.user.isFirst) {
      setStage('intro');
    } else {
      setStage('game');
    }
  };

  // 文案播放结束
  const finishIntro = () => setStage('team_reveal');

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      {/* 1. 登录页 */}
      {stage === 'login' && <LoginPage onLogin={handleLogin} />}

      {/* 2. 核心文案展示 (全屏遮罩) */}
      {stage === 'intro' && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-8 space-y-6 text-center animate-fade-in" onClick={finishIntro}>
          {INTRO_TEXT.map((line, i) => (
            <p key={i} className="text-lg font-serif text-yellow-500/90" style={{animationDelay: `${i*1.5}s`}}>{line}</p>
          ))}
          <p className="text-xs text-slate-500 mt-10 animate-pulse">点击屏幕 开启龙脉...</p>
        </div>
      )}

      {/* 3. 战队揭晓动画 */}
      {stage === 'team_reveal' && (
        <div className="fixed inset-0 z-50 bg-red-900/90 flex flex-col items-center justify-center p-8 text-center" onClick={() => setStage('game')}>
          <h2 className="text-2xl font-bold mb-4">系统已匹配您的基因...</h2>
          <div className="p-6 border-4 border-yellow-500 rounded-xl bg-black/50 mb-8 transform scale-125 transition-all">
             <Shield className="w-16 h-16 mx-auto text-yellow-500 mb-2"/>
             <h1 className="text-4xl font-bold text-white mb-2">{user.teamName}</h1>
             <p className="text-yellow-200">{user.teamDesc}</p>
          </div>
          <button className="px-8 py-3 bg-yellow-600 rounded-full font-bold">接受任务</button>
        </div>
      )}

      {/* 4. 游戏主界面 */}
      {stage === 'game' && (
        <div className="pb-20">
          {/* 顶部栏 */}
          <div className="sticky top-0 z-10 bg-slate-800 p-4 border-b border-slate-700 shadow-md flex justify-between items-center">
            <div>
              <h1 className="font-bold text-yellow-500 flex items-center gap-2">
                <Shield size={18}/> {user?.teamName}
              </h1>
              <p className="text-xs text-slate-400">特工: {user?.name}</p>
            </div>
            <div className="text-right">
               <div className="text-xs text-slate-500">当前定位</div>
               <div className="font-mono text-xs text-green-400">
                 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
               </div>
            </div>
          </div>

          {/* 站点列表 */}
          <div className="p-4 space-y-4">
            {LOCATIONS.map((site) => {
              // 计算距离
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
                    onClick={() => alert(`成功激活：${site.name}`)}
                  >
                    {isUnlockable ? <><Navigation size={18}/> 激活龙脉节点</> : <><MapPin size={18}/> 信号微弱 - 请靠近</>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;