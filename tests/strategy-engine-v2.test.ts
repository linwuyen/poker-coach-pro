import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findBestProfile,
  getAllStartingHands,
  getComboCount,
  getDecision,
  getRangeStats,
  normalizeFrequencies,
  normalizeHand,
  STRATEGY_PROFILES_V2,
} from '../src/strategy-engine-v2';

test('normalizes hand notation and preserves canonical combo counts', () => {
  assert.equal(normalizeHand('kaS'), 'AKs');
  assert.equal(normalizeHand('t9o'), 'T9o');
  assert.equal(getComboCount('AA'), 6);
  assert.equal(getComboCount('AKs'), 4);
  assert.equal(getComboCount('AKo'), 12);
  assert.equal(getAllStartingHands().length, 169);
});

test('fills unspecified frequency with fold and normalizes overflow', () => {
  assert.deepEqual(normalizeFrequencies({ raise: 0.6 }), { raise: 0.6, call: 0, allIn: 0, fold: 0.4 });
  const normalized = normalizeFrequencies({ raise: 0.8, call: 0.8 });
  assert.ok(Math.abs(normalized.raise - 0.5) < 0.0001);
  assert.ok(Math.abs(normalized.call - 0.5) < 0.0001);
  assert.equal(normalized.fold, 0);
});

test('selects the matching context and exposes mixed frequencies', () => {
  const match = findBestProfile(STRATEGY_PROFILES_V2, {
    tableSize: '6max', format: 'cash', spot: 'rfi', position: 'utg', stackDepthBB: 100,
  });
  assert.equal(match.profile.context.position, 'utg');
  const decision = getDecision(match.profile, '66');
  assert.equal(decision.mixed, true);
  assert.equal(decision.frequencies.raise, 0.5);
  assert.equal(decision.frequencies.fold, 0.5);
});

test('weighted range stats always account for 1326 starting combinations', () => {
  STRATEGY_PROFILES_V2.forEach(profile => {
    const stats = getRangeStats(profile);
    assert.ok(Math.abs(stats.totalCombos - 1326) < 0.001, profile.id);
    assert.ok(stats.continuePercentage >= 0 && stats.continuePercentage <= 100);
  });
});

test('all profile hand keys are valid and frequencies are bounded', () => {
  STRATEGY_PROFILES_V2.forEach(profile => {
    Object.entries(profile.ranges).forEach(([hand, frequency]) => {
      assert.equal(normalizeHand(hand), hand);
      const normalized = normalizeFrequencies(frequency);
      const total = normalized.raise + normalized.call + normalized.allIn + normalized.fold;
      assert.ok(Math.abs(total - 1) < 0.0001, `${profile.id}:${hand}`);
    });
  });
});
