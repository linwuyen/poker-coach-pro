import { ActionType, Card, Feedback, Scenario } from '../types';

const HERO: Card[] = [{ rank: 'A', suit: 'spades' }, { rank: 'J', suit: 'diamonds' }];
const RIVER_BOARD: Card[] = [
  { rank: 'K', suit: 'clubs' }, { rank: '8', suit: 'hearts' }, { rank: '5', suit: 'spades' }, { rank: '3', suit: 'diamonds' }, { rank: '2', suit: 'clubs' },
];
const BLUFF_HERO: Card[] = [{ rank: '7', suit: 'spades' }, { rank: '6', suit: 'spades' }];
const BLUFF_BOARD: Card[] = [
  { rank: 'A', suit: 'hearts' }, { rank: 'K', suit: 'diamonds' }, { rank: '9', suit: 'clubs' }, { rank: '4', suit: 'spades' }, { rank: '2', suit: 'hearts' },
];

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function feedback(
  bestAction: ActionType,
  action: ActionType,
  why: string,
  conceptualError: string,
  remember: string,
  objective: string,
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
    conceptualError: correct ? '無；你用可重算的門檻做決策。' : conceptualError,
    remember,
    nextStepId: 'next_hand',
    evidence: {
      objective,
      actionEvBB,
      bestEvBB,
      evLossBB: round(bestEvBB - actionEvBB),
      sourceConfidence: 'exact-math',
      reversals: [reversal],
    },
  };
}

function potOddsScenario(index: number): Scenario {
  const potBeforeCall = 8 + (index % 8) * 2;
  const callCost = 2 + (index % 4) * 1.5;
  const breakEven = callCost / (potBeforeCall + callCost);
  const offset = ((Math.floor(index / 4) % 2 === 0 ? -1 : 1) * (0.018 + (index % 3) * 0.006));
  const equity = Math.max(0.05, Math.min(0.9, breakEven + offset));
  const callEv = equity * (potBeforeCall + callCost) - callCost;
  const bestAction: ActionType = callEv >= 0 ? 'Call' : 'Fold';
  const bestEv = Math.max(0, callEv);
  const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
  const objective = `Exact pot-odds：Call EV = equity × (pot + call) − call = ${pct(equity)} × (${potBeforeCall.toFixed(1)} + ${callCost.toFixed(1)}) − ${callCost.toFixed(1)} = ${callEv.toFixed(3)}BB。`;
  const reversal = `若 Equity 跨過 break-even ${pct(breakEven)}，最佳動作會在 Fold / Call 之間反轉。`;
  const why = callEv >= 0
    ? `你的給定 Equity ${pct(equity)} 高於 ${pct(breakEven)} 的價格門檻，Call 的增量 EV 為 +${callEv.toFixed(3)}BB。`
    : `你的給定 Equity ${pct(equity)} 低於 ${pct(breakEven)} 的價格門檻，Call 的增量 EV 為 ${callEv.toFixed(3)}BB，Fold 保留 0。`;
  const conceptualError = `把「牌看起來不錯/很差」當成答案；這題唯一需要比較的是 Equity ${pct(equity)} 與 pot-odds ${pct(breakEven)}。`;
  const remember = `面對河牌跟注：先算 C/(P+C)。Equity 高於門檻才 Call；低於就 Fold。`;
  return {
    id: `math-pot-odds-${index + 1}`,
    decisionFamilyId: `math-pot-odds-${index + 1}`,
    title: `精確 Pot Odds #${index + 1} · Equity ${pct(equity)} vs 門檻 ${pct(breakEven)}`,
    category: ['Exact Math', 'Pot Odds', 'River', 'Decision Boundary'],
    difficulty: index < 12 ? '新手' : index < 24 ? '中階' : '進階',
    type: 'Cash Game',
    blinds: '1/2',
    ante: false,
    userStack: '100BB',
    userBB: 100,
    position: 'BB',
    holeCards: HERO.map(card => ({ ...card })),
    preAction: `River pot ${potBeforeCall.toFixed(1)}BB；Villain 的動作讓你需再付 ${callCost.toFixed(1)}BB。題目直接給定 Hero showdown equity = ${pct(equity)}。`,
    effectiveStack: '100BB',
    tableSize: '6max',
    benchmarkRole: 'training',
    situationIds: ['format.cash', 'street.river', 'math.pot-odds', `boundary.${bestAction.toLowerCase()}`],
    steps: [{
      id: 'river-call',
      street: 'River',
      communityCards: RIVER_BOARD.map(card => ({ ...card })),
      description: `Pot before call ${potBeforeCall.toFixed(1)}BB · Call ${callCost.toFixed(1)}BB · Given equity ${pct(equity)}。只做價格判斷。`,
      potSize: potBeforeCall,
      potOdds: pct(breakEven),
      options: ['Fold', 'Call'],
      assumptions: ['題目給定的 showdown equity 視為精確輸入；不從示例牌面反推 range/equity。', 'Fold 的增量 EV 定義為 0BB。'],
      strategySource: 'Exact arithmetic from the stated pot, call cost and equity.',
      conceptIds: ['math.pot-odds', 'math.equity', 'decision.boundary'],
      feedbacks: {
        Fold: feedback(bestAction, 'Fold', why, conceptualError, remember, objective, 0, bestEv, reversal),
        Call: feedback(bestAction, 'Call', why, conceptualError, remember, objective, round(callEv), bestEv, reversal),
      },
    }],
  };
}

