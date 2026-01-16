import React, { useState } from 'react';

const LoginPage = ({ onLogin }) => {
  const [empId, setEmpId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (!empId || !name) { setError("请输入工号和姓名"); return; }
    const teamId = (parseInt(empId) % 5) + 1; 
    const isCaptain = empId.endsWith('1'); 
    onLogin({ id: empId, name: name, teamId: teamId, isCaptain: isCaptain, token: "mock-jwt" });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
        <h1 className="text-3xl font-bold text-yellow-500 mb-8 text-center">金陵折叠 · 1368 // 1912</h1>
        <form onSubmit={handleLogin} className="space-y-6">
          <input type="number" value={empId} onChange={e => setEmpId(e.target.value)} className="w-full bg-slate-700 text-white rounded p-3" placeholder="工号" />
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-700 text-white rounded p-3" placeholder="姓名" />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button type="submit" className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 rounded">开启金陵折叠</button>
        </form>
      </div>
    </div>
  );
};
export default LoginPage;