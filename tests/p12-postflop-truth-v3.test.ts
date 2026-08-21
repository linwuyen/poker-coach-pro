import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PostflopTruthNode,
  buildPostflopCoverageReport,
  canonicalHoleCombo,
  findExactVerifiedPostflopNode,
  importPostflopTruthPack,
  verifiedPostflopRegret,
} from '../src/strategy-engine-v3';

function node(): PostflopTruthNode {
  return {
    schemaVersion: 3,
    id: 'solver-v3:cash-btn-bb-a84r',
    version: '1',
    name: 'BTN vs BB A84r flop',
    description: 'fixture',
    context: {
      format: 'cash', tableSize: '6max', street: 'Flop', heroPosition: 'btn', villainPosition: 'bb', playersInHand: 2,
      effectiveStackBB: 97.5, potBB: 5.5, spr: 17.727, toCallBB: 0, board: ['Ah','8c','4d'],
      preflopLine: [{ actor: 'btn', action: 'raise', toBB: 2.5 }, { actor: 'bb', action: 'call' }],
      streetLine: [{ actor: 'bb', action: 'check' }], lastAggressorPosition: 'btn', rakePercent: 5, rakeCapBB: 2,
    },
    source: { type: 'solver', trustTier: 'verified-solver', label: 'fixture', reference: 'fixture://postflop', solverName: 'FixtureSolver', solverVersion: '1', generatedAt: '2026-08-21T00:00:00Z', disclaimer: 'test fixture' },
    strategyByCombo: { AsKd: { check: 0.35, bet: 0.65 } },
    evByCombo: { AsKd: { check: 1.12, bet: 1.31 } },
    actionSizesPot: { bet: [0.33] },
    tags: ['test'],
  };
}

const query = {
  heroCards: ['Kd','As'], format: 'cash' as const, tableSize: '6max' as const, street: 'Flop' as const,
  heroPosition: 'btn' as const, villainPosition: 'bb' as const, playersInHand: 2 as const,
  effectiveStackBB: 97.5, potBB: 5.5, spr: 17.727, toCallBB: 0, board: ['8c','Ah','4d'],
  preflopLine: [{ actor: 'btn' as const, action: 'raise' as const, toBB: 2.5 }, { actor: 'bb' as const, action: 'call' as const }],
  streetLine: [{ actor: 'bb' as const, action: 'check' as const }], lastAggressorPosition: 'btn' as const, rakePercent: 5, rakeCapBB: 2,
};

test('v3 exact postflop truth canonicalizes exact combo and flop order', () => {
  assert.equal(canonicalHoleCombo(['Kd','As']), 'AsKd');
  assert.equal(findExactVerifiedPostflopNode([node()], query)?.id, node().id);
});

test('automatic postflop truth refuses material state mismatch and ambiguity', () => {
  assert.equal(findExactVerifiedPostflopNode([node()], { ...query, potBB: 6.2 }), undefined);
  const other = { ...node(), version: '2', source: { ...node().source, solverVersion: '2' } };
  assert.equal(findExactVerifiedPostflopNode([node(), other], query), undefined);
});

test('postflop regret requires sourced per-action EV and coverage reports actual imported truth', () => {
  const regret = verifiedPostflopRegret(node(), ['As','Kd'], 'check');
  assert.ok(regret);
  assert.equal(regret!.bestAction, 'bet');
  assert.ok(Math.abs(regret!.evLossBB - 0.19) < 1e-9);
  const report = buildPostflopCoverageReport([node()]);
  assert.equal(report.nodes, 1);
  assert.equal(report.comboFrequencyRows, 1);
  assert.equal(report.fullEvComboRows, 1);
});

test('v3 truth pack import is immutable and provenance-gated', () => {
  const pack = { schemaVersion: 3 as const, packId: 'fixture-pack', version: '1', exportedAt: '2026-08-21T00:00:00Z', sourceReference: 'fixture://pack', nodes: [node()] };
  const first = importPostflopTruthPack(pack);
  assert.equal(first.nodes.length, 1);
  const second = importPostflopTruthPack(pack, first.nodes);
  assert.equal(second.nodes.length, 0);
  assert.equal(second.skipped.length, 1);
});
