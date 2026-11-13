import type { ActionType, Feedback, Scenario, UtilityModel, UtilityUnit } from '../types';
import { calculateHeadsUpIcmRisk, calculateHeadsUpPkoRisk, type IcmPlayer } from '../tournament/icm';

type Model = 'chip' | 'icm' | 'satellite' | 'pko';
interface ExerciseInput {
  key: string;
  model: Model;
  stage: string;
  stacks: number[];
  payouts: number[];
  risk: number;
  equity: number;
  bounty?: number;
  cashFraction?: number;
  tableSize?: '6max' | '9max';
}

const MODEL_NAMES: Record<Model, string> = { chip: 'MTT Chip-EV', icm: 'Regular ICM', satellite: 'Satellite 席位', pko: 'PKO 即時賞金' };
const MODEL_IDS: Record<Model, UtilityModel> = { chip: 'tournament-chip-ev', icm: 'icm', satellite: 'satellite', pko: 'pko' };
const COMMON_ASSUMPTIONS = '這是對稱風險的數學比較：Fold 表示拒絕風險、維持列出的初始 stacks；Call 表示雙方各承擔 R，Hero 勝時 H+R/V−R，負時 H−R/V+R。沒有既有底池、盲注、ante、平手或後續下注；其他玩家 stacks 不變。';

function makeExercise(input: ExerciseInput, role: 'training' | 'holdout'): Scenario {
  const players: IcmPlayer[] = input.stacks.map((stack, index) => ({ id: index === 0 ? 'H' : index === 1 ? 'V' : `P${index + 1}`, stack }));
  const common = { players, payouts: input.payouts, heroId: 'H', villainId: 'V', amountAtRisk: input.risk, showdownEquity: input.equity };
  const result = calculateHeadsUpIcmRisk(common);
  const pko = input.model === 'pko' ? calculateHeadsUpPkoRisk({ ...common, villainBountyValue: input.bounty || 0, bountyCashFraction: input.cashFraction ?? .5 }) : undefined;
  const chip = input.model === 'chip';
  const fold = chip ? input.stacks[0] : result.foldEquity;
  const call = chip ? input.stacks[0] + (2 * input.equity - 1) * input.risk : pko?.pkoCallEquity ?? result.callEquity;
  const best: ActionType = call > fold ? 'Call' : 'Fold';
  const bestUtility = Math.max(fold, call);
  const unit: UtilityUnit = chip ? 'bb' : input.model === 'satellite' ? 'seat-equity' : 'dollar-ev';
  const unitLabel = chip ? 'tournament chips BB' : input.model === 'satellite' ? '席位機率' : '$';
  const threshold = chip ? .5 : (pko?.pkoBreakEvenPercent ?? result.icmBreakEvenPercent) / 100;
  const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
  const number = (value: number) => value.toFixed(4);
  const stackText = players.map(player => `${player.id}=${player.stack}BB`).join('、');
  const payoutText = input.payouts.map((payout, index) => `第${index + 1}名=${payout}${input.model === 'satellite' ? '張等值門票' : '$'}`).join('、');
  const utilityAssumption = chip
    ? '本題只最大化期望籌碼；列出的獎金不參與 Chip-EV 決策，不衡量真實賽事 $EV。'
    : input.model === 'satellite'
      ? '等值門票以 ICM 模型計算席位機率；忽略位置、技術優勢與未來盲注壓力，不假設 FGS。'
      : input.model === 'pko'
        ? `ICM 主獎金 + 本次可立即取得的賞金；V 賞金面額 ${input.bounty || 0}$，立即支付比例 ${pct(input.cashFraction ?? .5)}；只有本次能淘汰 V 才領取。未立即支付部分與未來賞金、Hero 自己賞金的策略價值均不計，因此不是完整 PKO solver。`
        : '用標準 ICM 將籌碼映射為主獎金期望；假設同等技術、沒有位置/未來盲注差異，不建模 FGS。';
  const explanation = chip
    ? `Fold=${number(fold)} BB；Call=H+(2×equity−1)×R=${number(call)} BB。`
    : `Fold=${number(fold)} ${unitLabel}；勝分支=${number(result.winEquity)}、負分支=${number(result.loseEquity)} ${unitLabel}。Call=${pct(input.equity)}×勝分支+${pct(1 - input.equity)}×負分支${input.model === 'pko' ? ' + 可立即領取的賞金 EV' : ''}=${number(call)} ${unitLabel}。`;
  const reversal = `只改題目給定的攤牌 equity：固定其他輸入時，跨過 ${pct(threshold)} 的門檻，Call/Fold 的偏好會反轉；這是指定風險模型的門檻，不是某手牌的 solver range。`;
  const feedback = (action: 'Fold' | 'Call', value: number): Feedback => ({
    judgment: action === best ? '正確' : '錯誤', score: action === best ? 10 : 2, bestAction: best,
    why: `${explanation} 本模型選擇較高的 ${unitLabel}；${best} 較高。${utilityAssumption}`,
    conceptualError: action === best ? '無' : `沒有在本題指定的 ${MODEL_NAMES[input.model]} 效用中比較兩個分支。`,
    remember: '先確定效用模型與全部籌碼/獎金，再用題目明示的 equity 比較；不能把這個條件答案當作通用推跟範圍。',
    nextStepId: 'next_hand',
    evidence: {
      sourceConfidence: 'exact-math', objective: `${MODEL_NAMES[input.model]}：${explanation} ${utilityAssumption}`,
      actionUtility: value, bestUtility, utilityLoss: Math.max(0, bestUtility - value), utilityUnit: unit, utilityModel: MODEL_IDS[input.model],
      reversals: [reversal],
    },
  });
  const id = `mtt-${role === 'training' ? 'train' : 'eval'}-${input.key}`;
  return {
    id, decisionFamilyId: id,
    title: `${MODEL_NAMES[input.model]} · 條件風險比較`,
    type: 'Tournament', difficulty: chip ? '新手' : '進階',
    category: ['MTT Exact Math', MODEL_NAMES[input.model], input.stage],
    blinds: '數學模型：無 forced bets', ante: false, tourneyInfo: `${input.stage}。完整剩餘名單與獎金列於題目。`,
    userStack: `${input.stacks[0]}BB`, userBB: input.stacks[0], position: 'BB',
    holeCards: [{ rank: 'A', suit: 'clubs' }, { rank: 'Q', suit: 'spades' }],
    preAction: `${MODEL_NAMES[input.model]}；完整剩餘 stacks：${stackText}。完整獎金：${payoutText}；其餘名次=0。`,
    effectiveStack: `${Math.min(input.stacks[0], input.stacks[1])}BB`, tableSize: input.tableSize || '6max', benchmarkRole: role,
    situationIds: ['format.mtt', `utility.${MODEL_IDS[input.model]}`, 'math.tournament-risk', `stage.${input.stage}`],
    steps: [{
      id: 'utility-comparison', street: 'River',
      communityCards: [{ rank: 'K', suit: 'diamonds' }, { rank: '9', suit: 'hearts' }, { rank: '6', suit: 'clubs' }, { rank: '4', suit: 'spades' }, { rank: '2', suit: 'diamonds' }],
      potSize: 2 * input.risk, potLabel: '雙方風險合計',
      description: `風險 R=${input.risk}BB；給定 Hero 攤牌 equity=${pct(input.equity)}。${COMMON_ASSUMPTIONS} 雙方風險合計=${2 * input.risk}BB，並非既有底池。牌面只是示意，equity 已精確給定，不從牌面反推。${utilityAssumption} 在這些條件下應選 Fold 或 Call？`,
      options: ['Fold', 'Call'], assumptions: [COMMON_ASSUMPTIONS, utilityAssumption, '本題是給定 equity 的效用算術，不提供手牌範圍或求解器策略。'],
      strategySource: 'Exact conditional tournament utility arithmetic from fully stated stacks, payouts, risk and showdown equity.',
      conceptIds: ['math.equity', 'decision.boundary', 'tournament.utility', `tournament.${input.model}`],
      feedbacks: { Fold: feedback('Fold', fold), Call: feedback('Call', call) },
    }],
  };
}

