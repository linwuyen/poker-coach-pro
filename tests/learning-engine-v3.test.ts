import assert from 'node:assert/strict';
import test from 'node:test';
import { evRegret, evRegretScore } from '../src/learning-engine/ev';
import { calculateSkillMastery, inferSkillIds } from '../src/learning-engine/skillGraph';
import { HistoryItem } from '../src/types';

test('EV regret distinguishes near-indifference from a punt', () => {
  assert.equal(evRegret(0.03, 0), 0.03);
  assert.ok(evRegretScore(0.03) > evRegretScore(1.5));
  assert.equal(evRegret(0, 0.2), 0);
});

test('skill inference maps poker concepts into stable capability ids', () => {
  const ids = inferSkillIds(['ICM 壓力', 'Pot Odds', 'Bluff Catch'], 'River');
  assert.ok(ids.includes('tournament.icm'));
  assert.ok(ids.includes('math.pot-odds'));
  assert.ok(ids.includes('postflop.bluff-catch'));
});

test('skill mastery requires delayed and transfer evidence before mastered', () => {
  const now = 1_900_000_000_000;
  const base: HistoryItem = {
    schemaVersion: 4,
    scenarioId: 'a', stepId: 'river', masteryKey: 'a::river', category: ['Bluff Catch'], skillIds: ['postflop.bluff-catch'],
    score: 10, judgment: '正確', timestamp: now - 2 * 86400000, correct: true, evLossBB: 0.01,
  };
  const delayed: HistoryItem = { ...base, attemptId: '2', timestamp: now - 86400000, isDelayedReview: true };
  const noTransfer = calculateSkillMastery([base, delayed], now).find(item => item.skillId === 'postflop.bluff-catch');
  assert.notEqual(noTransfer?.status, 'mastered');
  const transfer: HistoryItem = { ...base, attemptId: '3', scenarioId: 'b', masteryKey: 'b::river', timestamp: now - 1000, isTransferTest: true, trainingType: 'transfer' };
  const mastered = calculateSkillMastery([base, delayed, transfer], now).find(item => item.skillId === 'postflop.bluff-catch');
  assert.equal(mastered?.status, 'mastered');
});
