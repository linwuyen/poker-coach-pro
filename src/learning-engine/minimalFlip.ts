import type { Scenario } from '../types';
import { buildSemanticDecisionPairs, describeSemanticChange, semanticDimensionLabel } from './semanticPairs';
import { decisionsMatch, normalizeDecision, type PokerBenchRow } from '../solver-data/pokerbench';

export interface MinimalFlipEvidence {
  source: 'exact-math' | 'verified-solver-pair';
  change: string;
  fromAction: string;
  toAction: string;
  dimension: string;
  provenance: string;
}

function scenarioBestAction(scenario: Scenario, stepId?: string): string | undefined {
  const step = stepId ? scenario.steps.find(item => item.id === stepId) : scenario.steps[0];
  if (!step) return undefined;
  const best = new Set(Object.values(step.feedbacks).filter(Boolean).map(item => item!.bestAction));
  return best.size === 1 ? [...best][0] : undefined;
}

export function exactScenarioMinimalFlip(scenario: Scenario, stepId?: string): MinimalFlipEvidence | undefined {
  const step = stepId ? scenario.steps.find(item => item.id === stepId) : scenario.steps[0];
  if (!step) return undefined;
  const bestAction = scenarioBestAction(scenario, step.id);
  if (!bestAction) return undefined;
  const feedback = Object.values(step.feedbacks).find(item => item?.bestAction === bestAction && item.evidence?.sourceConfidence === 'exact-math');
  const reversal = feedback?.evidence?.reversals?.[0];
  if (!reversal) return undefined;
  const alternative = step.options.find(action => action !== bestAction);
  return {
    source: 'exact-math',
    change: reversal,
    fromAction: bestAction,
    toAction: alternative || '另一個 action',
    dimension: 'exact decision boundary',
    provenance: step.strategySource || 'Exact arithmetic encoded in the scenario evidence.',
  };
}

function moveTree(row: PokerBenchRow): string {
  return row.availableMoves.map(normalizeDecision).sort().join('|');
}

export function verifiedSolverMinimalFlip(row: PokerBenchRow, rows: PokerBenchRow[]): MinimalFlipEvidence | undefined {
  const sameDecisionSurface = rows.filter(candidate => candidate.split === row.split && moveTree(candidate) === moveTree(row));
  const pairs = buildSemanticDecisionPairs(sameDecisionSurface, { role: 'training', limit: 1200 });
  const pair = pairs.find(item => item.left.id === row.id || item.right.id === row.id);
  if (!pair) return undefined;
  const currentIsLeft = pair.left.id === row.id;
  const current = currentIsLeft ? pair.left : pair.right;
  const neighbor = currentIsLeft ? pair.right : pair.left;
  if (decisionsMatch(current.correctDecision, neighbor.correctDecision)) return undefined;
  return {
    source: 'verified-solver-pair',
    change: describeSemanticChange(currentIsLeft ? pair : { ...pair, left: pair.right, right: pair.left, leftValue: pair.rightValue, rightValue: pair.leftValue }),
    fromAction: current.correctDecision,
    toAction: neighbor.correctDecision,
    dimension: semanticDimensionLabel(pair.dimension),
    provenance: `PokerBench training rows ${current.id} ↔ ${neighbor.id}; exactly one controlled semantic dimension changes and the optimal label flips.`,
  };
}
