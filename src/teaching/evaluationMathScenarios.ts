import type { ActionType, Card, Feedback, Scenario } from '../types';

const HERO: Card[] = [{ rank: 'A', suit: 'clubs' }, { rank: 'Q', suit: 'spades' }];
const BOARD: Card[] = [
  { rank: 'K', suit: 'diamonds' },
  { rank: '9', suit: 'hearts' },
  { rank: '6', suit: 'clubs' },
  { rank: '4', suit: 'spades' },
  { rank: '2', suit: 'diamonds' },
];

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function exactFeedback(
  bestAction: ActionType,
  action: ActionType,
  why: string,
  actionEvBB: number,
  bestEvBB: number,
  reversal: string,
): Feedback {
  const correct = action === bestAction;
  return {
    judgment: correct ? '正確' : '錯誤',
    score: correct ? 10 : 2,
    bestAction,
    why,
    conceptualError: correct ? '無；你用精確價格門檻做決策。' : '沒有用題目給定的 equity 與 call price 做 break-even 比較。',
    remember: '面對跟注價格：break-even equity = C/(P+C)。只比較給定 equity 與這個門檻。',
    nextStepId: 'next_hand',
    evidence: {
      objective: 'Exact cash-game pot-odds arithmetic from stated pot, call cost and showdown equity.',
      actionEvBB: round(actionEvBB),
      bestEvBB: round(bestEvBB),
      evLossBB: round(bestEvBB - actionEvBB),
      sourceConfidence: 'exact-math',
      reversals: [reversal],
    },
  };
}

function sequenceValue(index: number, modulus: number, multiplier: number, offset = 0): number {
  const normalized = Math.abs(Math.trunc(index)) % modulus;
  return (Math.imul(normalized, multiplier) + offset) % modulus;
}

function mixedIndexBit(index: number): number {
  const normalized = Math.max(0, Math.trunc(index));
  const low = normalized >>> 0;
  const high = Math.floor(normalized / 0x100000000) >>> 0;
  let hash = (low ^ Math.imul(high, 0x9e3779b1)) >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b) >>> 0;
  hash ^= hash >>> 16;
  return hash & 1;
}

function evaluationPotOddsScenario(index: number): Scenario {
  // Large coprime cycles keep the generated cash-BB inputs realistic while supplying
  // a practical lifetime of fresh exact-math variants. Every displayed input is
  // quantized before EV is calculated, so the visible problem is the exact truth source.
  const potBeforeCall = (800 + sequenceValue(index, 997, 619) * 4) / 100;
  const callCost = (150 + sequenceValue(index, 991, 487, 31)) / 100;
  const breakEven = callCost / (potBeforeCall + callCost);
  // Correct-action direction is derived from an avalanche-mixed hidden index bit rather
  // than sequence parity, so no displayed/order identifier can act as an answer key.
  const direction = mixedIndexBit(index) === 0 ? -1 : 1;
  const marginBps = 125 + (sequenceValue(index, 983, 337, 17) % 176);
  const breakEvenBps = Math.round(breakEven * 10000);
  const equityBps = Math.max(500, Math.min(9000, breakEvenBps + direction * marginBps));
  const equity = equityBps / 10000;
  const callEv = equity * (potBeforeCall + callCost) - callCost;
  const bestAction: ActionType = callEv >= 0 ? 'Call' : 'Fold';
  const bestEvBB = Math.max(0, callEv);
  const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
  const why = callEv >= 0
    ? `Given equity ${pct(equity)} is above break-even ${pct(breakEven)}; Call EV = +${callEv.toFixed(3)}BB.`
    : `Given equity ${pct(equity)} is below break-even ${pct(breakEven)}; Call EV = ${callEv.toFixed(3)}BB while Fold EV = 0BB.`;
  const reversal = `若 showdown equity 跨過 ${pct(breakEven)}，最佳動作會在 Fold / Call 之間反轉。`;
  const sequence = Math.max(0, Math.trunc(index)) + 1;

  return {
    id: `eval-math-pot-odds-${sequence}`,
    decisionFamilyId: `eval-math-pot-odds-${sequence}`,
    title: `Hidden Exact EV · Equity ${pct(equity)} vs ${pct(breakEven)}`,
    category: ['Exact Math', 'Pot Odds', 'River', 'Hidden Evaluation'],
    difficulty: sequenceValue(index, 7, 5) < 3 ? '中階' : '進階',
    type: 'Cash Game',
    blinds: '1/2',
    ante: false,
    userStack: '100BB',
    userBB: 100,
    position: 'BB',
    holeCards: HERO.map(card => ({ ...card })),
    preAction: `River pot ${potBeforeCall.toFixed(2)}BB；Villain 的動作讓 Hero 需再付 ${callCost.toFixed(2)}BB。題目直接給定 showdown equity = ${pct(equity)}。`,
    effectiveStack: '100BB',
    tableSize: '6max',
    benchmarkRole: 'holdout',
    situationIds: ['format.cash', 'street.river', 'math.pot-odds', 'evaluation.exact-ev'],
    steps: [{
      id: 'river-call',
      street: 'River',
      communityCards: BOARD.map(card => ({ ...card })),
      description: `Pot before call ${potBeforeCall.toFixed(2)}BB · Call ${callCost.toFixed(2)}BB · Given equity ${pct(equity)}。`,
      potSize: potBeforeCall,
      potOdds: pct(breakEven),
      options: ['Fold', 'Call'],
      assumptions: ['Showdown equity 是題目提供的精確輸入。', 'Fold 的增量 EV = 0BB。', '此題只存在於 Hidden Exam evaluation generator，不進正常 training pool。'],
      strategySource: 'Exact arithmetic from stated pot, call cost and equity; isolated evaluation generator.',
      conceptIds: ['math.pot-odds', 'math.equity', 'decision.boundary'],
      feedbacks: {
        Fold: exactFeedback(bestAction, 'Fold', why, 0, bestEvBB, reversal),
        Call: exactFeedback(bestAction, 'Call', why, callEv, bestEvBB, reversal),
      },
    }],
  };
}

export function buildExactMathEvaluationScenarios(startIndex = 0, count = 16): Scenario[] {
  const start = Math.max(0, Math.trunc(startIndex));
  const size = Math.max(0, Math.trunc(count));
  return Array.from({ length: size }, (_, offset) => evaluationPotOddsScenario(start + offset));
}

// Stable seed bank kept for regression/audit. Production Hidden Exam requests a fresh
// deterministic block per exam snapshot through buildExactMathEvaluationScenarios(...).
export const exactMathEvaluationScenarios: Scenario[] = buildExactMathEvaluationScenarios(0, 16);
