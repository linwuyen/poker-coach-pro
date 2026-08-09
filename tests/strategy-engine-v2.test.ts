import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findBestProfile, getAllStartingHands, getComboCount, getDecision, getRangeStats, importSolverEnvelope,
  normalizeFrequencies, normalizeHand, queryStrategy, stableProfileHash, STRATEGY_PROFILES_V2, StrategyProfile,
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
  assert.deepEqual(normalizeFrequencies({ raise: 0.6 }), { raise: 0.6, call: 0, limp: 0, allIn: 0, fold: 0.4 });
  const normalized = normalizeFrequencies({ raise: 0.8, call: 0.8 });
  assert.ok(Math.abs(normalized.raise - 0.5) < 0.0001);
  assert.ok(Math.abs(normalized.call - 0.5) < 0.0001);
  assert.equal(normalized.fold, 0);
});

test('equal mixed frequencies do not invent a primary action', () => {
  const profile = STRATEGY_PROFILES_V2.find(item => item.context.position === 'utg' && item.context.spot === 'rfi' && item.context.tableSize === '6max')!;
  const decision = getDecision(profile, '66');
  assert.equal(decision.mixed, true);
  assert.equal(decision.primaryAction, null);
  assert.equal(decision.frequencies.raise, 0.5);
  assert.equal(decision.frequencies.fold, 0.5);
});

test('strict query refuses to substitute another strategy node', () => {
  const result = queryStrategy(STRATEGY_PROFILES_V2, {
    hand: 'AKs', tableSize: '9max', format: 'tournament', spot: '4bet', position: 'utg', stackDepthBB: 18,
  });
  assert.equal(result.status, 'unsupported');
});

test('strict query rejects material stack mismatch instead of calling it exact', () => {
  const profile = STRATEGY_PROFILES_V2.find(item => item.context.position === 'btn' && item.context.spot === 'rfi' && item.context.tableSize === '6max')!;
  const result = queryStrategy(STRATEGY_PROFILES_V2, {
    hand: 'AKs',
    format: profile.context.format,
    tableSize: profile.context.tableSize,
    spot: profile.context.spot,
    position: profile.context.position,
    stackDepthBB: profile.context.stackDepthBB + 10,
    anteBB: profile.context.anteBB,
    ...(profile.context.openSizeBB !== undefined ? { openSizeBB: profile.context.openSizeBB } : {}),
  });
  assert.equal(result.status, 'unsupported');
  if (result.status === 'unsupported') assert.ok(result.missingContexts.includes('stackDepthBB'));
});

test('major preflop nodes are represented by separate profiles', () => {
  const spots = new Set(STRATEGY_PROFILES_V2.map(profile => profile.context.spot));
  ['rfi', 'vs-open', 'bb-defense', '3bet', '4bet', 'push-fold'].forEach(spot => assert.ok(spots.has(spot as any), spot));
  const sbRfi = STRATEGY_PROFILES_V2.find(profile => profile.context.spot === 'rfi' && profile.context.position === 'sb' && profile.context.tableSize === '6max')!;
  assert.ok(getRangeStats(sbRfi).limpCombos > 0);
});

test('weighted range stats always account for 1326 starting combinations', () => {
  STRATEGY_PROFILES_V2.forEach(profile => {
    const stats = getRangeStats(profile);
    assert.ok(Math.abs(stats.totalCombos - 1326) < 0.001, profile.id);
    assert.ok(stats.continuePercentage >= 0 && stats.continuePercentage <= 100);
  });
});

test('all profile hand keys are valid and frequencies are bounded', () => {
  STRATEGY_PROFILES_V2.forEach(profile => Object.entries(profile.ranges).forEach(([hand, frequency]) => {
    assert.equal(normalizeHand(hand), hand);
    const normalized = normalizeFrequencies(frequency);
    const total = normalized.raise + normalized.call + normalized.limp + normalized.allIn + normalized.fold;
    assert.ok(Math.abs(total - 1) < 0.0001, `${profile.id}:${hand}`);
  }));
});

test('verified solver imports require provenance and are immutable', () => {
  const candidate: StrategyProfile = {
    schemaVersion: 2, id: 'solver-test', version: '1.0.0', name: 'Solver test', description: 'test',
    context: { format: 'cash', tableSize: '6max', spot: 'rfi', position: 'btn', stackDepthBB: 100, anteBB: 0, openSizeBB: 2.5, rakePercent: 5, betTree: { openSizesBB: [2.5] } },
    source: { type: 'solver', trustTier: 'verified-solver', label: 'Test solver', solverName: 'TestSolver', solverVersion: '1', reference: 'fixture://solver-test', generatedAt: '2026-08-04', reviewedBy: ['test'], disclaimer: 'fixture' },
    ranges: { AA: { raise: 1 }, A5s: { raise: 0.4 } }, evByHand: { A5s: { raise: 0.2, fold: 0 } }, tags: ['fixture'], immutable: true,
  };
  const imported = importSolverEnvelope({ schemaVersion: 2, exportedAt: '2026-08-04', profiles: [candidate] });
  assert.equal(imported.profiles.length, 1);
  assert.equal(imported.profiles[0].contentHash, stableProfileHash(imported.profiles[0]));
  const mutated = { ...candidate, ranges: { AA: { raise: 1 }, A5s: { raise: 0.8 } } };
  assert.throws(() => importSolverEnvelope({ schemaVersion: 2, exportedAt: '2026-08-04', profiles: [mutated] }, imported.profiles), /immutable/);
});

test('findBestProfile still exposes matching reasons for inspection', () => {
  const match = findBestProfile(STRATEGY_PROFILES_V2, { tableSize: '6max', format: 'cash', spot: 'bb-defense', position: 'bb', villainPosition: 'btn', stackDepthBB: 100 });
  assert.equal(match.profile.context.spot, 'bb-defense');
  assert.ok(match.reasons.length >= 4);
});