const TRAINING_INPUTS: ExerciseInput[] = [
  { key: 'chip-1', model: 'chip', stage: '中期', stacks: [20, 30, 10], payouts: [60, 30, 10], risk: 20, equity: .55 },
  { key: 'chip-2', model: 'chip', stage: '中期', stacks: [15, 35, 20, 10], payouts: [50, 30, 20], risk: 15, equity: .46, tableSize: '9max' },
  { key: 'icm-1', model: 'icm', stage: '單挑', stacks: [10, 10], payouts: [60, 40], risk: 10, equity: .55 },
  { key: 'icm-2', model: 'icm', stage: '單挑', stacks: [15, 15], payouts: [70, 30], risk: 15, equity: .47 },
  { key: 'icm-3', model: 'icm', stage: '泡沫', stacks: [20, 40, 5, 15], payouts: [50, 30, 20], risk: 20, equity: .60, tableSize: '9max' },
  { key: 'icm-4', model: 'icm', stage: '決賽桌', stacks: [20, 30, 10], payouts: [70, 20, 10], risk: 20, equity: .70 },
  { key: 'satellite-1', model: 'satellite', stage: '衛星泡沫', stacks: [10, 10, 1], payouts: [1, 1], risk: 10, equity: .60 },
  { key: 'satellite-2', model: 'satellite', stage: '衛星短碼', stacks: [2, 20, 10], payouts: [1, 1], risk: 2, equity: .65, tableSize: '9max' },
  { key: 'pko-1', model: 'pko', stage: '賞金', stacks: [10, 10], payouts: [60, 40], risk: 10, equity: .45, bounty: 8, cashFraction: .5 },
  { key: 'pko-2', model: 'pko', stage: '賞金', stacks: [12, 12], payouts: [60, 40], risk: 12, equity: .35, bounty: 8, cashFraction: .5 },
  { key: 'pko-3', model: 'pko', stage: '賞金覆蓋', stacks: [20, 10, 15], payouts: [60, 30, 10], risk: 10, equity: .60, bounty: 20, cashFraction: .5, tableSize: '9max' },
  { key: 'pko-4', model: 'pko', stage: '賞金未覆蓋', stacks: [10, 20, 15], payouts: [60, 30, 10], risk: 10, equity: .50, bounty: 100, cashFraction: .5 },
];

