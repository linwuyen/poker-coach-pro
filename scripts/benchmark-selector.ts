import assert from 'node:assert/strict';
import { candidateLearningSignal } from '../src/learning-engine/closedLoop';
import { buildInfiniteCandidatePool, selectNextInfiniteCandidate } from '../src/learning-engine/infiniteHandGenerator';
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

// A reproducible local load fixture needs no network/corpus download. Vary
// families and exact identities while retaining the real candidate dimensions.
const loadPool = Array.from({ length: 8000 }, (_, index) => ({ ...pool[index % pool.length], id: `load-${index}`, familyId: `load-family-${index}` }));
const loadHistory: HistoryItem[] = Array.from({ length: 10000 }, (_, index) => ({
  scenarioId: `load-question-${index}`, decisionFamilyId: `load-family-${index % loadPool.length}`,
  category: [], trainingType: 'scenario', timestamp: now - index, correct: index % 2 === 0,
  score: index % 2 === 0 ? 10 : 0, judgment: 'benchmark',
}));
const selectorStart = performance.now();
const selected = selectNextInfiniteCandidate(loadPool, loadHistory, [], [], () => 0.7, now);
const selectionMs = performance.now() - selectorStart;
assert.ok(selected);
assert.ok(selectionMs < 1500, `Selector load regression: ${Math.round(selectionMs)}ms exceeds the 1500ms budget.`);

const report = {
  policy: POLICY,
  responsiveness: { candidates: loadPool.length, history: loadHistory.length, selectionMs: Math.round(selectionMs), budgetMs: 1500 },
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
