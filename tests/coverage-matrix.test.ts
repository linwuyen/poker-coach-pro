import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSituationCoverage } from '../src/learning-engine/coverageMatrix';
import { exactMathSemanticScenarios } from '../src/teaching/semanticMathScenarios';
import type { HistoryItem } from '../src/types';

function item(values: Partial<HistoryItem>): HistoryItem {
  return {
    schemaVersion: 6,
    attemptId: 'coverage-attempt',
    trainingType: 'scenario',
    scenarioId: exactMathSemanticScenarios[0].id,
    category: ['Exact Math'],
    score: 10,
    judgment: '正確',
    timestamp: 1,
    correct: true,
    ...values,
  };
}

test('coverage matrix keeps catalog contexts with zero player evidence', () => {
  const matrix = buildSituationCoverage(exactMathSemanticScenarios.slice(0, 4), []);
  assert.ok(matrix.length > 0);
  assert.ok(matrix.some(row => row.situationId === 'street.river'));
  assert.ok(matrix.every(row => row.attempts === 0));
  assert.ok(matrix.every(row => row.dataGap));
});

test('coverage matrix separates transfer evidence and verified EV', () => {
  const history = [
    item({ situationIds: ['street.river', 'math.pot-odds'], isTransferTest: true, trainingType: 'benchmark', truthTier: 'exact-math', gameFormat: 'Cash', utilityUnit: 'bb', utilityModel: 'cash-chip-ev', evLossBB: 0.4 }),
    item({ attemptId: 'coverage-attempt-2', situationIds: ['street.river', 'math.pot-odds'], correct: false, score: 0 }),
  ];
  const matrix = buildSituationCoverage(exactMathSemanticScenarios.slice(0, 4), history);
  const river = matrix.find(row => row.situationId === 'street.river');
  assert.ok(river);
  assert.equal(river!.attempts, 2);
  assert.equal(river!.accuracy, 50);
  assert.equal(river!.transferAttempts, 1);
  assert.equal(river!.transferAccuracy, 100);
  assert.equal(river!.verifiedEvSamples, 1);
  assert.equal(river!.averageVerifiedEvLossBB, 0.4);
});
