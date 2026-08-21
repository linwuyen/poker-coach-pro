import { Position } from '../strategy-engine-v2/types';
import { PostflopLineAction, PostflopTruthContext, PostflopTruthNode, PostflopTruthQuery } from './types';

const RANKS = 'AKQJT98765432';
const SUITS = 'shdc';

function assertCard(card: string): string {
  const normalized = card.trim();
  if (!/^[2-9TJQKA][shdc]$/i.test(normalized)) throw new Error(`Invalid card ${card}.`);
  return normalized[0].toUpperCase() + normalized[1].toLowerCase();
}

function compareCard(a: string, b: string): number {
  const rank = RANKS.indexOf(a[0]) - RANKS.indexOf(b[0]);
  return rank || SUITS.indexOf(a[1]) - SUITS.indexOf(b[1]);
}

export function canonicalHoleCombo(cards: string[]): string {
  if (!Array.isArray(cards) || cards.length !== 2) throw new Error('Exact postflop truth requires exactly two Hero cards.');
  const normalized = cards.map(assertCard);
  if (new Set(normalized).size !== 2) throw new Error('Hero cards must be unique.');
  return normalized.sort(compareCard).join('');
}

export function canonicalBoard(cards: string[]): string[] {
  if (![3, 4, 5].includes(cards.length)) throw new Error('Postflop board must contain 3, 4, or 5 cards.');
  const normalized = cards.map(assertCard);
  if (new Set(normalized).size !== normalized.length) throw new Error('Board cards must be unique.');
  const flop = normalized.slice(0, 3).sort(compareCard);
  return [...flop, ...normalized.slice(3)];
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function canonicalLine(line: PostflopLineAction[]): PostflopLineAction[] {
  return (line || []).map(action => ({
    actor: action.actor,
    action: action.action,
    sizePot: action.sizePot === undefined ? undefined : round(action.sizePot),
    toBB: action.toBB === undefined ? undefined : round(action.toBB),
  }));
}

export function canonicalPostflopContext(context: PostflopTruthContext): PostflopTruthContext {
  return {
    ...context,
    effectiveStackBB: round(context.effectiveStackBB),
    potBB: round(context.potBB),
    spr: round(context.spr),
    toCallBB: round(context.toCallBB),
    board: canonicalBoard(context.board),
    preflopLine: canonicalLine(context.preflopLine),
    streetLine: canonicalLine(context.streetLine),
    forcedBetKey: context.forcedBetKey || undefined,
  };
}

export function postflopContextKey(context: PostflopTruthContext): string {
  const c = canonicalPostflopContext(context);
  return JSON.stringify([
    c.format, c.tableSize, c.street, c.heroPosition, c.villainPosition, c.playersInHand,
    c.effectiveStackBB, c.potBB, c.spr, c.toCallBB, c.board, c.preflopLine, c.streetLine,
    c.lastAggressorPosition || '-', c.rakePercent ?? '-', c.rakeCapBB ?? '-', c.forcedBetKey || '-',
  ]);
}

function sameNumber(actual: number | undefined, observed: number | undefined, tolerance: number): boolean {
  if (actual === undefined) return observed === undefined;
  return observed !== undefined && Number.isFinite(observed) && Math.abs(actual - observed) <= tolerance;
}

function sameLine(a: PostflopLineAction[], b: PostflopLineAction[]): boolean {
  return JSON.stringify(canonicalLine(a)) === JSON.stringify(canonicalLine(b));
}

function sameBoard(a: string[], b: string[]): boolean {
  try { return JSON.stringify(canonicalBoard(a)) === JSON.stringify(canonicalBoard(b)); } catch { return false; }
}

/** Exact-only automated lookup. Zero or multiple matching verified nodes both resolve to Unknown. */
export function findExactVerifiedPostflopNode(nodes: PostflopTruthNode[], query: PostflopTruthQuery): PostflopTruthNode | undefined {
  if (!query.heroCards || !query.board || !query.preflopLine || !query.streetLine) return undefined;
  let combo: string;
  try { combo = canonicalHoleCombo(query.heroCards); } catch { return undefined; }
  const matches = nodes.filter(node => {
    if (node.source.trustTier !== 'verified-solver') return false;
    const c = node.context;
    if (query.format !== c.format || query.tableSize !== c.tableSize || query.street !== c.street) return false;
    if (query.heroPosition !== c.heroPosition || query.villainPosition !== c.villainPosition) return false;
    if (query.playersInHand !== 2 || c.playersInHand !== 2) return false;
    if (!sameNumber(c.effectiveStackBB, query.effectiveStackBB, 0.1)) return false;
    if (!sameNumber(c.potBB, query.potBB, 0.05)) return false;
    if (!sameNumber(c.spr, query.spr, 0.03)) return false;
    if (!sameNumber(c.toCallBB, query.toCallBB, 0.05)) return false;
    if (!sameBoard(c.board, query.board)) return false;
    if (!sameLine(c.preflopLine, query.preflopLine) || !sameLine(c.streetLine, query.streetLine)) return false;
    if (query.lastAggressorPosition !== c.lastAggressorPosition) return false;
    if (!sameNumber(c.rakePercent, query.rakePercent, 0.1) || !sameNumber(c.rakeCapBB, query.rakeCapBB, 0.1)) return false;
    if ((query.forcedBetKey || undefined) !== (c.forcedBetKey || undefined)) return false;
    return Boolean(node.strategyByCombo[combo]);
  });
  return matches.length === 1 ? matches[0] : undefined;
}

export function normalizePosition(value: string | undefined): Position | undefined {
  const normalized = value?.toLowerCase();
  return normalized && ['utg','utg1','utg2','mp','hj','co','btn','sb','bb'].includes(normalized) ? normalized as Position : undefined;
}
