import React from 'react';
import { Card as CardType } from '../types';

interface CardUIProps {
  card?: CardType;
  hidden?: boolean;
  size?: 'sm' | 'lg';
}

export const CardUI: React.FC<CardUIProps> = ({ card, hidden, size = 'lg' }) => {
  const isSm = size === 'sm';
  const widthClass = isSm ? 'w-14 h-20' : 'w-20 h-28';
  const rankClass = isSm ? 'text-sm' : 'text-xl';
  const suitClass = isSm ? 'text-xl' : 'text-3xl';
  const paddingClass = isSm ? 'p-1.5 rounded' : 'p-2 rounded-lg';
  const borderClass = isSm ? '' : 'border-2 border-slate-200';

  if (hidden || !card) {
    return (
      <div className={`${widthClass} bg-slate-800/50 border border-slate-700 border-dashed ${paddingClass} flex items-center justify-center`}>
        <div className={`text-slate-700 font-bold ${isSm ? 'text-lg' : 'text-2xl'}`}>?</div>
      </div>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitSymbol = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }[card.suit];
  const textColor = isRed ? 'text-red-600' : 'text-slate-900';

  return (
    <div className={`${widthClass} bg-white ${paddingClass} shadow-xl ${borderClass} flex flex-col items-center justify-between`}>
      <span className={`${textColor} font-bold ${rankClass} self-start leading-none`}>{card.rank}{suitSymbol}</span>
      <span className={`${textColor} ${suitClass} leading-none`}>{suitSymbol}</span>
    </div>
  );
};
