import assert from 'node:assert/strict';
import test from 'node:test';
import { candidateLearningSignal } from '../src/learning-engine/closedLoop';
import { buildInfiniteCandidatePool } from '../src/learning-engine/infiniteHandGenerator';
import { buildGeneratedVariantPool } from '../src/learning-engine/variantGenerator';
import { coreScenarios, scenarios } from '../src/teaching/scenarioCatalog';
import { HistoryItem } from '../src/types';

const pool = buildInfiniteCandidatePool(scenarios, buildGeneratedVariantPool(coreScenarios, 6), []);
const candidate = pool.find(item => item.kind === 'scenario');
if (!candidate || candidate.kind !== 'scenario') throw new Error('Expected at least one scenario candidate.');

function attempts(correct: boolean, count: number, now: number, due: boolean): HistoryItem[] {
  return Array.from({ length: count }, (_, index) => ({
    schemaVersion: 6,
    attemptId: `selector-pressure-${correct ? 'right' : 'wrong'}-${index}`,
    trainingType: 'scenario',
    scenarioId: candidate.scenario.id,
    decisionFamilyId: candidate.familyId,
    category: candidate.scenario.category || [],
    score: correct ? 10 : 0,
    judgment: correct ? '正確' : '錯誤',
    timestamp: now - (count - index) * 1000,
    correct,
    nextReviewAt: due ? now - 1 : undefined,
  }));
}

test('selector separates uncertainty from persistent weakness', () => {
  const now = 1_800_000_000_000;
  const unseen = candidateLearningSignal(candidate, [], now);
  const repeatedWrong = candidateLearningSignal(candidate, attempts(false, 12, now, true), now);
  const mastered = candidateLearningSignal(candidate, attempts(true, 12, now, false), now);

  assert.equal(unseen.predictedSuccessProbability, 0.5);
  assert.ok(repeatedWrong.predictedSuccessProbability < unseen.predictedSuccessProbability);
  assert.ok(repeatedWrong.uncertainty < unseen.uncertainty, 'Repeated failure should make learner state more certain, not more uncertain.');
  assert.ok(repeatedWrong.errorPressure > unseen.errorPressure, 'Known weakness needs its own pressure term.');
  assert.equal(repeatedWrong.duePressure, 1);
  assert.ok(repeatedWrong.weight > unseen.weight, 'A persistent due leak must outrank a neutral unseen family.');
  assert.ok(mastered.weight < unseen.weight, 'Repeated mastery should free capacity for higher-value material.');
});
