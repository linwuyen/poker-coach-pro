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

function evaluationPotOddsScenario(index: number): Scenario {
  // Odd/quarter-BB inputs are deliberately disjoint from the training exact-math bank.
  const potBeforeCall = 9 + index * 1.25;
  const callCost = 2.25 + (index % 4) * 1.25;
  const breakEven = callCost / (potBeforeCall + callCost);
  const direction = index % 2 === 0 ? -1 : 1;
  const equity = Math.max(0.05, Math.min(0.9, breakEven + direction * (0.017 + (index % 3) * 0.005)));
  const callEv = equity * (potBeforeCall + callCost) - callCost;
  const bestAction: ActionType = callEv >= 0 ? 'Call' : 'Fold';
  const bestEvBB = Math.max(0, callEv);
  const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
  const why = callEv >= 0
    ? `Given equity ${pct(equity)} is above break-even ${pct(breakEven)}; Call EV = +${callEv.toFixed(3)}BB.`
    : `Given equity ${pct(equity)} is below break-even ${pct(breakEven)}; Call EV = ${callEv.toFixed(3)}BB while Fold EV = 0BB.`;
  const reversal = `若 showdown equity 跨過 ${pct(breakEven)}，最佳動作會在 Fold / Call 之間反轉。`;

  return {
    id: `eval-math-pot-odds-${index + 1}`,
    decisionFamilyId: `eval-math-pot-odds-${index + 1}`,
    title: `Hidden Exact EV #${index + 1} · Equity ${pct(equity)} vs ${pct(breakEven)}`,
    category: ['Exact Math', 'Pot Odds', 'River', 'Hidden Evaluation'],
    difficulty: index < 6 ? '中階' : '進階',
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
      assumptions: ['Showdown equity 是題目提供的精確輸入。', 'Fold 的增量 EV = 0BB。', '此題只存在於 Hidden Exam evaluation bank，不進正常 training pool。'],
      strategySource: 'Exact arithmetic from stated pot, call cost and equity; isolated evaluation bank.',
      conceptIds: ['math.pot-odds', 'math.equity', 'decision.boundary'],
      feedbacks: {
        Fold: exactFeedback(bestAction, 'Fold', why, 0, bestEvBB, reversal),
        Call: exactFeedback(bestAction, 'Call', why, callEv, bestEvBB, reversal),
      },
    }],
  };
}

export const exactMathEvaluationScenarios: Scenario[] = Array.from(
  { length: 16 },
  (_, index) => evaluationPotOddsScenario(index),
);
