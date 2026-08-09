export interface BoardCard {
  rank: string;
  suit: string;
}

export type BoardTone = 'none' | 'rainbow' | 'two-tone' | 'monotone';
export type BoardPairing = 'unpaired' | 'paired' | 'two-pair' | 'trips' | 'quads';
export type BoardDynamics = 'static' | 'semi-dynamic' | 'dynamic';

export interface BoardTexture {
  cards: BoardCard[];
  cardCount: number;
  highCard: string | null;
  pairing: BoardPairing;
  tone: BoardTone;
  broadwayDensity: number;
  straightConnectivity: number;
  suitConcentration: number;
  dynamics: BoardDynamics;
  textureId: string;
}

const RANK_VALUE: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};
const VALUE_RANK = Object.fromEntries(Object.entries(RANK_VALUE).map(([rank, value]) => [value, rank])) as Record<number, string>;
const STRAIGHT_WINDOWS = [
  [14, 13, 12, 11, 10], [13, 12, 11, 10, 9], [12, 11, 10, 9, 8], [11, 10, 9, 8, 7],
  [10, 9, 8, 7, 6], [9, 8, 7, 6, 5], [8, 7, 6, 5, 4], [7, 6, 5, 4, 3], [6, 5, 4, 3, 2], [5, 4, 3, 2, 14],
];

export function parseBoardCards(value: string): BoardCard[] {
  return [...value.matchAll(/([2-9TJQKA])([cdhs♣♦♥♠])/gi)].map(match => ({
    rank: match[1].toUpperCase(),
    suit: normalizeSuit(match[2]),
  }));
}

function normalizeSuit(value: string): string {
  const suit = value.toLowerCase();
  if (suit === '♣') return 'c';
  if (suit === '♦') return 'd';
  if (suit === '♥') return 'h';
  if (suit === '♠') return 's';
  return suit;
}

function pairingOf(rankCounts: Map<string, number>): BoardPairing {
  const counts = [...rankCounts.values()].sort((a, b) => b - a);
  if ((counts[0] || 0) >= 4) return 'quads';
  if ((counts[0] || 0) >= 3) return 'trips';
  if (counts.filter(count => count >= 2).length >= 2) return 'two-pair';
  if ((counts[0] || 0) >= 2) return 'paired';
  return 'unpaired';
}

function toneOf(cards: BoardCard[], suitCounts: Map<string, number>): BoardTone {
  if (cards.length < 3) return 'none';
  const maxSuit = Math.max(0, ...suitCounts.values());
  if (maxSuit === cards.length) return 'monotone';
  if (maxSuit >= 2) return 'two-tone';
  return 'rainbow';
}

export function analyzeBoardTexture(value: string): BoardTexture {
  const cards = parseBoardCards(value);
  const rankCounts = new Map<string, number>();
  const suitCounts = new Map<string, number>();
  cards.forEach(card => {
    rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
    suitCounts.set(card.suit, (suitCounts.get(card.suit) || 0) + 1);
  });

  const values = [...new Set(cards.map(card => RANK_VALUE[card.rank]).filter(Boolean))];
  const maxValue = values.length ? Math.max(...values) : 0;
  const straightConnectivity = values.length
    ? Math.max(...STRAIGHT_WINDOWS.map(window => window.filter(rank => values.includes(rank)).length / 5))
    : 0;
  const broadwayDensity = cards.length ? cards.filter(card => RANK_VALUE[card.rank] >= 10).length / cards.length : 0;
  const suitConcentration = cards.length ? Math.max(0, ...suitCounts.values()) / cards.length : 0;
  const pairing = pairingOf(rankCounts);
  const tone = toneOf(cards, suitCounts);
  const dynamicScore = straightConnectivity * 0.55 + (tone === 'monotone' ? 0.45 : tone === 'two-tone' ? 0.28 : 0) + (pairing === 'unpaired' ? 0.08 : -0.05);
  const dynamics: BoardDynamics = dynamicScore >= 0.62 ? 'dynamic' : dynamicScore >= 0.42 ? 'semi-dynamic' : 'static';
  const highCard = maxValue ? VALUE_RANK[maxValue] : null;
  const textureId = [pairing, tone, highCard ? `high-${highCard}` : 'no-high', `conn-${Math.round(straightConnectivity * 10)}`, dynamics].join(':');

  return {
    cards,
    cardCount: cards.length,
    highCard,
    pairing,
    tone,
    broadwayDensity,
    straightConnectivity,
    suitConcentration,
    dynamics,
    textureId,
  };
}

export function boardTextureDifference(left: BoardTexture, right: BoardTexture): string[] {
  const differences: string[] = [];
  if (left.highCard !== right.highCard) differences.push(`high-card:${left.highCard || '-'}→${right.highCard || '-'}`);
  if (left.pairing !== right.pairing) differences.push(`pairing:${left.pairing}→${right.pairing}`);
  if (left.tone !== right.tone) differences.push(`tone:${left.tone}→${right.tone}`);
  if (Math.abs(left.straightConnectivity - right.straightConnectivity) >= 0.19) differences.push(`connectivity:${left.straightConnectivity.toFixed(2)}→${right.straightConnectivity.toFixed(2)}`);
  if (left.dynamics !== right.dynamics) differences.push(`dynamics:${left.dynamics}→${right.dynamics}`);
  return differences;
}
