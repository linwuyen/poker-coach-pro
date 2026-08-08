import { PlayerProfile, Scenario } from '../types';

export interface BenchmarkSplit {
  training: Scenario[];
  holdout: Scenario[];
}

const AUTO_HOLDOUT_MIN_BANK = 20;

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function isHiddenBenchmarkScenario(scenario: Scenario): boolean {
  if (scenario.benchmarkRole === 'holdout') return true;
  if (scenario.benchmarkRole === 'training') return false;
  return stableHash(scenario.id) % 10 === 0;
}

export function splitBenchmarkScenarios(scenarios: Scenario[]): BenchmarkSplit {
  const explicitHoldout = scenarios.filter(scenario => scenario.benchmarkRole === 'holdout');
  if (explicitHoldout.length) {
    const ids = new Set(explicitHoldout.map(scenario => scenario.id));
    return { training: scenarios.filter(scenario => !ids.has(scenario.id)), holdout: explicitHoldout };
  }
  if (scenarios.length < AUTO_HOLDOUT_MIN_BANK) return { training: scenarios, holdout: [] };
  const holdout = scenarios.filter(scenario => scenario.benchmarkRole !== 'training' && stableHash(scenario.id) % 10 === 0);
  const training = scenarios.filter(scenario => !holdout.some(hidden => hidden.id === scenario.id));
  if (holdout.length) return { training, holdout };
  const fallback = [...scenarios].sort((a, b) => stableHash(a.id) - stableHash(b.id));
  return { training: fallback.slice(1), holdout: fallback.slice(0, 1) };
}

export function getHiddenBenchmarkScenarios(scenarios: Scenario[], _profile?: PlayerProfile): Scenario[] {
  return splitBenchmarkScenarios(scenarios).holdout;
}

export function getTrainingScenarios(scenarios: Scenario[]): Scenario[] {
  return splitBenchmarkScenarios(scenarios).training;
}
