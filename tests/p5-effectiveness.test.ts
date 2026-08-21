import assert from 'node:assert/strict';
import test from 'node:test';
import { EffectivenessWindow, evaluateLearningEffectiveness } from '../src/learning-engine/effectiveness';
import { HistoryItem } from '../src/types';

const windows: EffectivenessWindow[] = [
  { id: 'baseline', label: 'before', start: 0, end: 100 },
  { id: 'training', label: 'train', start: 100, end: 200 },
  { id: 'followup', label: 'after', start: 200, end: 300 },
];

function item(timestamp: number, correct: boolean, extras: Partial<HistoryItem> = {}): HistoryItem {
  return {
    schemaVersion: 6,
    scenarioId: `s-${timestamp}-${Math.random()}`,
    category: ['test'],
    score: correct ? 10 : 0,
    judgment: correct ? '正確' : '錯誤',
    timestamp,
    correct,
    trainingType: 'scenario',
    ...extras,
  };
}

test('effectiveness separates baseline/training/followup and reports observational holdout improvement', () => {
  const history: HistoryItem[] = [
    ...Array.from({ length: 6 }, (_, index) => item(10 + index, index < 3, { trainingType: 'solver-benchmark', solverCorpusRole: 'holdout' })),
    ...Array.from({ length: 10 }, (_, index) => item(120 + index, index < 7)),
    ...Array.from({ length: 6 }, (_, index) => item(210 + index, index < 5, { trainingType: 'solver-benchmark', solverCorpusRole: 'holdout' })),
  ];
  const report = evaluateLearningEffectiveness(history, windows);
  assert.equal(report.observationalOnly, true);
  assert.equal(report.windows[0].holdoutAttempts, 6);
  assert.equal(report.windows[2].holdoutAttempts, 6);
  assert.ok((report.holdout.delta || 0) > 0);
  assert.equal(report.holdout.improved, true);
});

test('effectiveness tracks transfer improvement without external hand evidence', () => {
  const history: HistoryItem[] = [
    ...Array.from({ length: 6 }, (_, index) => item(20 + index, index < 2, { trainingType: 'transfer', isTransferTest: true })),
    ...Array.from({ length: 6 }, (_, index) => item(220 + index, index < 5, { trainingType: 'transfer', isTransferTest: true })),
  ];
  const report = evaluateLearningEffectiveness(history, windows);
  assert.equal(report.windows[0].transferAttempts, 6);
  assert.equal(report.windows[2].transferAttempts, 6);
  assert.ok((report.transfer.delta || 0) > 0);
  assert.equal(report.transfer.improved, true);
});

test('effectiveness tracks delayed retention from truth-backed training history', () => {
  const history: HistoryItem[] = [
    ...Array.from({ length: 5 }, (_, index) => item(30 + index, index < 2, { isDelayedReview: true })),
    ...Array.from({ length: 5 }, (_, index) => item(230 + index, index < 4, { isDelayedReview: true })),
  ];
  const report = evaluateLearningEffectiveness(history, windows);
  assert.equal(report.windows[0].delayedAttempts, 5);
  assert.equal(report.windows[2].delayedAttempts, 5);
  assert.ok((report.delayedRetention.delta || 0) > 0);
  assert.equal(report.delayedRetention.improved, true);
});

test('overlapping effectiveness windows are rejected', () => {
  const broken: EffectivenessWindow[] = [
    { id: 'baseline', label: 'a', start: 0, end: 100 },
    { id: 'training', label: 'b', start: 90, end: 200 },
    { id: 'followup', label: 'c', start: 200, end: 300 },
  ];
  assert.throws(() => evaluateLearningEffectiveness([], broken), /must not overlap/);
});
