import assert from 'node:assert/strict';
import test from 'node:test';
import { HistoryItem } from '../src/types';
import { buildFamilyOutcomes, buildLongitudinalPokerReport, buildTrainingPrescriptions } from '../src/learning-engine/longitudinal';

const DAY = 86400000;
const now = Date.parse('2026-08-21T00:00:00Z');

function train(id: string, daysAgo: number, correct: boolean, loss?: number, delayed = false): HistoryItem {
  return {
    schemaVersion: 6,
    trainingType: 'scenario',
    scenarioId: `t-${id}-${daysAgo}`,
    decisionFamilyId: id,
    category: ['Training'],
    score: correct ? 10 : 0,
    judgment: correct ? 'ok' : 'miss',
    timestamp: now - daysAgo * DAY,
    correct,
    isDelayedReview: delayed,
    street: 'River',
    position: 'BB',
    truthTier: loss !== undefined ? 'verified-solver' : 'expert-baseline',
    evLossBB: loss,
  };
}

test('P17 family outcome compares early and recent trainer performance without causal overclaim', () => {
  const history: HistoryItem[] = [];
  for (let i = 0; i < 6; i += 1) history.push(train('river-catch', 80 - i, i < 2, 0.4));
  for (let i = 0; i < 6; i += 1) history.push(train('river-catch', 10 - i, i < 5, 0.12));
  const outcome = buildFamilyOutcomes(history)[0];
  assert.equal(outcome.observations, 12);
  assert.ok(outcome.earlyAverageEvLossBB! > outcome.recentAverageEvLossBB!);
  assert.ok(outcome.recentAccuracy! > outcome.earlyAccuracy!);
  assert.equal(outcome.improved, true);
});

test('P17 prescription prioritizes repeated trainer mistakes with weak delayed retention', () => {
  const history: HistoryItem[] = [
    train('river-catch', 5, false, 0.4, true), train('river-catch', 4, false, 0.35, true),
    train('river-catch', 3, false, 0.45), train('river-catch', 2, true, 0.05), train('river-catch', 1, false, 0.4),
    train('tiny-leak', 2, true, 0.01),
  ];
  const list = buildTrainingPrescriptions(history, now);
  assert.equal(list[0].decisionFamilyId, 'river-catch');
  assert.ok(list[0].priority > 0);
  assert.ok((list[0].delayedRetention || 0) < 1);
});

test('P17 longitudinal report contains trainer decisions only and no real-game claims', () => {
  const report = buildLongitudinalPokerReport([train('verified', 1, false, 0.2), train('verified', 0, true, 0)], now);
  assert.equal(report.months.at(-1)?.decisions, 2);
  assert.match(report.caveats.join(' '), /inside the trainer/i);
  assert.doesNotMatch(report.caveats.join(' '), /hand-history evidence is used/i);
});
