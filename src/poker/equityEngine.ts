import { Card, Rank, Suit } from '../types';

export interface WeightedRangeHand {
  hand: string;
  weight?: number;
}

export interface EquityRequest {
  hero: Card[];
  board?: Card[];
  villainRange: WeightedRangeHand[];
  exactStateLimit?: number;
  iterations?: number;
  seed?: number;
}

export interface EquityResult {
  method: 'exact' | 'monte-carlo';
  equity: number;
  winRate: number;
  tieRate: number;
  lossRate: number;
  samples: number;
  villainCombos: number;
  estimatedStates: number;
}

interface WeightedCombo {
  cards: [Card, Card];
  weight: number;
}

type HandScore = number[];

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const SUIT_CODE: Record<string, Suit> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const RANK_VALUE: Record<Rank, number> = Object.fromEntries(RANKS.map((rank, index) => [rank, index + 2])) as Record<Rank, number>;

export function parseCardToken(token: string): Card {
  const normalized = token.trim().replace(/^10/i, 'T');
  const match = normalized.match(/^([2-9TJQKA])([shdc])$/i);
  if (!match) throw new Error(`Invalid card token: ${token}`);
  return { rank: match[1].toUpperCase() as Rank, suit: SUIT_CODE[match[2].toLowerCase()] };
}

export function parseCardsText(text: string): Card[] {
  return text.split(/[\s,]+/).filter(Boolean).map(parseCardToken);
}

export function cardKey(card: Card): string {
  const suit = card.suit === 'spades' ? 's' : card.suit === 'hearts' ? 'h' : card.suit === 'diamonds' ? 'd' : 'c';
  return `${card.rank}${suit}`;
}

export function createDeck(): Card[] {
  return RANKS.flatMap(rank => SUITS.map(suit => ({ rank, suit })));
}

function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

function ensureUnique(cards: Card[], label: string): void {
  const keys = cards.map(cardKey);
  if (new Set(keys).size !== keys.length) throw new Error(`${label} contains duplicate cards.`);
}

function canonicalRanks(first: string, second: string): [Rank, Rank] {
  const a = first.toUpperCase() as Rank;
  const b = second.toUpperCase() as Rank;
  if (!RANKS.includes(a) || !RANKS.includes(b)) throw new Error(`Invalid range ranks: ${first}${second}`);
  return RANK_VALUE[a] >= RANK_VALUE[b] ? [a, b] : [b, a];
}

export function expandHandNotation(notation: string, deadCards: Card[] = []): Array<[Card, Card]> {
  const raw = notation.trim().replace(/10/gi, 'T');
  const exact = raw.match(/^([2-9TJQKA][shdc])([2-9TJQKA][shdc])$/i);
  if (exact) {
    const cards: [Card, Card] = [parseCardToken(exact[1]), parseCardToken(exact[2])];
    if (sameCard(cards[0], cards[1])) return [];
    return cards.some(card => deadCards.some(dead => sameCard(card, dead))) ? [] : [cards];
  }

  const match = raw.match(/^([2-9TJQKA])([2-9TJQKA])([so])?$/i);
  if (!match) throw new Error(`Unsupported range notation: ${notation}`);
  const [high, low] = canonicalRanks(match[1], match[2]);
  const suitedness = match[3]?.toLowerCase();
  const combos: Array<[Card, Card]> = [];

  if (high === low) {
    for (let i = 0; i < SUITS.length; i += 1) {
      for (let j = i + 1; j < SUITS.length; j += 1) combos.push([{ rank: high, suit: SUITS[i] }, { rank: low, suit: SUITS[j] }]);
    }
  } else {
    SUITS.forEach(firstSuit => SUITS.forEach(secondSuit => {
      if (suitedness === 's' && firstSuit !== secondSuit) return;
      if (suitedness === 'o' && firstSuit === secondSuit) return;
      combos.push([{ rank: high, suit: firstSuit }, { rank: low, suit: secondSuit }]);
    }));
  }

  return combos.filter(combo => combo.every(card => !deadCards.some(dead => sameCard(card, dead))));
}

export function expandWeightedRange(range: WeightedRangeHand[], deadCards: Card[] = []): WeightedCombo[] {
  const merged = new Map<string, WeightedCombo>();
  range.forEach(item => {
    const weight = Math.max(0, Math.min(1, item.weight ?? 1));
    if (!weight) return;
    expandHandNotation(item.hand, deadCards).forEach(cards => {
      const sorted = [...cards].sort((a, b) => cardKey(a).localeCompare(cardKey(b))) as [Card, Card];
      const key = `${cardKey(sorted[0])}-${cardKey(sorted[1])}`;
      const previous = merged.get(key);
      merged.set(key, { cards: sorted, weight: Math.min(1, (previous?.weight || 0) + weight) });
    });
  });
  return [...merged.values()];
}

function combinations<T>(items: T[], choose: number, limit = Infinity): T[][] {
  if (choose === 0) return [[]];
  const out: T[][] = [];
  const current: T[] = [];
  const visit = (start: number) => {
    if (out.length >= limit) return;
    if (current.length === choose) {
      out.push([...current]);
      return;
    }
    for (let i = start; i <= items.length - (choose - current.length); i += 1) {
      current.push(items[i]);
      visit(i + 1);
      current.pop();
      if (out.length >= limit) return;
    }
  };
  visit(0);
  return out;
}

function nChooseK(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  const m = Math.min(k, n - k);
  for (let i = 1; i <= m; i += 1) result = result * (n - m + i) / i;
  return Math.round(result);
}

