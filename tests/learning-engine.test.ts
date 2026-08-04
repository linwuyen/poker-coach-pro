import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMastery, getLearningMetrics, getWeaknessInsights, makeMasteryKey } from '../src/learning-engine';
import { HistoryItem } from '../src/types';

const now = 1_800_000_000_000;
const item = (partial: Partial<HistoryItem>): HistoryItem => ({
  scenarioId: 's1', stepId: 'flop', masteryKey: makeMasteryKey('s1', 'flop'), category: ['Value Bet'], score: 10,
  judgment: '正確', timestamp: now - 86400000, confidence: 3, correct: true, difficultyWeight: 1, ...partial,
});

test('mastery is tracked per scenario step rather than only scenario', () => {
  const history = [item({ stepId: 'flop', masteryKey: makeMasteryKey('s1', 'flop') }), item({ stepId: 'turn', masteryKey: makeMasteryKey('s1', 'turn'), score: 0, correct: false })];
  const mastery = calculateMastery(history, now);
  assert.equal(mastery.length, 2);
  assert.notEqual(mastery[0].key, mastery[1].key);
});

test('delayed correct retrieval produces stronger mastery evidence', () => {
  const immediate = calculateMastery([item({ isDelayedReview: false })], now)[0];
  const delayed = calculateMastery([item({ isDelayedReview: true })], now)[0];
  assert.ok(delayed.score >= immediate.score);
  assert.equal(delayed.delayedAttempts, 1);
});

test('weakness insight uses sample confidence and Bayesian adjustment', () => {
  const insights = getWeaknessInsights([
    item({ score: 0, correct: false }),
    item({ scenarioId: 's2', masteryKey: makeMasteryKey('s2', 'flop'), score: 0, correct: false }),
  ], now);
  assert.equal(insights[0].rawAccuracy, 0);
  assert.ok(insights[0].adjustedAccuracy > 0);
  assert.ok(insights[0].sampleConfidence < 50);
});

test('learning metrics separate unseen accuracy delayed retention confidence and EV', () => {
  const metrics = getLearningMetrics([
    item({ isUnseen: true, isDelayedReview: false, confidence: 4, evLossBB: 0.02 }),
    item({ scenarioId: 's2', masteryKey: makeMasteryKey('s2', 'flop'), isUnseen: false, isDelayedReview: true, confidence: 1, score: 0, correct: false, evLossBB: 0.3 }),
  ]);
  assert.equal(metrics.unseenAccuracy, 100);
  assert.equal(metrics.delayedRetention, 0);
  assert.equal(metrics.averageEvLossBB, 0.16);
  assert.ok(metrics.confidenceCalibration > 50);
});
