import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';
import { calculateFgs, compareFgsActions, type FgsNode } from '../src/tournament/icm';

const players = Array.from({ length: 16 }, (_, index) => ({ id: `P${index}`, stack: 20 + index }));
const payouts = Array.from({ length: 16 }, (_, index) => 16 - index);

test('two hundred identical full-roster FGS leaves reuse exact equities', () => {
  const root: FgsNode = { id: 'root', players, children: Array.from({ length: 200 }, (_, index) => ({ id: `leaf${index}`, probability: 1 / 200 })) };
  const started = performance.now();
  const result = calculateFgs({ root, payouts, heroId: 'P0' });
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 1000, `identical FGS leaves took ${elapsed.toFixed(1)}ms`);
  assert.equal(result.nodeCount, 201);
  assert.equal(result.leafCount, 200);
  // Linear prizes give 1 + the sum of pairwise probabilities of outlasting each opponent.
  const expected = 1 + players.slice(1).reduce((sum, player) => sum + 20 / (20 + player.stack), 0);
  assert.ok(Math.abs(result.heroEquity - expected) < 1e-9);
  assert.ok(Math.abs(Object.values(result.equities).reduce((sum, value) => sum + value, 0) - 136) < 1e-9);
});

test('FGS rejects excessive distinct exact states instead of partially evaluating a valid tree', () => {
  const children: FgsNode[] = Array.from({ length: 20 }, (_, index) => ({
    id: `leaf${index}`, probability: 1 / 20,
    players: players.map((player, playerIndex) => ({ ...player, stack: player.stack + (playerIndex === 0 ? index / 100 : playerIndex === 1 ? -index / 100 : 0) })),
  }));
  assert.throws(() => calculateFgs({ root: { id: 'root', players, children }, payouts, heroId: 'P0' }), /exact.*work.*budget|computation.*budget/i);
});

test('action comparisons share the aggregate exact-state budget', () => {
  const actions = Array.from({ length: 20 }, (_, index) => ({ action: `action${index}`, root: {
    id: `root${index}`, players: players.map((player, playerIndex) => ({ ...player, stack: player.stack + (playerIndex === 0 ? index / 100 : playerIndex === 1 ? -index / 100 : 0) })),
  } }));
  assert.throws(() => compareFgsActions(actions, payouts, 'P0'), /exact.*work.*budget|computation.*budget/i);
});

test('identical compared actions share computation without sharing mutable result objects', () => {
  const actions = Array.from({ length: 200 }, (_, index) => ({ action: `action${index}`, root: {
    id: `root${index}`, players: index % 2 ? [...players].reverse() : players,
  } }));
  const started = performance.now();
  const result = compareFgsActions(actions, payouts, 'P0');
  assert.ok(performance.now() - started < 1000);
  assert.equal(result.length, 200);
  assert.ok(result.every(action => action.deltaVsBest === 0));
  const secondEquity = result[1].equities.P0;
  result[0].equities.P0 = -1;
  assert.equal(result[1].equities.P0, secondEquity);
});

test('cache identity retains earned prizes and validates every duplicate-state branch', () => {
  const result = calculateFgs({ payouts: [60, 30, 10], heroId: 'B', root: { id: 'root', players: [
    { id: 'A', stack: 10 }, { id: 'B', stack: 10 }, { id: 'C', stack: 10 },
  ], children: [
    { id: 'second', probability: .5, players: [{ id: 'A', stack: 30 }, { id: 'B', stack: 0, eliminatedPlace: 2 }, { id: 'C', stack: 0, eliminatedPlace: 3 }] },
    { id: 'third', probability: .5, players: [{ id: 'A', stack: 30 }, { id: 'B', stack: 0, eliminatedPlace: 3 }, { id: 'C', stack: 0, eliminatedPlace: 2 }] },
  ] } });
  assert.deepEqual(result.equities, { A: 60, B: 20, C: 20 });
  assert.throws(() => calculateFgs({ payouts, heroId: 'P0', root: { id: 'root', players, children: [
    { id: 'same', probability: .5 }, { id: 'same', probability: .5 },
  ] } }), /unique/);
});
