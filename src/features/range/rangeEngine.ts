import {
  EquityBand, HeroAction, RangeCalculation, RangeQuestion, WeightedRangeSelection,
} from './types';

export const EQUITY_BANDS: Array<{ id: EquityBand; label: string; min: number; max: number }> = [
  { id: 'under-30', label: '< 30%', min: 0, max: 29.999 },
  { id: '30-39', label: '30–39%', min: 30, max: 39.999 },
  { id: '40-49', label: '40–49%', min: 40, max: 49.999 },
  { id: '50-59', label: '50–59%', min: 50, max: 59.999 },
  { id: '60-plus', label: '≥ 60%', min: 60, max: 100 },
];

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const round = (value: number, digits = 2): number => {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
};

export function baselineSelections(question: RangeQuestion): WeightedRangeSelection[] {
  return question.options.map(option => ({ hand: option.hand, frequency: option.baselineFrequency }));
}

export function calculateRangeDecision(
  question: RangeQuestion,
  selections: WeightedRangeSelection[],
): RangeCalculation {
  const frequencyByHand = new Map(selections.map(item => [item.hand, clamp01(item.frequency)]));
  let weightedCombos = 0;
  let weightedEquity = 0;

  question.options.forEach(option => {
    const frequency = frequencyByHand.get(option.hand) || 0;
    const weight = option.combos * frequency;
    weightedCombos += weight;
    weightedEquity += weight * option.heroEquity;
  });

  const heroEquity = weightedCombos > 0 ? weightedEquity / weightedCombos : 0;
  const potOdds = question.callCost / (question.potAfterBet + question.callCost) * 100;
  const callEvBB = heroEquity / 100 * (question.potAfterBet + question.callCost) - question.callCost;
  const bestAction: HeroAction = callEvBB >= 0 ? 'call' : 'fold';

  return {
    weightedCombos: round(weightedCombos),
    heroEquity: round(heroEquity),
    potOdds: round(potOdds),
    callEvBB: round(callEvBB, 3),
    foldEvBB: 0,
    bestAction,
  };
}

export function scoreRangeConstruction(
  question: RangeQuestion,
  selections: WeightedRangeSelection[],
): number {
  const frequencyByHand = new Map(selections.map(item => [item.hand, clamp01(item.frequency)]));
  let intersection = 0;
  let union = 0;
  question.options.forEach(option => {
    const selected = frequencyByHand.get(option.hand) || 0;
    intersection += option.combos * Math.min(selected, option.baselineFrequency);
    union += option.combos * Math.max(selected, option.baselineFrequency);
  });
  return union > 0 ? Math.round(intersection / union * 100) : 0;
}

export function equityBandFor(equity: number): EquityBand {
  return EQUITY_BANDS.find(band => equity >= band.min && equity <= band.max)?.id || '60-plus';
}

export function scoreEquityBand(selected: EquityBand | null, equity: number): number {
  if (!selected) return 0;
  const target = equityBandFor(equity);
  const selectedIndex = EQUITY_BANDS.findIndex(band => band.id === selected);
  const targetIndex = EQUITY_BANDS.findIndex(band => band.id === target);
  if (selectedIndex === targetIndex) return 100;
  return Math.abs(selectedIndex - targetIndex) === 1 ? 50 : 0;
}

export function scorePotOddsEstimate(estimate: number | null, actual: number): number {
  if (estimate === null || !Number.isFinite(estimate)) return 0;
  const error = Math.abs(estimate - actual);
  if (error <= 1) return 100;
  if (error <= 3) return 80;
  if (error <= 5) return 50;
  if (error <= 8) return 20;
  return 0;
}

export function scoreAction(selected: HeroAction | null, best: HeroAction): number {
  return selected === best ? 100 : 0;
}

export function actionEvLossBB(selected: HeroAction | null, calculation: RangeCalculation): number {
  if (!selected || selected === calculation.bestAction) return 0;
  return calculation.bestAction === 'call'
    ? Math.max(0, calculation.callEvBB)
    : Math.max(0, -calculation.callEvBB);
}

export function getRangeBias(question: RangeQuestion, selections: WeightedRangeSelection[]): string {
  const selected = calculateRangeDecision(question, selections).weightedCombos;
  const baseline = question.options.reduce((sum, option) => sum + option.combos * option.baselineFrequency, 0);
  if (!baseline) return '無基準';
  const ratio = selected / baseline;
  if (ratio > 1.2) return '偏寬';
  if (ratio < 0.8) return '偏窄';
  return '接近基準';
}

export function validateRangeQuestions(questions: RangeQuestion[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  questions.forEach(question => {
    const prefix = `Range question ${question.id || '(missing id)'}`;
    if (!question.id.trim()) errors.push(`${prefix}: missing id`);
    if (ids.has(question.id)) errors.push(`${prefix}: duplicate id`);
    ids.add(question.id);
    if (!question.title.trim()) errors.push(`${prefix}: missing title`);
    if (!(question.potAfterBet > 0)) errors.push(`${prefix}: potAfterBet must be positive`);
    if (!(question.callCost > 0)) errors.push(`${prefix}: callCost must be positive`);
    if (!question.options.length) errors.push(`${prefix}: requires options`);

    const hands = new Set<string>();
    question.options.forEach(option => {
      if (hands.has(option.hand)) errors.push(`${prefix}: duplicate hand ${option.hand}`);
      hands.add(option.hand);
      if (!(option.combos > 0)) errors.push(`${prefix}/${option.hand}: combos must be positive`);
      if (option.heroEquity < 0 || option.heroEquity > 100) errors.push(`${prefix}/${option.hand}: heroEquity must be 0-100`);
      if (option.baselineFrequency < 0 || option.baselineFrequency > 1) errors.push(`${prefix}/${option.hand}: baselineFrequency must be 0-1`);
    });

    const baseline = calculateRangeDecision(question, baselineSelections(question));
    if (!(baseline.weightedCombos > 0)) errors.push(`${prefix}: baseline range is empty`);
    if (!(baseline.potOdds > 0 && baseline.potOdds < 100)) errors.push(`${prefix}: invalid pot odds`);
    if (!question.source.disclaimer.trim()) errors.push(`${prefix}: source disclaimer is required`);
    if (!question.assumptions.length) errors.push(`${prefix}: assumptions are required`);
  });

  return errors;
}
