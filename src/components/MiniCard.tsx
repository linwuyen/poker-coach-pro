import React from 'react';
import { Card } from '../types';

export const MiniCard: React.FC<{ card?: Card; hidden?: boolean }> = ({ card, hidden }) => {
  if (hidden || !card) {
    return (
      <div className="w-7 sm:w-8 h-10 sm:h-11.5 bg-gradient-to-br from-red-700 to-red-900 border border-red-600 rounded-md shadow-md flex items-center justify-center text-[10px] sm:text-[12px] font-bold text-red-100/80 select-none">
        🂠
      </div>
    );
  }
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitSymbol = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }[card.suit];
  const textColor = isRed ? 'text-rose-600' : 'text-slate-900';
  return (
    <div className="w-7 sm:w-8 h-10 sm:h-11.5 bg-white rounded-md shadow-md border border-slate-200 flex flex-col items-center justify-between p-1 select-none">
      <span className={`${textColor} font-mono font-black text-[10px] sm:text-[12px] leading-none`}>{card.rank}</span>
      <span className={`${textColor} text-[13px] sm:text-[16px] leading-none -mt-1`}>{suitSymbol}</span>
    </div>
  );
};
