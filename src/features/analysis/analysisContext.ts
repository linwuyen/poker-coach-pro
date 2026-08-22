import type { Card, Rank, Suit } from '../../types';

export interface AnalysisContext {
  schemaVersion: 1;
  capturedAt: number;
  source: 'scenario' | 'pokerbench' | 'unknown';
  trainingType?: string;
  scenarioId?: string;
  datasetRowId?: string;
  title?: string;
  heroCards: string[];
  boardCards: string[];
  startingHand?: string;
  street?: string;
  position?: string;
  gameFormat?: string;
  effectiveStackBB?: number;
  potBB?: number;
  spr?: number;
  /** Raw percentage rendered by the source question. This field alone is not a call threshold. */
  potOddsPercent?: number;
  /** Only populated when the current decision actually offers Call and the shown pot odds can be interpreted as a facing-call price. */
  minimumCallingEquityPercent?: number;
  heroEquityPercent?: number;
  selectedAction?: string;
  bestAction?: string;
  truthTier?: string;
  truthSource?: string;
  villainRange?: string;
  heroRange?: string;
}

export interface ExtractedDecisionMathContext {
  potOddsPercent?: number;
  minimumCallingEquityPercent?: number;
  heroEquityPercent?: number;
}

const SUIT_TO_CODE: Record<Suit, string> = { clubs: 'c', diamonds: 'd', hearts: 'h', spades: 's' };
const CODE_TO_SUIT: Record<string, Suit> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' };
const RANK_ORDER = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export function cardToCode(card: Card): string {
  return `${card.rank}${SUIT_TO_CODE[card.suit]}`;
}

export function codeToCard(code: string): Card | null {
  const match = code.trim().match(/^([2-9TJQKA])([cdhs])$/i);
  if (!match) return null;
  return { rank: match[1].toUpperCase() as Rank, suit: CODE_TO_SUIT[match[2].toLowerCase()] };
}

export function startingHandFromCodes(codes: string[]): string | undefined {
  const cards = codes.map(codeToCard).filter((card): card is Card => Boolean(card));
  if (cards.length !== 2) return undefined;
  const [left, right] = cards;
  if (left.rank === right.rank) return `${left.rank}${right.rank}`;
  const leftIndex = RANK_ORDER.indexOf(left.rank);
  const rightIndex = RANK_ORDER.indexOf(right.rank);
  const high = leftIndex < rightIndex ? left.rank : right.rank;
  const low = leftIndex < rightIndex ? right.rank : left.rank;
  return `${high}${low}${left.suit === right.suit ? 's' : 'o'}`;
}

