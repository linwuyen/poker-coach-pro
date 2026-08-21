import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTruthCoverageReport, findExactVerifiedTruthProfile, verifiedActionRegret } from '../src/strategy-engine-v2/coverage';
import { StrategyProfile } from '../src/strategy-engine-v2/types';

function solverProfile(): StrategyProfile {
  return {
    schemaVersion: 2,
    id: 'solver:cash-bb-btn-100',
    version: '1.0.0',
    name: 'BB vs BTN 100BB',
    description: 'fixture',
    context: {
      format: 'cash', tableSize: '6max', spot: 'bb-defense', position: 'bb', villainPosition: 'btn',
      stackDepthBB: 100, anteBB: 0, openSizeBB: 2.5, rakePercent: 5, rakeCapBB: 2,
    },
    source: {
      type: 'solver', trustTier: 'verified-solver', label: 'fixture', reference: 'fixture://solver',
      solverName: 'FixtureSolver', solverVersion: '1', generatedAt: '2026-08-21T00:00:00Z', disclaimer: 'test fixture',
    },
    ranges: { AKo: { call: 0.6, raise: 0.4 } },
    evByHand: { AKo: { fold: 0, call: 0.35, raise: 0.22 } },
    tags: ['test'],
  };
}

test('truth coverage counts only verified solver rows as reportable truth coverage', () => {
  const report = buildTruthCoverageReport([solverProfile()]);
  assert.equal(report.verifiedSolverProfiles, 1);
  assert.equal(report.contexts, 1);
  assert.equal(report.frequencyHands, 1);
  assert.equal(report.evHands, 1);
  assert.equal(report.fullEvHands, 1);
  assert.equal(report.mixedHands, 1);
});

test('automatic grading requires an exact verified context instead of approximate fallback', () => {
  const profiles = [solverProfile()];
  const exact = findExactVerifiedTruthProfile(profiles, {
    hand: 'AKo', format: 'cash', tableSize: '6max', spot: 'bb-defense', position: 'bb', villainPosition: 'btn',
    stackDepthBB: 100, anteBB: 0, openSizeBB: 2.5, rakePercent: 5, rakeCapBB: 2,
  });
  assert.ok(exact);
  const mismatched = findExactVerifiedTruthProfile(profiles, {
    hand: 'AKo', format: 'cash', tableSize: '6max', spot: 'bb-defense', position: 'bb', villainPosition: 'btn',
    stackDepthBB: 80, anteBB: 0, openSizeBB: 2.5,
  });
  assert.equal(mismatched, undefined);
});

test('verified regret is emitted only when the chosen action has real per-action EV', () => {
  const profile = solverProfile();
  const regret = verifiedActionRegret(profile, 'AKo', 'raise');
  assert.ok(regret);
  assert.equal(regret!.bestAction, 'call');
  assert.ok(Math.abs(regret!.evLossBB - 0.13) < 1e-9);
  assert.equal(verifiedActionRegret(profile, 'AKo', 'limp'), undefined);
});
