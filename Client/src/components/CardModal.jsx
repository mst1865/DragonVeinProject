import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Gift, Puzzle, X, Star } from 'lucide-react';

const ItemType = { Wild: 0, Swap: 1, Fragment: 2, Gift: 3 };

const CardModal = ({ reward, onClose }) => {
  const [isOpen, setIsOpen] = useState(false); // 控制是否翻开/揭晓
  const [animate, setAnimate] = useState(false); // 控制入场动画

  useEffect(() => {
    if (reward) {
      setAnimate(true);
      setIsOpen(false); // 每次新奖励都重置为未揭晓状态
    } else {
      setAnimate(false);
    }
  }, [reward]);

  if (!reward) return null;

  // 这里的 reward 结构预计为： { type: 'card'|'item', data: ... }
  const isItem = reward.type === 'item';
  const data = reward.data;

  // 处理点击揭晓
  const handleReveal = () => {
    if (!isOpen) setIsOpen(true);
  };

  // --- 渲染内容生成器 ---

  // 1. 渲染卡背 (未揭晓状态)
  const renderBack = () => (
    <div 
      onClick={handleReveal}
      className="w-64 h-96 bg-slate-800 rounded-xl border-4 border-slate-600 shadow-2xl flex flex-col items-center justify-center cursor-pointer transform transition-transform hover:scale-105 active:scale-95 relative overflow-hidden"
    >
      {/* 卡背纹理 */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-500 via-slate-900 to-black"></div>
      <div className="z-10 text-6xl animate-bounce">🎁</div>
      <p className="z-10 mt-8 text-yellow-500 font-bold text-lg animate-pulse">点击开启时空胶囊</p>
    </div>
  );

  // 2. 渲染线索卡 (扑克牌)
  const renderCard = (card) => {
    const isRed = card.suit === '♥' || card.suit === '♦';
    const isWild = card.isWildGenerated;
    
    return (
      <div className={`
        w-64 h-96 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center justify-between p-6 relative overflow-hidden bg-slate-100
        ${isWild ? 'ring-4 ring-yellow-400 shadow-[0_0_50px_rgba(234,179,8,0.5)]' : ''}
        animate-fade-in-up
      `}>
        {/* 背景装饰 */}
        {isWild && <div className="absolute inset-0 bg-gradient-to-br from-yellow-100/50 to-yellow-300/20 pointer-events-none"/>}
        
        {/* 左上角 */}
        <div className="self-start text-center">
          <div className={`text-4xl font-black ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{card.rank}</div>
          <div className={`text-3xl ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{card.suit}</div>
        </div>

        {/* 中央大图 */}
        <div className={`text-9xl ${isRed ? 'text-red-600' : 'text-slate-900'} opacity-80 scale-150`}>
           {card.suit}
        </div>

        {/* 底部信息 */}
        <div className="self-end rotate-180 text-center">
          <div className={`text-4xl font-black ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{card.rank}</div>
          <div className={`text-3xl ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{card.suit}</div>
        </div>

        {/* 通配特效 */}
        {isWild && (
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center">
             <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">✨ 通配变形 ✨</span>
           </div>
        )}
      </div>
    );
  };

  // 3. 渲染道具卡 (特殊样式)
  const renderItem = (item) => {
    let theme = {};
    
    switch (item.type) {
      case ItemType.Wild: // 通配
        theme = { 
          bg: 'bg-gradient-to-br from-purple-900 to-indigo-900', 
          icon: <Sparkles size={80} className="text-purple-300 animate-pulse"/>, 
          border: 'border-purple-500',
          shadow: 'shadow-purple-500/50',
          titleColor: 'text-purple-300'
        };
        break;
      case ItemType.Swap: // 交换
        theme = { 
          bg: 'bg-gradient-to-br from-green-900 to-emerald-900', 
          icon: <RefreshCw size={80} className="text-green-300 animate-spin-slow"/>, 
          border: 'border-green-500',
          shadow: 'shadow-green-500/50',
          titleColor: 'text-green-300'
        };
        break;
      case ItemType.Gift: // 礼品
        theme = { 
          bg: 'bg-gradient-to-br from-red-900 to-rose-900', 
          icon: <Gift size={80} className="text-red-300 animate-bounce"/>, 
          border: 'border-red-500',
          shadow: 'shadow-red-500/50',
          titleColor: 'text-red-300'
        };
        break;
      case ItemType.Fragment: // 碎片
        theme = { 
          bg: 'bg-gradient-to-br from-orange-900 to-amber-900', 
          icon: <Puzzle size={80} className="text-orange-300"/>, 
          border: 'border-orange-500',
          shadow: 'shadow-orange-500/50',
          titleColor: 'text-orange-300'
        };
        break;
      default:
        theme = { bg: 'bg-slate-800', icon: null, border: 'border-slate-500' };
    }

    return (
      <div className={`
        w-64 h-96 rounded-xl border-4 ${theme.border} ${theme.bg} shadow-[0_0_60px_rgba(0,0,0,0.5)] ${theme.shadow}
        flex flex-col items-center justify-center p-6 text-center relative overflow-hidden animate-fade-in-up
      `}>
        {/* 背景光效 */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle,_rgba(255,255,255,0.1)_0%,_rgba(0,0,0,0)_70%)] pointer-events-none"></div>
        
        {/* 图标区 */}
        <div className="mb-8 scale-110 drop-shadow-lg">
          {theme.icon}
        </div>

        {/* 文字区 */}
        <h3 className={`text-3xl font-black mb-4 ${theme.titleColor} drop-shadow-md`}>{item.name}</h3>
        <div className="bg-black/30 p-3 rounded-lg backdrop-blur-sm border border-white/10">
           <p className="text-slate-200 text-sm leading-relaxed">{item.description}</p>
        </div>

        {/* 底部装饰 */}
        <div className="absolute bottom-4 text-[10px] text-white/30 tracking-widest uppercase">
           稀有道具
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* 黑色半透明背景 */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>

      {/* 核心卡片容器 */}
      <div className="relative z-10 flex flex-col items-center">
        
        {/* 只有翻开后才显示关闭按钮 */}
        {isOpen && (
           <button 
             onClick={onClose}
             className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
           >
             <X size={24}/>
           </button>
        )}

        {/* 翻转/切换逻辑 */}
        {!isOpen ? renderBack() : (
           isItem ? renderItem(data) : renderCard(data)
        )}

        {/* 底部提示字 */}
        <div className="mt-8 h-8 text-center">
          {isOpen ? (
            <button onClick={onClose} className="px-8 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-full shadow-lg animate-pulse">
              收下奖励
            </button>
          ) : (
            <p className="text-slate-400 text-sm">轻触卡片以揭晓</p>
          )}
        </div>

      </div>
    </div>
  );
};

export default CardModal;