function bluffScenario(index: number): Scenario {
  const fractions = [0.33, 0.5, 0.75, 1];
  const fraction = fractions[index % fractions.length];
  const pot = 8 + (index % 8) * 2;
  const bet = pot * fraction;
  const breakEvenFold = bet / (pot + bet);
  const offset = ((Math.floor(index / 4) % 2 === 0 ? -1 : 1) * (0.02 + (index % 3) * 0.008));
  const foldRate = Math.max(0.05, Math.min(0.9, breakEvenFold + offset));
  const bluffEv = foldRate * pot - (1 - foldRate) * bet;
  const betAction: ActionType = fraction <= 0.4 ? 'Bet small' : fraction <= 0.6 ? 'Bet half pot' : 'Bet big';
  const bestAction: ActionType = bluffEv >= 0 ? betAction : 'Check';
  const bestEv = Math.max(0, bluffEv);
  const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
  const objective = `Pure-bluff EV = fold% × pot − call% × bet = ${pct(foldRate)} × ${pot.toFixed(1)} − ${pct(1 - foldRate)} × ${bet.toFixed(1)} = ${bluffEv.toFixed(3)}BB。`;
  const reversal = `若 Villain fold rate 跨過 ${pct(breakEvenFold)}，這個 ${pct(fraction)} pot pure bluff 會在 Check / Bet 之間反轉。`;
  const why = bluffEv >= 0
    ? `給定 Fold rate ${pct(foldRate)} 高於 break-even ${pct(breakEvenFold)}，純詐唬有 +${bluffEv.toFixed(3)}BB 增量 EV。`
    : `給定 Fold rate ${pct(foldRate)} 低於 break-even ${pct(breakEvenFold)}，純詐唬為 ${bluffEv.toFixed(3)}BB；Check 的增量 EV 為 0。`;
  const conceptualError = `只看到「我沒有攤牌價值所以要 bluff」；純詐唬是否賺錢由下注尺寸與 fold rate 的 break-even 決定。`;
  const remember = `Pure bluff break-even fold% = B/(P+B)。對手棄得更多才下注，棄得更少就 Check。`;
  return {
    id: `math-pure-bluff-${index + 1}`,
    decisionFamilyId: `math-pure-bluff-${index + 1}`,
    title: `Pure Bluff 邊界 #${index + 1} · ${pct(fraction)} pot · Fold ${pct(foldRate)}`,
    category: ['Exact Math', 'Bluff', 'River', 'Bet Sizing', 'Decision Boundary'],
    difficulty: index < 12 ? '新手' : index < 24 ? '中階' : '進階',
    type: 'Cash Game',
    blinds: '1/2',
    ante: false,
    userStack: '100BB',
    userBB: 100,
    position: 'BTN',
    holeCards: BLUFF_HERO.map(card => ({ ...card })),
    preAction: `River checked to Hero。Pot ${pot.toFixed(1)}BB；題目指定 Hero 是 pure bluff，Villain 對 ${bet.toFixed(1)}BB bet 的 fold rate = ${pct(foldRate)}。`,
    effectiveStack: '100BB',
    tableSize: '6max',
    benchmarkRole: 'training',
    situationIds: ['format.cash', 'street.river', 'postflop.bluff', `size.${Math.round(fraction * 100)}`],
    steps: [{
      id: 'river-bluff',
      street: 'River',
      communityCards: BLUFF_BOARD.map(card => ({ ...card })),
      description: `Pot ${pot.toFixed(1)}BB · Bet ${bet.toFixed(1)}BB (${pct(fraction)} pot) · Given fold rate ${pct(foldRate)}。`,
      potSize: pot,
      options: ['Check', betAction],
      assumptions: ['Hero 被定義為 pure bluff：被 Call 時沒有 showdown win equity。', 'Villain 對此尺寸的 fold rate 為題目給定的精確輸入。', 'Check 的增量 EV 定義為 0BB。'],
      strategySource: 'Exact break-even bluff arithmetic from the stated pot, bet size and fold rate.',
      conceptIds: ['postflop.bluff', 'postflop.bet-sizing', 'decision.boundary'],
      feedbacks: {
        Check: feedback(bestAction, 'Check', why, conceptualError, remember, objective, 0, bestEv, reversal),
        [betAction]: feedback(bestAction, betAction, why, conceptualError, remember, objective, round(bluffEv), bestEv, reversal),
      },
    }],
  };
}

export const exactMathSemanticScenarios: Scenario[] = [
  ...Array.from({ length: 32 }, (_, index) => potOddsScenario(index)),
  ...Array.from({ length: 32 }, (_, index) => bluffScenario(index)),
];
