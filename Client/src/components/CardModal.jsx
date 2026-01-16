import React from 'react';
const CardModal = ({ card, onClose }) => {
  if (!card) return null;
  const isRed = card.suit === '♥' || card.suit === '♦';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white rounded-xl p-8 max-w-sm w-full text-center">
        <h3 className="text-2xl font-bold text-slate-800 mb-4">🎉 获得龙脉碎片!</h3>
        <div className={`text-9xl mb-6 font-serif ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{card.display}</div>
        <button onClick={onClose} className="w-full bg-yellow-500 text-white font-bold py-3 rounded-lg">收入囊中</button>
      </div>
    </div>
  );
};
export default CardModal;