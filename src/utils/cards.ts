import { Card, Rank, Suit } from '../types';

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const SUIT_SYMBOLS: Record<Suit, string> = {
  'hearts': '♥',
  'diamonds': '♦',
  'clubs': '♣',
  'spades': '♠'
};

export const parseCards = (str: string): Card[] => {
  return str.split(/[\s,]+/)
    .filter(Boolean)
    .map(tok => {
      if (tok.length < 2) return null;
      const rank = tok[0].toUpperCase() as Rank;
      const suitChar = tok[1].toLowerCase();
      const suit = {
        's': 'spades',
        'h': 'hearts',
        'd': 'diamonds',
        'c': 'clubs'
      }[suitChar] as Suit;
      if (!rank || !suit) return null;
      return { rank, suit };
    })
    .filter((c): c is Card => c !== null);
};
