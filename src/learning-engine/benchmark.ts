import { PlayerProfile, Scenario } from '../types';
import { scenarioProfileScore } from '../domain/playerProfile';

export interface BenchmarkSplit {
  training: Scenario[];
  holdout: Scenario[];
}

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
  const holdout = scenarios.filter(isHiddenBenchmarkScenario);
  const training = scenarios.filter(scenario => !isHiddenBenchmarkScenario(scenario));
  if (holdout.length) return { training, holdout };
  if (scenarios.length <= 1) return { training: scenarios, holdout: [] };
  const fallback = [...scenarios].sort((a, b) => stableHash(a.id) - stableHash(b.id));
  return { training: fallback.slice(1), holdout: fallback.slice(0, 1) };
}

export function getHiddenBenchmarkScenarios(scenarios: Scenario[], profile?: PlayerProfile): Scenario[] {
  const { holdout } = splitBenchmarkScenarios(scenarios);
  const ranked = profile
    ? holdout.map(scenario => ({ scenario, score: scenarioProfileScore(scenario, profile) })).sort((a, b) => b.score - a.score).map(item => item.scenario)
    : holdout;
  return ranked;
}

export function getTrainingScenarios(scenarios: Scenario[]): Scenario[] {
  return splitBenchmarkScenarios(scenarios).training;
}
