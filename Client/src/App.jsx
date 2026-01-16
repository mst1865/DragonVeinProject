import React, { useState, useEffect } from 'react';
import { MapPin, User, Shield, Trophy, Navigation, Gift, LogOut } from 'lucide-react';
import { MOCK_DB, TARGET_LOCATIONS } from './data/mockStore';
import { getDistance } from './utils/geo';
import LoginPage from './components/LoginPage';
import CardModal from './components/CardModal';
import CaptainView from './components/CaptainView';

const App = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('checkin');
  const [location, setLocation] = useState({ lat: 0, lng: 0 });
  const [msg, setMsg] = useState(null); 
  const [newCard, setNewCard] = useState(null); 
  const [myCards, setMyCards] = useState([]);
  const [teamCards, setTeamCards] = useState([]);
  const [sites, setSites] = useState(TARGET_LOCATIONS);

  useEffect(() => {
    if (!user) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.error("GPS Error", err), { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [user]);

  const showToast = (text) => { setMsg(text); setTimeout(() => setMsg(null), 3000); };

  const handleDrawCard = (siteId) => {
    // 真实项目中调用后端 API: POST /api/draw { lat, lng, siteId }
    const site = sites.find(s => s.id === siteId);
    const dist = getDistance(location.lat, location.lng, site.lat, site.lng);
    // 模拟逻辑
    if (dist > 50000) { /* return showToast("距离太远"); */ } 
    if (MOCK_DB.locationCards[siteId].length === 0) return showToast("被抢光了！");
    
    // ...其余逻辑同前，此处省略以节省空间，直接使用之前生成的完整逻辑即可...
    const card = MOCK_DB.locationCards[siteId].pop();
    if (!MOCK_DB.userClaims[user.id]) MOCK_DB.userClaims[user.id] = [];
    MOCK_DB.userClaims[user.id].push(siteId);
    MOCK_DB.teamHands[user.teamId].push(card);
    setNewCard(card);
    setMyCards(p => [...p, card]);
    setTeamCards(p => [...p, card]);
    setSites([...sites]);
  };

  const handleCaptainPlay = (ids) => {
    // 真实API: POST /api/play { cardIds }
    const newHand = teamCards.filter(c => !ids.includes(c.id));
    MOCK_DB.teamHands[user.teamId] = newHand;
    setTeamCards(newHand);
    showToast(`成功打出 ${ids.length} 张牌！`);
  };

  if (!user) return <LoginPage onLogin={setUser} />;

  return (
    <div className="bg-slate-900 min-h-screen text-slate-100 font-sans pb-20">
      <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700 sticky top-0 z-10">
        <div><h1 className="font-bold text-yellow-500">第 {user.teamId} 探险队</h1><p className="text-xs text-slate-400">{user.name}</p></div>
        <button onClick={() => setUser(null)}><LogOut className="text-slate-400"/></button>
      </div>
      
      <div className="p-4">
        {activeTab === 'checkin' && (
          <div className="space-y-4">
             <div className="bg-slate-800 p-2 rounded text-xs text-slate-500 border border-slate-700">调试坐标: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</div>
            {sites.map(site => {
              const dist = getDistance(location.lat, location.lng, site.lat, site.lng);
              const isClose = dist < 50; 
              return (
                <div key={site.id} className={`p-4 rounded-xl border-2 ${isClose ? 'bg-slate-800 border-yellow-500' : 'bg-slate-800 border-slate-700 opacity-80'}`}>
                  <div className="flex justify-between mb-2" onClick={() => { setLocation({lat:site.lat, lng:site.lng}); showToast("瞬移成功"); }}>
                    <h3 className="font-bold text-lg flex gap-2"><MapPin className={isClose?'text-green-400':'text-slate-500'}/> {site.name}</h3>
                    <span className="text-xs bg-slate-700 px-2 py-1 rounded">{Math.round(dist)}m</span>
                  </div>
                  <button onClick={() => handleDrawCard(site.id)} disabled={!isClose} className={`w-full py-2 rounded font-bold ${isClose ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-slate-500'}`}>{isClose ? '感应龙脉' : '未到达'}</button>
                </div>
              );
            })}
          </div>
        )}
        {activeTab === 'captain' && (user.isCaptain ? <CaptainView teamId={user.teamId} teamCards={teamCards} onPlayCards={handleCaptainPlay}/> : <div className="text-center mt-20 text-slate-500">仅队长可见</div>)}
        {activeTab === 'mycards' && <div className="grid grid-cols-4 gap-2">{myCards.map(c => <div key={c.id} className="bg-slate-200 text-black aspect-[2/3] flex items-center justify-center font-bold">{c.suit}{c.rank}</div>)}</div>}
      </div>

      <div className="fixed bottom-0 w-full bg-slate-800 border-t border-slate-700 flex justify-around p-2">
        <button onClick={()=>setActiveTab('checkin')} className={activeTab==='checkin'?'text-yellow-500':'text-slate-400'}><Navigation className="mx-auto w-6 h-6"/><span className="text-[10px]">打卡</span></button>
        <button onClick={()=>setActiveTab('mycards')} className={activeTab==='mycards'?'text-yellow-500':'text-slate-400'}><User className="mx-auto w-6 h-6"/><span className="text-[10px]">我的</span></button>
        <button onClick={()=>setActiveTab('captain')} className={activeTab==='captain'?'text-yellow-500':'text-slate-400'}><Trophy className="mx-auto w-6 h-6"/><span className="text-[10px]">队长</span></button>
      </div>
      {msg && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-6 py-3 rounded-full">{msg}</div>}
      <CardModal card={newCard} onClose={() => setNewCard(null)} />
    </div>
  );
};
export default App;