const EVALUATION_INPUTS: ExerciseInput[] = [
  { key: 'chip-1', model: 'chip', stage: '中期', stacks: [18, 27, 13], payouts: [65, 25, 10], risk: 18, equity: .53 },
  { key: 'chip-2', model: 'chip', stage: '中期', stacks: [23, 31, 7, 19], payouts: [55, 30, 15], risk: 23, equity: .48, tableSize: '9max' },
  { key: 'icm-1', model: 'icm', stage: '泡沫', stacks: [18, 38, 4, 12], payouts: [55, 28, 17], risk: 18, equity: .59 },
  { key: 'icm-2', model: 'icm', stage: '決賽桌', stacks: [17, 29, 9], payouts: [75, 18, 7], risk: 17, equity: .72, tableSize: '9max' },
  { key: 'satellite-1', model: 'satellite', stage: '衛星泡沫', stacks: [14, 14, 2], payouts: [1, 1], risk: 14, equity: .67 },
  { key: 'satellite-2', model: 'satellite', stage: '衛星短碼', stacks: [3, 24, 13], payouts: [1, 1], risk: 3, equity: .68, tableSize: '9max' },
  { key: 'pko-1', model: 'pko', stage: '賞金覆蓋', stacks: [16, 16], payouts: [64, 36], risk: 16, equity: .46, bounty: 12, cashFraction: .5 },
  { key: 'pko-2', model: 'pko', stage: '賞金未覆蓋', stacks: [13, 26, 11], payouts: [65, 27, 8], risk: 13, equity: .49, bounty: 80, cashFraction: .5, tableSize: '9max' },
];

/** Separate numeric situations; evaluation scenarios never enter the practice catalogue. */
export const tournamentTrainingScenarios: Scenario[] = TRAINING_INPUTS.map(input => makeExercise(input, 'training'));
export const tournamentEvaluationScenarios: Scenario[] = EVALUATION_INPUTS.map(input => makeExercise(input, 'holdout'));

/** Fresh exact conditional utility problems; never added to the training catalog. */
export function buildTournamentEvaluationScenarios(startIndex = 0, count = 32): Scenario[] {
  const start = Math.max(0, Math.trunc(startIndex));
  return Array.from({ length: Math.max(0, Math.trunc(count)) }, (_, offset) => {
    const index = start + offset;
    const cycle = (modulus: number, multiplier: number, shift = 0) => ((index % modulus) * multiplier + shift) % modulus;
    const model = (['chip', 'icm', 'satellite', 'pko'] as const)[index % 4];
    const hero = (1000 + cycle(997, 619) * 4) / 100;
    const villain = model === 'pko' ? hero : (1500 + cycle(991, 487) * 4) / 100;
    const stacks = [hero, villain, (150 + cycle(983, 337)) / 100];
    const risk = Math.min(hero, villain);
    const payouts = model === 'satellite' ? [1, 1] : [55 + cycle(31, 11), 25 + cycle(13, 5), 0];
    const bounty = model === 'pko' ? 4 + cycle(29, 7) : undefined;
    const players = stacks.map((stack, i) => ({ id: i === 0 ? 'H' : i === 1 ? 'V' : 'P3', stack }));
    const input = { players, payouts, heroId:'H', villainId:'V', amountAtRisk:risk, showdownEquity:.5 };
    const threshold = model === 'chip' ? .5 : model === 'pko'
      ? calculateHeadsUpPkoRisk({ ...input, villainBountyValue:bounty!, bountyCashFraction:.5 }).pkoBreakEvenPercent / 100
      : calculateHeadsUpIcmRisk(input).icmBreakEvenPercent / 100;
    let hash = (index >>> 0) ^ Math.imul(Math.floor(index / 0x100000000), 0x9e3779b1);
    hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
    hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
    hash ^= hash >>> 16;
    const direction = (hash & 1) ? 1 : -1;
    // Quantize before deriving truth: all visible inputs are exact inputs to the model.
    const equity = Math.max(.0001, Math.min(.9999, Math.round((threshold + direction * (125 + cycle(173, 71)) / 10000) * 10000) / 10000));
    return makeExercise({ key:`generated-${index + 1}`, model, stage:model === 'satellite' ? '衛星泡沫' : model === 'pko' ? '賞金覆蓋' : '效用比較', stacks, payouts, risk, equity, bounty, cashFraction:.5, tableSize:Math.floor(index / 4) % 2 ? '9max' : '6max' }, 'holdout');
  });
}
