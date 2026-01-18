import React, { useState, useEffect } from 'react';
import { Users, Crown, Wifi, WifiOff, QrCode } from 'lucide-react';

const AdminPage = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);

  // 获取当前部署的网址，用于生成二维码
  const appUrl = window.location.origin; 
  // 使用第三方API生成二维码图片 (或者引入 qrcode.react 库)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(appUrl)}`;

  const fetchDashboard = async () => {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch('/api/game/admin/dashboard', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
      if (res.ok) {
        setTeams(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 设为队长
  const handleSetCaptain = async (userId, userName) => {
    if (!confirm(`确定要任命 ${userName} 为该队队长吗？`)) return;
    
    try {
      setLoading(true);
      const res = await fetch('/api/game/admin/set-captain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userId) // 发送 int
      });
      
      if (res.ok) {
        fetchDashboard(); // 刷新
      } else {
        alert('操作失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const timer = setInterval(fetchDashboard, 3000); // 3秒刷新一次
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden">
      
      {/* === 左侧：二维码区域 (1/3) === */}
      <div className="w-1/3 border-r border-slate-700 flex flex-col items-center justify-center p-8 bg-slate-800/50">
        <h1 className="text-3xl font-bold mb-2 text-yellow-500">金陵折叠 · 1368 // 1912</h1>
        <p className="text-slate-400 mb-8">请队员扫描下方二维码加入战斗</p>
        
        <div className="bg-white p-4 rounded-xl shadow-[0_0_30px_rgba(234,179,8,0.3)]">
           <img src={qrCodeUrl} alt="Join Game QR" className="w-64 h-64" />
        </div>
        
        <div className="mt-8 flex items-center gap-2 text-slate-500 font-mono text-sm">
            <QrCode size={16}/> {appUrl}
        </div>
      </div>

      {/* === 右侧：队伍管理 (2/3) === */}
      <div className="w-2/3 p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
                <Users className="text-blue-400"/> 战队实时监控
            </h2>
            <div className="text-xs text-slate-500 animate-pulse">● 实时数据同步中...</div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {teams.map(team => (
                <div key={team.id} className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                    {/* 队头 */}
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700">
                        <div>
                            <span className="font-bold text-lg text-yellow-100">{team.name}</span>
                            <span className="ml-2 text-xs text-slate-400">({team.description})</span>
                        </div>
                        <div className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-300">
                            手牌: {team.cardCount}
                        </div>
                    </div>

                    {/* 成员列表 */}
                    <div className="space-y-2">
                        {team.members.length === 0 && <div className="text-slate-600 text-sm italic">暂无成员加入</div>}
                        
                        {team.members.map(member => (
                            <div key={member.id} className="flex justify-between items-center bg-slate-900/50 p-2 rounded hover:bg-slate-700 transition-colors">
                                <div className="flex items-center gap-2">
                                    {/* 在线状态 */}
                                    {member.isOnline 
                                        ? <Wifi size={14} className="text-green-500" title="在线"/> 
                                        : <WifiOff size={14} className="text-slate-600" title="离线"/>
                                    }
                                    
                                    {/* 名字 */}
                                    <span className={member.isCaptain ? 'text-yellow-400 font-bold' : 'text-slate-200'}>
                                        {member.realName}
                                    </span>
                                    
                                    {/* 队长标 */}
                                    {member.isCaptain && <Crown size={14} className="text-yellow-500"/>}
                                </div>

                                {/* 操作按钮 */}
                                {!member.isCaptain && (
                                    <button 
                                        onClick={() => handleSetCaptain(member.id, member.realName)}
                                        disabled={loading}
                                        className="text-xs border border-slate-600 text-slate-400 px-2 py-1 rounded hover:bg-yellow-600 hover:text-white hover:border-yellow-600 transition-all"
                                    >
                                        任命队长
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;