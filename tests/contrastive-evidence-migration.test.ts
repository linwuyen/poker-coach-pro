import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMastery, currentDueReviews, getLearningMetrics } from '../src/learning-engine';
import { calculateSkillMastery } from '../src/learning-engine/skillGraph';
import { buildKnowledgeStates } from '../src/learning-engine/closedLoop';
import { firstTransferEvidence } from '../src/learning-engine/transferBenchmark';
import { evaluationIdentity } from '../src/features/training/ExamMode';
import type { HistoryItem } from '../src/types';

const legacy: HistoryItem = { scenarioId: 'contrastive:postflop_10k_test:postflop-10', datasetRowId: 'postflop-10', datasetSplit: 'postflop_10k_test', truthSourceId: 'pokerbench-aaai2025', trainingType: 'contrastive', gameFormat: 'Cash', decisionContextVersion: 2, skillIds: ['postflop.bluff-catch'], category: ['Bluff Catch'], stepId: 'solver-decision', score: 10, correct: true, judgment: 'correct', timestamp: 1, nextReviewAt: 2, isTransferTest: true, transferLevel: 'structural', isUnseen: true };

test('legacy contrastive context remains exposed and due but cannot count as mastery or transfer', () => {
  assert.equal(calculateMastery([legacy]).length, 0);
  assert.equal(calculateSkillMastery([legacy]).length, 0);
  assert.equal(getLearningMetrics([legacy]).totalDecisions, 0);
  assert.equal(buildKnowledgeStates([legacy], 'cash').find(item => item.skillId === 'postflop.bluff-catch')?.evidenceCount, 0);
  assert.equal(firstTransferEvidence([legacy]).length, 0);
  assert.equal(currentDueReviews([legacy], 3).length, 1);
  assert.equal(evaluationIdentity(legacy), 'solver:pokerbench-aaai2025:postflop_10k_test:postflop-10');
});

test('complete contrastive v3 and other valid dataset v2 evidence remain eligible', () => {
  const complete = { ...legacy, decisionContextVersion: 3 as const };
  assert.equal(firstTransferEvidence([complete]).length, 1);
  assert.equal(getLearningMetrics([complete]).totalDecisions, 1);
  assert.equal(calculateSkillMastery([complete]).length, 1);
  assert.equal(firstTransferEvidence([{ ...legacy, trainingType: 'solver-benchmark' }]).length, 1);
  assert.equal(firstTransferEvidence([legacy, { ...complete, timestamp: 4 }]).length, 0, 'corrected context must not erase previous exposure');
});