function numberFrom(text: string, pattern: RegExp): number | undefined {
  const match = text.match(pattern);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Extract only math that the rendered decision can semantically prove.
 * A raw `Pot Odds N%` token becomes a minimum call-equity threshold only when
 * the decision surface itself exposes a Call option. This prevents Check/Bet
 * exercises from being reinterpreted as facing-bet call geometry.
 */
export function extractDecisionMathContext(text: string, actionLabels: string[]): ExtractedDecisionMathContext {
  const potOddsPercent = numberFrom(text, /Pot Odds\s*([0-9]+(?:\.[0-9]+)?)\s*%/i);
  const heroEquityPercent = numberFrom(text, /Hero\s+(?:showdown\s+)?Equity\s*(?:=|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*%/i);
  const hasCallOption = actionLabels.some(label => /^(?:call(?:\s|$)|跟注(?:\s|$))/i.test(label.trim()));
  return {
    potOddsPercent,
    minimumCallingEquityPercent: hasCallOption ? potOddsPercent : undefined,
    heroEquityPercent,
  };
}

function latestHistoryItem(): Record<string, unknown> | undefined {
  try {
    const items = JSON.parse(localStorage.getItem('poker_training_history_v6') || '[]');
    return Array.isArray(items) ? items.at(-1) : undefined;
  } catch {
    return undefined;
  }
}

function codesWithin(element: Element | null): string[] {
  if (!element) return [];
  return Array.from(element.querySelectorAll<HTMLElement>('[data-card-code]'))
    .map(node => node.dataset.cardCode || '')
    .filter(Boolean);
}

export function captureCurrentAnalysisContext(doc: Document = document): AnalysisContext | null {
  const session = doc.querySelector('[data-testid="solver-decision-session"], [data-testid="frictionless-training-session"]');
  if (!session) return null;
  const history = latestHistoryItem();
  const solverHole = codesWithin(session.querySelector('[data-testid="solver-hole-cards"]'));
  const solverBoard = codesWithin(session.querySelector('[data-testid="solver-board-cards"]'));
  const allCards = codesWithin(session);
  const heroCards = solverHole.length === 2 ? solverHole : allCards.slice(-2);
  const boardCards = solverHole.length === 2 ? solverBoard : allCards.slice(0, Math.max(0, allCards.length - 2));
  const text = session.textContent || '';
  const actionLabels = Array.from(session.querySelectorAll<HTMLElement>('[data-testid="decision-action"], [data-testid="solver-action"]'))
    .map(node => node.textContent?.trim() || '')
    .filter(Boolean);
  const decisionMath = extractDecisionMathContext(text, actionLabels);
  const trainingType = typeof history?.trainingType === 'string' ? history.trainingType : undefined;
  const source: AnalysisContext['source'] = trainingType === 'solver-corpus' ? 'pokerbench' : trainingType === 'scenario' ? 'scenario' : 'unknown';
  return {
    schemaVersion: 1,
    capturedAt: Date.now(),
    source,
    trainingType,
    scenarioId: typeof history?.scenarioId === 'string' ? history.scenarioId : undefined,
    datasetRowId: typeof history?.datasetRowId === 'string' ? history.datasetRowId : undefined,
    title: typeof history?.questionLabel === 'string' ? history.questionLabel : undefined,
    heroCards,
    boardCards,
    startingHand: startingHandFromCodes(heroCards),
    street: typeof history?.street === 'string' ? history.street : undefined,
    position: typeof history?.position === 'string' ? history.position : undefined,
    gameFormat: typeof history?.gameFormat === 'string' ? history.gameFormat : undefined,
    effectiveStackBB: numberFrom(text, /Effective\s*([0-9]+(?:\.[0-9]+)?)\s*BB/i),
    potBB: numberFrom(text, /Pot\s*([0-9]+(?:\.[0-9]+)?)\s*BB/i),
    spr: numberFrom(text, /SPR\s*([0-9]+(?:\.[0-9]+)?)/i),
    ...decisionMath,
    selectedAction: typeof history?.selectedAction === 'string' ? history.selectedAction : undefined,
    bestAction: typeof history?.bestAction === 'string' ? history.bestAction : undefined,
    truthTier: typeof history?.truthTier === 'string' ? history.truthTier : undefined,
    truthSource: typeof history?.truthSourceRef === 'string' ? history.truthSourceRef : typeof history?.truthSourceId === 'string' ? history.truthSourceId : undefined,
  };
}

export function analysisContextHref(route: string, context?: AnalysisContext | null): string {
  if (!context) return route;
  return `${route}?ctx=${encodeURIComponent(JSON.stringify(context))}`;
}

export function analysisRouteFromHash(hash: string): string {
  return hash.split('?')[0];
}

export function readAnalysisContextFromHash(hash = window.location.hash): AnalysisContext | null {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  if (!query) return null;
  const raw = new URLSearchParams(query).get('ctx');
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as AnalysisContext;
    return value?.schemaVersion === 1 && Array.isArray(value.heroCards) && Array.isArray(value.boardCards) ? value : null;
  } catch {
    return null;
  }
}

export function prettyCardCode(code: string): string {
  const match = code.match(/^([2-9TJQKA])([cdhs])$/i);
  if (!match) return code;
  const suit = { c: '♣', d: '♦', h: '♥', s: '♠' }[match[2].toLowerCase() as 'c' | 'd' | 'h' | 's'];
  return `${match[1].toUpperCase()}${suit}`;
}
