import assert from 'node:assert/strict';
import test from 'node:test';
import { importSolverEnvelope, strategySurfaceCapabilities, validateStrategyProfile } from '../src/strategy-engine-v2/importer';
import { StrategyProfile } from '../src/strategy-engine-v2/types';

function solverProfile(): StrategyProfile {
  return {
    schemaVersion: 2,
    id: 'solver-surface-test',
    version: '1.0.0',
    name: 'Solver Surface Test',
    description: 'test',
    context: { format: 'cash', tableSize: '6max', spot: 'bb-defense', position: 'bb', stackDepthBB: 100, anteBB: 0, openSizeBB: 2.5 },
    source: {
      type: 'solver',
      trustTier: 'verified-solver',
      label: 'Test solver export',
      reference: 'file:test-solver-export.json',
      solverName: 'TestSolver',
      solverVersion: '1.2.3',
      generatedAt: '2026-08-20T00:00:00Z',
      disclaimer: 'Imported test data.',
    },
    ranges: {
      AKs: { raise: 0.25, call: 0.75 },
      AKo: { raise: 1 },
    },
    evByHand: {
      AKs: { raise: 1.02, call: 1.08, fold: 0 },
    },
    tags: ['test'],
  };
}

test('verified solver surface validates mixed frequencies and per-action EV with provenance', () => {
  const validated = validateStrategyProfile(solverProfile()).profile;
  assert.equal(validated.source.trustTier, 'verified-solver');
  assert.ok(validated.contentHash?.startsWith('fnv1a-'));
  const capabilities = strategySurfaceCapabilities(validated);
  assert.equal(capabilities.frequencyHands, 2);
  assert.equal(capabilities.mixedHands, 1);
  assert.equal(capabilities.evHands, 1);
  assert.equal(capabilities.hasPerActionEv, true);
});

test('per-action EV rejects non-finite values instead of manufacturing a surface', () => {
  const broken = solverProfile();
  broken.evByHand = { AKs: { call: Number.NaN, fold: 0 } };
  assert.throws(() => validateStrategyProfile(broken), /EV must be finite/);
});

test('verified solver imports require source reference and immutable versions', () => {
  const missing = solverProfile();
  missing.source.reference = undefined;
  assert.throws(() => validateStrategyProfile(missing), /requires solverName and reference/);

  const first = importSolverEnvelope({ schemaVersion: 2, exportedAt: '2026-08-20T00:00:00Z', profiles: [solverProfile()] });
  const changed = solverProfile();
  changed.ranges.AKs = { fold: 1 };
  assert.throws(() => importSolverEnvelope({ schemaVersion: 2, exportedAt: '2026-08-20T00:00:00Z', profiles: [changed] }, first.profiles), /immutable/);
});
