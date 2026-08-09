export interface StrategyDistanceResult {
  totalVariation: number;
  similarity: number;
  largestDeviation?: { action: string; delta: number };
}

export type StrategyVector = Record<string, number>;

export function normalizeStrategyVector(input: StrategyVector): StrategyVector {
  const entries = Object.entries(input).map(([action, value]) => [action, Math.max(0, Number.isFinite(value) ? value : 0)] as const);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return Object.fromEntries(entries.map(([action]) => [action, 0]));
  return Object.fromEntries(entries.map(([action, value]) => [action, value / total]));
}

export function strategyDistance(targetInput: StrategyVector, chosenInput: StrategyVector): StrategyDistanceResult {
  const actions = [...new Set([...Object.keys(targetInput), ...Object.keys(chosenInput)])].sort();
  const target = normalizeStrategyVector(Object.fromEntries(actions.map(action => [action, targetInput[action] || 0])));
  const chosen = normalizeStrategyVector(Object.fromEntries(actions.map(action => [action, chosenInput[action] || 0])));
  const deviations = actions.map(action => ({ action, delta: Math.abs((target[action] || 0) - (chosen[action] || 0)) }));
  const totalVariation = Math.min(1, deviations.reduce((sum, item) => sum + item.delta, 0) / 2);
  const largestDeviation = deviations.sort((a, b) => b.delta - a.delta || a.action.localeCompare(b.action))[0];
  return {
    totalVariation,
    similarity: Math.round((1 - totalVariation) * 1000) / 10,
    largestDeviation: largestDeviation && largestDeviation.delta > 0 ? largestDeviation : undefined,
  };
}

export function oneHotStrategy(actions: string[], selected: string): StrategyVector {
  return Object.fromEntries(actions.map(action => [action, action === selected ? 1 : 0]));
}

export function expectedStrategyEv(strategyInput: StrategyVector, actionEv: Record<string, number | undefined>): number | undefined {
  const strategy = normalizeStrategyVector(strategyInput);
  const weighted = Object.entries(strategy).filter(([, frequency]) => frequency > 0);
  if (!weighted.length || weighted.some(([action]) => !Number.isFinite(actionEv[action]))) return undefined;
  return weighted.reduce((sum, [action, frequency]) => sum + frequency * (actionEv[action] as number), 0);
}

export function strategyEvRegret(targetInput: StrategyVector, chosenInput: StrategyVector, actionEv: Record<string, number | undefined>): number | undefined {
  const targetEv = expectedStrategyEv(targetInput, actionEv);
  const chosenEv = expectedStrategyEv(chosenInput, actionEv);
  if (targetEv === undefined || chosenEv === undefined) return undefined;
  return Math.max(0, targetEv - chosenEv);
}
