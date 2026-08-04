import assert from 'node:assert/strict';
import test from 'node:test';
import { RANGE_QUESTIONS } from '../src/features/range/data';
import {
  baselineSelections,
  calculateRangeDecision,
  validateRangeQuestions,
} from '../src/features/range/rangeEngine';
import { WeightedRangeSelection } from '../src/features/range/types';

test('range question data passes semantic validation', () => {
  assert.deepEqual(validateRangeQuestions(RANGE_QUESTIONS), []);
});

test('same hero hand changes action when villain range changes', () => {
  const question = RANGE_QUESTIONS.find(item => item.id === 'co-shove-aqs');
  assert.ok(question);
  const tight: WeightedRangeSelection[] = [
    { hand: 'AA', frequency: 1 },
    { hand: 'KK', frequency: 1 },
    { hand: 'QQ', frequency: 1 },
  ];
  const wide: WeightedRangeSelection[] = [
    { hand: '77', frequency: 1 },
    { hand: '44', frequency: 1 },
    { hand: '22', frequency: 1 },
    { hand: 'AJs', frequency: 1 },
    { hand: 'ATo', frequency: 1 },
    { hand: 'KQs', frequency: 1 },
    { hand: 'K8o', frequency: 1 },
  ];

  const tightResult = calculateRangeDecision(question, tight);
  const wideResult = calculateRangeDecision(question, wide);
  assert.equal(tightResult.bestAction, 'fold');
  assert.equal(wideResult.bestAction, 'call');
  assert.ok(wideResult.heroEquity > tightResult.heroEquity);
});

test('river bluff catcher equity equals weighted bluff share', () => {
  const question = RANGE_QUESTIONS.find(item => item.id === 'river-overbet-kj');
  assert.ok(question);
  const valueAndBluff: WeightedRangeSelection[] = [
    { hand: 'KK', frequency: 1 },
    { hand: 'A♥J♥', frequency: 1 },
  ];
  const result = calculateRangeDecision(question, valueAndBluff);
  assert.equal(result.heroEquity, 50);
  assert.equal(result.bestAction, 'call');
});

test('baseline ranges produce non-empty deterministic calculations', () => {
  RANGE_QUESTIONS.forEach(question => {
    const result = calculateRangeDecision(question, baselineSelections(question));
    assert.ok(result.weightedCombos > 0);
    assert.ok(result.heroEquity >= 0 && result.heroEquity <= 100);
    assert.ok(Number.isFinite(result.callEvBB));
  });
});
