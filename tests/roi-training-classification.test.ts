import assert from 'node:assert/strict';
import test from 'node:test';
import { isEvaluationAttempt, verifiedEvNorthStar } from '../src/learning-engine/closedLoop';
import type { HistoryItem } from '../src/types';

const HOUR = 3_600_000;

function item(values: Partial<HistoryItem>): HistoryItem {
  return {
    schemaVersion: 6,
    attemptId: values.attemptId || Math.random().toString(36),
    trainingType: 'scenario',
    scenarioId: values.scenarioId || 'fixture',
    category: [],
    score: 10,
    judgment: '正確',
    timestamp: 1,
    correct: true,
    ...values,
  };
}

function exam(session: string, startedAt: number, completedAt: number, loss: number): HistoryItem {
  return item({
    attemptId: `${session}-ev`,
    trainingType: 'benchmark',
    scenarioId: `${session}-scenario`,
    stepId: 'river',
    timestamp: startedAt + 1000,
    examMode: true,
    examSessionId: session,
    examStartedAt: startedAt,
    examCompletedAt: completedAt,
    isTransferTest: true,
    truthTier: 'exact-math',
    gameFormat: 'Cash',
    utilityUnit: 'bb',
    utilityModel: 'cash-chip-ev',
    evLossBB: loss,
  });
}

test('ordinary solver-corpus transfer practice remains training, not evaluation', () => {
  const training = item({ trainingType:'solver-corpus', solverCorpusRole:'training', isTransferTest:true });
  const holdout = item({ trainingType:'solver-benchmark', solverCorpusRole:'holdout', isTransferTest:true, examMode:true });
  assert.equal(isEvaluationAttempt(training), false);
  assert.equal(isEvaluationAttempt(holdout), true);
});

test('solver-corpus dwell contributes to Learning ROI between completed exams', () => {
  const history: HistoryItem[] = [
    exam('exam-a', 0.5 * HOUR, 1.0 * HOUR, 0.8),
    item({
      attemptId:'solver-training',
      trainingType:'solver-corpus',
      solverCorpusRole:'training',
      isTransferTest:true,
      timestamp:2 * HOUR,
      trainingDwellMs:HOUR,
      trainingDwellStartedAt:1.5 * HOUR,
      trainingDwellCompletedAt:2.5 * HOUR,
    }),
    exam('exam-b', 3.0 * HOUR, 3.5 * HOUR, 0.3),
  ];
  const result = verifiedEvNorthStar(history, 4 * HOUR);
  assert.equal(result.trainingHours, 1);
  assert.ok(Math.abs((result.learningRoiBBPerHour || 0) - 0.5) < 1e-9);
});
