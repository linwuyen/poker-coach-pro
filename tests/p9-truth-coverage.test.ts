import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTruthCoverageReport, findExactVerifiedTruthProfile, findExactVerifiedTruthProfiles, verifiedActionRegret } from '../src/strategy-engine-v2/coverage';
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

const exactQuery = {
  hand: 'AKo', format: 'cash' as const, tableSize: '6max' as const, spot: 'bb-defense' as const, position: 'bb' as const, villainPosition: 'btn' as const,
  stackDepthBB: 100, anteBB: 0, openSizeBB: 2.5, rakePercent: 5, rakeCapBB: 2,
};

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
  assert.ok(findExactVerifiedTruthProfile([solverProfile()], exactQuery));
  const mismatched = findExactVerifiedTruthProfile([solverProfile()], { ...exactQuery, stackDepthBB: 80 });
  assert.equal(mismatched, undefined);
  assert.equal(findExactVerifiedTruthProfile([solverProfile()], { ...exactQuery, rakePercent: undefined }), undefined);
});

test('multiple exact verified solver versions are exposed as ambiguity, never array-order truth', () => {
  const first = solverProfile();
  const second = { ...solverProfile(), version: '2.0.0', source: { ...solverProfile().source, solverVersion: '2' } };
  assert.equal(findExactVerifiedTruthProfiles([first, second], exactQuery).length, 2);
  assert.equal(findExactVerifiedTruthProfile([first, second], exactQuery), undefined);
});

test('verified regret is emitted only when the chosen action has real per-action EV', () => {
  const profile = solverProfile();
  const regret = verifiedActionRegret(profile, 'AKo', 'raise');
  assert.ok(regret);
  assert.equal(regret!.bestAction, 'call');
  assert.ok(Math.abs(regret!.evLossBB - 0.13) < 1e-9);
  assert.equal(verifiedActionRegret(profile, 'AKo', 'limp'), undefined);
});
