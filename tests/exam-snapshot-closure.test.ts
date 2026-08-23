import assert from 'node:assert/strict';
import test from 'node:test';
import { filterFreshEvaluationItems } from '../src/features/training/ExamMode';
import { verifiedEvNorthStar } from '../src/learning-engine/closedLoop';
import type { HistoryItem } from '../src/types';

function item(values: Partial<HistoryItem> = {}): HistoryItem {
  return {
    schemaVersion: 6,
    attemptId: values.attemptId || Math.random().toString(36),
    trainingType: 'scenario',
    scenarioId: 'training',
    category: [],
    score: 10,
    judgment: '正確',
    timestamp: 1,
    correct: true,
    ...values,
  };
}

function verifiedExam(session: string, timestamp: number, loss: number, suffix: string): HistoryItem {
  return item({
    attemptId: `${session}-${suffix}`,
    trainingType: 'benchmark',
    scenarioId: `eval-${session}-${suffix}`,
    stepId: 'river-call',
    timestamp,
    examMode: true,
    examSessionId: session,
    isTransferTest: true,
    isUnseen: true,
    truthTier: 'exact-math',
    gameFormat: 'Cash',
    utilityUnit: 'bb',
    utilityModel: 'cash-chip-ev',
    evLossBB: loss,
  });
}

test('completed concurrent exam rejects identities exposed since its initial snapshot', () => {
  const latest: HistoryItem[] = [
    item({ attemptId:'first-scenario', trainingType:'benchmark', scenarioId:'shared-scenario', stepId:'river', examMode:true, examSessionId:'exam-a' }),
    item({ attemptId:'first-solver', trainingType:'solver-benchmark', scenarioId:'exam-solver:postflop:42', stepId:'solver-decision', datasetRowId:'42', examMode:true, examSessionId:'exam-a' }),
  ];
  const secondCompletion: HistoryItem[] = [
    item({ attemptId:'second-shared-scenario', trainingType:'benchmark', scenarioId:'shared-scenario', stepId:'river', examMode:true, examSessionId:'exam-b' }),
    item({ attemptId:'second-new-scenario', trainingType:'benchmark', scenarioId:'new-scenario', stepId:'river', examMode:true, examSessionId:'exam-b' }),
    item({ attemptId:'second-shared-solver', trainingType:'solver-benchmark', scenarioId:'exam-solver:postflop:42', stepId:'solver-decision', datasetRowId:'42', examMode:true, examSessionId:'exam-b' }),
    item({ attemptId:'second-new-solver', trainingType:'solver-benchmark', scenarioId:'exam-solver:postflop:99', stepId:'solver-decision', datasetRowId:'99', examMode:true, examSessionId:'exam-b' }),
    item({ attemptId:'first-scenario', trainingType:'benchmark', scenarioId:'another-scenario', stepId:'river', examMode:true, examSessionId:'exam-b' }),
  ];

  const fresh = filterFreshEvaluationItems(latest, secondCompletion);
  assert.deepEqual(fresh.map(entry => entry.attemptId), ['second-new-scenario', 'second-new-solver']);
});

test('Learning ROI compares only latest two completed exam snapshots and dwell strictly between them', () => {
  const HOUR = 3_600_000;
  const history: HistoryItem[] = [
    verifiedExam('exam-a', 1 * HOUR, 0.9, '1'),
    verifiedExam('exam-a', 1 * HOUR + 10_000, 0.7, '2'),
    item({ attemptId:'old-training', timestamp:2 * HOUR, trainingDwellMs:2 * HOUR }),

    verifiedExam('exam-b', 3 * HOUR, 0.6, '1'),
    verifiedExam('exam-b', 3 * HOUR + 10_000, 0.4, '2'),
    item({ attemptId:'between-training', timestamp:4 * HOUR, trainingDwellMs:1 * HOUR }),

    verifiedExam('exam-c', 5 * HOUR, 0.2, '1'),
    item({ attemptId:'during-recent-exam', timestamp:5 * HOUR + 5_000, trainingDwellMs:5 * HOUR }),
    verifiedExam('exam-c', 5 * HOUR + 10_000, 0.2, '2'),
    item({ attemptId:'after-recent-exam', timestamp:6 * HOUR, trainingDwellMs:4 * HOUR }),
  ];

  const result = verifiedEvNorthStar(history, 7 * HOUR);
  assert.equal(result.samples, 6);
  assert.equal(result.previousSamples, 2);
  assert.equal(result.recentSamples, 2);
  assert.ok(Math.abs((result.previousAverageEvLossBB || 0) - 0.5) < 1e-9);
  assert.ok(Math.abs((result.recentAverageEvLossBB || 0) - 0.2) < 1e-9);
  assert.ok(Math.abs((result.deltaBBPerDecision || 0) + 0.3) < 1e-9);
  assert.equal(result.trainingHours, 1);
  assert.ok(Math.abs((result.learningRoiBBPerHour || 0) - 0.3) < 1e-9);
});

test('Learning ROI fails closed with fewer than two verified exam snapshots', () => {
  const HOUR = 3_600_000;
  const result = verifiedEvNorthStar([
    verifiedExam('exam-only', HOUR, 0.4, '1'),
    verifiedExam('exam-only', HOUR + 10_000, 0.2, '2'),
    item({ timestamp:2 * HOUR, trainingDwellMs:HOUR }),
  ], 3 * HOUR);

  assert.equal(result.previousSamples, 0);
  assert.equal(result.recentSamples, 2);
  assert.equal(result.deltaBBPerDecision, undefined);
  assert.equal(result.trainingHours, 0);
  assert.equal(result.learningRoiBBPerHour, undefined);
});
