import React, { useState } from 'react';
import { Shield, Play } from 'lucide-react';

const CaptainView = ({ teamId, teamCards, onPlayCards }) => {
  const [selectedCards, setSelectedCards] = useState([]);
  const toggleSelect = (id) => setSelectedCards(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const handlePlay = () => { if (selectedCards.length > 0) { onPlayCards(selectedCards); setSelectedCards([]); } };
  const sortedCards = [...teamCards].sort((a, b) => {
    const map = { '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13, 'A':14 };
    return map[b.rank] - map[a.rank];
  });

  return (
    <div className="p-4 pb-24">
      <div className="bg-slate-800 p-4 rounded-lg mb-4 border border-yellow-500/30">
        <h2 className="text-xl font-bold text-yellow-500 flex items-center gap-2"><Shield className="w-5 h-5"/> 队长指挥台</h2>
        <p className="text-slate-400 text-sm mt-1">团队牌库：{teamCards.length} 张</p>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-20">
        {sortedCards.map(c => (
          <div key={c.id} onClick={() => toggleSelect(c.id)} className={`relative aspect-[2/3] rounded-lg flex flex-col items-center justify-center font-bold text-xl cursor-pointer ${selectedCards.includes(c.id) ? 'bg-yellow-100 ring-4 ring-yellow-500' : 'bg-slate-200'} ${(c.suit === '♥' || c.suit === '♦') ? 'text-red-600' : 'text-slate-900'}`}>
            <span>{c.suit}</span><span>{c.rank}</span>
          </div>
        ))}
      </div>
      {selectedCards.length > 0 && <div className="fixed bottom-20 left-4 right-4"><button onClick={handlePlay} className="w-full bg-red-600 text-white font-bold py-4 rounded-full flex items-center justify-center gap-2"><Play className="w-5 h-5"/> 打出 {selectedCards.length} 张</button></div>}
    </div>
  );
};
export default CaptainView;