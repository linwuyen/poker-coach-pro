import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { filterFreshEvaluationItems } from '../src/features/training/ExamMode';
import { verifiedEvNorthStar } from '../src/learning-engine/closedLoop';
import type { HistoryItem } from '../src/types';
import { mergeHistorySnapshots } from '../src/utils/history';

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

function verifiedExam(
  session: string,
  startedAt: number,
  completedAt: number,
  timestamp: number,
  loss: number,
  suffix: string,
): HistoryItem {
  return item({
    attemptId: `${session}-${suffix}`,
    trainingType: 'benchmark',
    scenarioId: `eval-${session}-${suffix}`,
    stepId: 'river-call',
    timestamp,
    examMode: true,
    examSessionId: session,
    examStartedAt: startedAt,
    examCompletedAt: completedAt,
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

test('Hidden Exam commit revalidates exposure inside one exclusive cross-tab history transaction', () => {
  const historySource = readFileSync('src/utils/history.ts', 'utf8');
  const examSource = readFileSync('src/features/training/ExamMode.tsx', 'utf8');
  assert.match(historySource, /locks\.request\(HISTORY_WRITE_LOCK,\s*\{\s*mode:\s*'exclusive'\s*\}/);
  assert.match(historySource, /const latest = loadHistory\(\);[\s\S]*const next = mutator\(latest\);[\s\S]*writeHistoryRaw\(next\)/);
  assert.match(historySource, /Exclusive history locking is unavailable in this browser/);
  assert.match(examSource, /await updateHistoryExclusive\(latest=>/);
  assert.match(examSource, /filterFreshEvaluationItems\(latest,committedItems\)/);
  assert.doesNotMatch(examSource, /saveHistory\(\[\.\.\.latest,\.\.\.fresh\]\)/);
});

test('legacy snapshot writers share the lock and cannot delete a latest-only exam commit', () => {
  const latest = [
    item({ attemptId:'exam-only', trainingType:'benchmark', scenarioId:'exam', stepId:'river', examMode:true, examSessionId:'exam-a' }),
    item({ attemptId:'shared', scenarioId:'shared', score:4, correct:false }),
  ];
  const staleIncoming = [
    item({ attemptId:'shared', scenarioId:'shared', score:10, correct:true }),
    item({ attemptId:'new-training', scenarioId:'training-new' }),
  ];
  const merged = mergeHistorySnapshots(latest, staleIncoming);
  assert.deepEqual(merged.map(entry => entry.attemptId), ['exam-only', 'shared', 'new-training']);
  assert.equal(merged.find(entry => entry.attemptId === 'shared')?.score, 10);

  const historySource = readFileSync('src/utils/history.ts', 'utf8');
  assert.match(historySource, /export function saveHistory[\s\S]*locks\.request\(HISTORY_WRITE_LOCK,\s*\{\s*mode:\s*'exclusive'\s*\}/);
  assert.match(historySource, /mergeHistorySnapshots\(loadHistory\(\),\s*items\)/);
  assert.match(historySource, /Replacement semantics belong to updateHistoryCoordinated/);
});

test('Learning ROI compares only latest two completed exam snapshots and dwell wholly between their endpoints', () => {
  const HOUR = 3_600_000;
  const history: HistoryItem[] = [
    verifiedExam('exam-a', 0.5 * HOUR, 1.5 * HOUR, 1 * HOUR, 0.9, '1'),
    verifiedExam('exam-a', 0.5 * HOUR, 1.5 * HOUR, 1 * HOUR + 10_000, 0.7, '2'),
    item({ attemptId:'old-training', timestamp:2 * HOUR, trainingDwellMs:0.5 * HOUR, trainingDwellStartedAt:1.25 * HOUR, trainingDwellCompletedAt:1.75 * HOUR }),

    verifiedExam('exam-b', 2.5 * HOUR, 3.5 * HOUR, 3 * HOUR, 0.6, '1'),
    verifiedExam('exam-b', 2.5 * HOUR, 3.5 * HOUR, 3 * HOUR + 10_000, 0.4, '2'),
    item({ attemptId:'between-training', timestamp:4 * HOUR, trainingDwellMs:1 * HOUR, trainingDwellStartedAt:3.75 * HOUR, trainingDwellCompletedAt:4.75 * HOUR }),

    verifiedExam('exam-c', 5 * HOUR, 5.5 * HOUR, 5 * HOUR + 100_000, 0.2, '1'),
    item({ attemptId:'crosses-recent-start', timestamp:5 * HOUR + 5_000, trainingDwellMs:HOUR, trainingDwellStartedAt:4.5 * HOUR, trainingDwellCompletedAt:5.5 * HOUR }),
    verifiedExam('exam-c', 5 * HOUR, 5.5 * HOUR, 5 * HOUR + 200_000, 0.2, '2'),
    item({ attemptId:'after-recent-exam', timestamp:6 * HOUR, trainingDwellMs:HOUR, trainingDwellStartedAt:5.75 * HOUR, trainingDwellCompletedAt:6.75 * HOUR }),
    item({ attemptId:'missing-endpoints', timestamp:4.25 * HOUR, trainingDwellMs:4 * HOUR }),
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

test('Learning ROI fails closed with fewer than two completed verified exam snapshots', () => {
  const HOUR = 3_600_000;
  const result = verifiedEvNorthStar([
    verifiedExam('exam-only', 0.5 * HOUR, 1.5 * HOUR, HOUR, 0.4, '1'),
    verifiedExam('exam-only', 0.5 * HOUR, 1.5 * HOUR, HOUR + 10_000, 0.2, '2'),
    item({ timestamp:2 * HOUR, trainingDwellMs:HOUR, trainingDwellStartedAt:1.75 * HOUR, trainingDwellCompletedAt:2.75 * HOUR }),
  ], 3 * HOUR);

  assert.equal(result.previousSamples, 0);
  assert.equal(result.recentSamples, 2);
  assert.equal(result.deltaBBPerDecision, undefined);
  assert.equal(result.trainingHours, 0);
  assert.equal(result.learningRoiBBPerHour, undefined);
});
