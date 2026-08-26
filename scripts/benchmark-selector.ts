import assert from 'node:assert/strict';
import { candidateLearningSignal } from '../src/learning-engine/closedLoop';
import { buildInfiniteCandidatePool } from '../src/learning-engine/infiniteHandGenerator';
import { buildGeneratedVariantPool } from '../src/learning-engine/variantGenerator';
import { coreScenarios, scenarios } from '../src/teaching/scenarioCatalog';
import { HistoryItem } from '../src/types';

const POLICY = 'adaptive-heuristic-v2-error-pressure';
const now = 1_800_000_000_000;
const pool = buildInfiniteCandidatePool(scenarios, buildGeneratedVariantPool(coreScenarios, 6), []);
const candidate = pool.find(item => item.kind === 'scenario');
if (!candidate || candidate.kind !== 'scenario') throw new Error('Selector benchmark requires one scenario candidate.');

function history(correct: boolean, count: number, due: boolean): HistoryItem[] {
  return Array.from({ length: count }, (_, index) => ({
    schemaVersion: 6,
    attemptId: `selector-benchmark-${correct ? 'mastered' : 'leak'}-${index}`,
    trainingType: 'scenario',
    scenarioId: candidate.scenario.id,
    decisionFamilyId: candidate.familyId,
    category: candidate.scenario.category || [],
    score: correct ? 10 : 0,
    judgment: correct ? '正確' : '錯誤',
    correct,
    timestamp: now - (count - index) * 1000,
    nextReviewAt: due ? now - 1 : undefined,
  }));
}

const unseen = candidateLearningSignal(candidate, [], now);
const dueLeak = candidateLearningSignal(candidate, history(false, 12, true), now);
const mastered = candidateLearningSignal(candidate, history(true, 12, false), now);

assert.ok(mastered.weight < unseen.weight, 'Selector regression: mastered material must be suppressed below neutral unseen material.');
assert.ok(unseen.weight < dueLeak.weight, 'Selector regression: a persistent due leak must outrank neutral unseen material.');
assert.ok(dueLeak.errorPressure > unseen.errorPressure, 'Selector regression: persistent failure must create explicit error pressure.');
assert.ok(dueLeak.uncertainty < unseen.uncertainty, 'Selector regression: certainty about weakness must not be mislabeled as uncertainty.');

const report = {
  policy: POLICY,
  candidateFamily: candidate.familyId,
  orderingContract: 'mastered < unseen < persistent-due-leak',
  mastered: {
    predictedSuccess: Number(mastered.predictedSuccessProbability.toFixed(4)),
    uncertainty: Number(mastered.uncertainty.toFixed(4)),
    errorPressure: Number(mastered.errorPressure.toFixed(4)),
    priority: Number(mastered.priorityScore.toFixed(4)),
    weight: Number(mastered.weight.toFixed(4)),
  },
  unseen: {
    predictedSuccess: Number(unseen.predictedSuccessProbability.toFixed(4)),
    uncertainty: Number(unseen.uncertainty.toFixed(4)),
    errorPressure: Number(unseen.errorPressure.toFixed(4)),
    priority: Number(unseen.priorityScore.toFixed(4)),
    weight: Number(unseen.weight.toFixed(4)),
  },
  dueLeak: {
    predictedSuccess: Number(dueLeak.predictedSuccessProbability.toFixed(4)),
    uncertainty: Number(dueLeak.uncertainty.toFixed(4)),
    errorPressure: Number(dueLeak.errorPressure.toFixed(4)),
    priority: Number(dueLeak.priorityScore.toFixed(4)),
    weight: Number(dueLeak.weight.toFixed(4)),
  },
  evidenceBoundary: 'This benchmark proves selector ordering semantics only; it does not claim causal holdout-EV improvement.',
};

console.log(JSON.stringify(report, null, 2));