function compareScores(a: HandScore, b: HandScore): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function straightHigh(uniqueRanks: number[]): number {
  const ranks = [...new Set(uniqueRanks)].sort((a, b) => b - a);
  if (ranks.includes(14)) ranks.push(1);
  for (let i = 0; i <= ranks.length - 5; i += 1) {
    if (ranks[i] - ranks[i + 4] === 4) return ranks[i];
  }
  return 0;
}

function evaluateFive(cards: Card[]): HandScore {
  const values = cards.map(card => RANK_VALUE[card.rank]).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every(card => card.suit === cards[0].suit);
  const straight = straightHigh(values);

  if (flush && straight) return [8, straight];
  if (groups[0][1] === 4) return [7, groups[0][0], groups.find(group => group[1] === 1)![0]];
  if (groups[0][1] === 3 && groups[1]?.[1] === 2) return [6, groups[0][0], groups[1][0]];
  if (flush) return [5, ...values];
  if (straight) return [4, straight];
  if (groups[0][1] === 3) return [3, groups[0][0], ...groups.filter(group => group[1] === 1).map(group => group[0]).sort((a, b) => b - a)];
  const pairs = groups.filter(group => group[1] === 2).sort((a, b) => b[0] - a[0]);
  if (pairs.length >= 2) return [2, pairs[0][0], pairs[1][0], groups.find(group => group[1] === 1)![0]];
  if (pairs.length === 1) return [1, pairs[0][0], ...groups.filter(group => group[1] === 1).map(group => group[0]).sort((a, b) => b - a)];
  return [0, ...values];
}

export function evaluateHoldem(cards: Card[]): HandScore {
  if (cards.length < 5 || cards.length > 7) throw new Error('Holdem evaluation requires 5 to 7 cards.');
  let best: HandScore | null = null;
  combinations(cards, 5).forEach(combo => {
    const score = evaluateFive(combo);
    if (!best || compareScores(score, best) > 0) best = score;
  });
  return best!;
}

function compareHoldem(hero: Card[], villain: Card[], board: Card[]): number {
  return compareScores(evaluateHoldem([...hero, ...board]), evaluateHoldem([...villain, ...board]));
}

function makeRng(seed: number) {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function weightedChoice(combos: WeightedCombo[], rng: () => number): WeightedCombo {
  const total = combos.reduce((sum, combo) => sum + combo.weight, 0);
  let cursor = rng() * total;
  for (const combo of combos) {
    cursor -= combo.weight;
    if (cursor <= 0) return combo;
  }
  return combos[combos.length - 1];
}

function summarize(method: EquityResult['method'], wins: number, ties: number, losses: number, samples: number, villainCombos: number, estimatedStates: number): EquityResult {
  const total = wins + ties + losses || 1;
  return {
    method,
    equity: (wins + ties * 0.5) / total * 100,
    winRate: wins / total * 100,
    tieRate: ties / total * 100,
    lossRate: losses / total * 100,
    samples,
    villainCombos,
    estimatedStates,
  };
}

export function calculateEquity(request: EquityRequest): EquityResult {
  const hero = request.hero || [];
  const board = request.board || [];
  if (hero.length !== 2) throw new Error('Hero must have exactly two cards.');
  if (board.length > 5) throw new Error('Board cannot contain more than five cards.');
  ensureUnique([...hero, ...board], 'Known cards');

  const dead = [...hero, ...board];
  const villainCombos = expandWeightedRange(request.villainRange, dead);
  if (!villainCombos.length) throw new Error('Villain range has no live combinations.');
  const missingBoard = 5 - board.length;
  const remainingBeforeVillain = 52 - dead.length - 2;
  const estimatedStates = villainCombos.length * nChooseK(remainingBeforeVillain, missingBoard);
  const exactStateLimit = request.exactStateLimit ?? 250000;

  if (estimatedStates <= exactStateLimit) {
    let wins = 0;
    let ties = 0;
    let losses = 0;
    let samples = 0;
    const baseDeck = createDeck().filter(card => !dead.some(known => sameCard(card, known)));
    villainCombos.forEach(combo => {
      const deck = baseDeck.filter(card => !combo.cards.some(villain => sameCard(card, villain)));
      const runouts = combinations(deck, missingBoard);
      runouts.forEach(runout => {
        const result = compareHoldem(hero, combo.cards, [...board, ...runout]);
        if (result > 0) wins += combo.weight;
        else if (result < 0) losses += combo.weight;
        else ties += combo.weight;
        samples += 1;
      });
    });
    return summarize('exact', wins, ties, losses, samples, villainCombos.length, estimatedStates);
  }

  const iterations = Math.max(1000, request.iterations ?? 25000);
  const rng = makeRng(request.seed ?? 20260809);
  let wins = 0;
  let ties = 0;
  let losses = 0;
  for (let sample = 0; sample < iterations; sample += 1) {
    const villain = weightedChoice(villainCombos, rng);
    const deck = createDeck().filter(card => !dead.some(known => sameCard(card, known)) && !villain.cards.some(card2 => sameCard(card, card2)));
    const runout: Card[] = [];
    for (let i = 0; i < missingBoard; i += 1) {
      const index = Math.floor(rng() * deck.length);
      runout.push(deck[index]);
      deck.splice(index, 1);
    }
    const result = compareHoldem(hero, villain.cards, [...board, ...runout]);
    if (result > 0) wins += 1;
    else if (result < 0) losses += 1;
    else ties += 1;
  }
  return summarize('monte-carlo', wins, ties, losses, iterations, villainCombos.length, estimatedStates);
}
