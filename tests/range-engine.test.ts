import assert from 'node:assert/strict';
import test from 'node:test';
import { RANGE_QUESTIONS } from '../src/features/range/data';
import {
  baselineSelections,
  calculateRangeDecision,
  scoreRangeConstruction,
  scoreToHistoryScale,
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

test('reachable 0/50/100 weights can earn full range-construction credit', () => {
  const river = RANGE_QUESTIONS.find(item => item.id === 'river-overbet-kj');
  assert.ok(river);
  const riverClosest: WeightedRangeSelection[] = [
    { hand: 'KK', frequency: 1 },
    { hand: 'KQ', frequency: 0.5 },
    { hand: 'QQ', frequency: 0.5 },
    { hand: '88', frequency: 0.5 },
    { hand: 'A♥J♥', frequency: 1 },
    { hand: 'J♥T♥', frequency: 1 },
    { hand: 'T♥9♥', frequency: 1 },
  ];
  assert.equal(scoreRangeConstruction(river, riverClosest), 100);

  const multiway = RANGE_QUESTIONS.find(item => item.id === 'multiway-donk-aa');
  assert.ok(multiway);
  const multiwayClosest: WeightedRangeSelection[] = [
    { hand: '88', frequency: 0.5 },
    { hand: '77', frequency: 0.5 },
    { hand: '44', frequency: 0.5 },
    { hand: '65s', frequency: 1 },
    { hand: '87s', frequency: 1 },
    { hand: 'A8', frequency: 0.5 },
    { hand: '9♣6♣', frequency: 1 },
    { hand: 'A♣5♣', frequency: 1 },
    { hand: 'T♣9♣', frequency: 1 },
  ];
  assert.equal(scoreRangeConstruction(multiway, multiwayClosest), 100);
});

test('history score conversion preserves the 80 percent correctness boundary', () => {
  assert.equal(scoreToHistoryScale(75), 7);
  assert.equal(scoreToHistoryScale(79), 7);
  assert.equal(scoreToHistoryScale(80), 8);
  assert.equal(scoreToHistoryScale(89), 8);
  assert.equal(scoreToHistoryScale(90), 9);
  assert.equal(scoreToHistoryScale(100), 10);
});

test('exact-suit blocker and suited combo teaching data is internally consistent', () => {
  const turn = RANGE_QUESTIONS.find(item => item.id === 'turn-checkraise-aq');
  const river = RANGE_QUESTIONS.find(item => item.id === 'river-overbet-kj');
  const multiway = RANGE_QUESTIONS.find(item => item.id === 'multiway-donk-aa');
  assert.ok(turn && river && multiway);

  assert.equal(turn.options.find(option => option.hand === 'A7s')?.combos, 1);
  assert.equal(multiway.options.find(option => option.hand === '87s')?.combos, 3);
  assert.match(river.blockerNote || '', /J♦ 不會阻擋 J♥T♥/);
});
