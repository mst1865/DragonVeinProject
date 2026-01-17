import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

const LoginPage = ({ onLogin }) => {
  // 保存用户输入的原始值
  const [empId, setEmpId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!empId || !name) { 
      setError("请输入工号和姓名"); 
      return; 
    }
    
    setIsLoading(true);
    
    // ✅ 关键修改：只传递输入数据，不发起请求
    // 具体的 API 调用由父组件 App.jsx 的 handleLogin 处理
    onLogin({ 
      id: empId,   // 例如 "agent001"
      name: name   // 例如 "特工001"
    });
    
    // 注意：这里不需要 setIsLoading(false)，因为父组件处理完会切换页面销毁此组件
    // 如果登录失败，父组件应该通过某种方式通知（这里简化处理，若长时间停留在当前页可手动重置）
    setTimeout(() => setIsLoading(false), 5000); // 简单的超时重置防止卡死
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
        <h1 className="text-3xl font-bold text-yellow-500 mb-8 text-center">金陵折叠 · 1368 // 1912</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input 
              type="text" 
              value={empId} 
              onChange={e => setEmpId(e.target.value)} 
              className="w-full bg-slate-700 text-white rounded p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500" 
              placeholder="工号" 
            />
          </div>
          <div>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full bg-slate-700 text-white rounded p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500" 
              placeholder="姓名"
            />
          </div>
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          
          <button 
            type="submit" 
            disabled={isLoading}
            className={`w-full font-bold py-3 rounded text-white flex items-center justify-center transition-colors ${
              isLoading ? 'bg-slate-600 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-500'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                正在验证身份...
              </>
            ) : (
              '开启金陵折叠'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;