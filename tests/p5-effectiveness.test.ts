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

test('pure hand-history exposure never becomes verified leak without solver/exact regret', () => {
  const history: HistoryItem[] = [
    item(20, true, { trainingType: 'real-hand', sessionId: 'a', handsObserved: 1000, spotExposureCount: 40, spotFrequencyPer100Hands: 4, utilityLoss: undefined }),
    item(220, true, { trainingType: 'real-hand', sessionId: 'b', handsObserved: 1000, spotExposureCount: 40, spotFrequencyPer100Hands: 4, utilityLoss: undefined }),
  ];
  const report = evaluateLearningEffectiveness(history, windows);
  assert.equal(report.realGameLeak.baseline, undefined);
  assert.equal(report.realGameLeak.followup, undefined);
  assert.equal(report.windows[0].realGameHands, 1000);
});

test('verified cash regret can show falling frequency-weighted real-game leak', () => {
  const history: HistoryItem[] = [
    item(20, false, { trainingType: 'real-hand', sessionId: 'a', handsObserved: 1000, spotExposureCount: 50, spotFrequencyPer100Hands: 5, utilityLoss: 0.2, utilityUnit: 'bb', utilityModel: 'cash-chip-ev', truthTier: 'verified-solver' }),
    item(220, false, { trainingType: 'real-hand', sessionId: 'b', handsObserved: 1000, spotExposureCount: 30, spotFrequencyPer100Hands: 3, utilityLoss: 0.1, utilityUnit: 'bb', utilityModel: 'cash-chip-ev', truthTier: 'verified-solver' }),
  ];
  const report = evaluateLearningEffectiveness(history, windows);
  assert.equal(report.realGameLeak.baseline, 1);
  assert.ok(Math.abs((report.realGameLeak.followup || 0) - 0.3) < 1e-9);
  assert.equal(report.realGameLeak.improved, true);
});

test('overlapping effectiveness windows are rejected', () => {
  const broken: EffectivenessWindow[] = [
    { id: 'baseline', label: 'a', start: 0, end: 100 },
    { id: 'training', label: 'b', start: 90, end: 200 },
    { id: 'followup', label: 'c', start: 200, end: 300 },
  ];
  assert.throws(() => evaluateLearningEffectiveness([], broken), /must not overlap/);
});
