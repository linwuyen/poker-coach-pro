import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';
import { calculateHeadsUpIcmRisk, calculateIcm } from '../src/tournament/icm';

test('eleven-player current/win/loss ICM remains interactive and matches independent linear-prize arithmetic', () => {
  const players = Array.from({ length: 11 }, (_, index) => ({ id: `P${index + 1}`, stack: 20 + index }));
  const payouts = Array.from({ length: 11 }, (_, index) => 11 - index);
  const start = performance.now();
  const result = calculateHeadsUpIcmRisk({ players, payouts, heroId: 'P1', villainId: 'P2', amountAtRisk: 10, showdownEquity: .55 });
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 1000, `eleven-player calculation took ${elapsed.toFixed(1)}ms`);
  // For prizes n,n-1,...,1, equity is 1 + expected opponents outlasted.
  // Under ICM each pairwise finish probability is si / (si + sj).
  const linearPrize = (hero: number, opponents: number[]) => 1 + opponents.reduce((sum, stack) => sum + hero / (hero + stack), 0);
  assert.ok(Math.abs(result.foldEquity - linearPrize(20, players.slice(1).map(player => player.stack))) < 1e-10);
  assert.ok(Math.abs(result.winEquity - linearPrize(30, [11, ...players.slice(2).map(player => player.stack)])) < 1e-10);
  assert.ok(Math.abs(result.loseEquity - linearPrize(10, [31, ...players.slice(2).map(player => player.stack)])) < 1e-10);
});

test('oversized exact-ICM rosters are rejected before computation', () => {
  const players = Array.from({ length: 17 }, (_, index) => ({ id: `P${index}`, stack: 20 + index }));
  assert.throws(() => calculateIcm(players, [100]), /at most 16 live players/i);
});

test('the exact-ICM size limit counts live players and keeps earned elimination prizes', () => {
  const players = [
    ...Array.from({ length: 11 }, (_, index) => ({ id: `P${index}`, stack: 10 })),
    ...Array.from({ length: 7 }, (_, index) => ({ id: `out${index}`, stack: 0, eliminatedPlace: index + 12 })),
  ];
  const result = calculateIcm(players, Array.from({ length: 18 }, (_, index) => 18 - index));
  for (let index = 0; index < 11; index += 1) assert.ok(Math.abs(result.equities[`P${index}`] - 13) < 1e-9);
  for (let index = 0; index < 7; index += 1) assert.equal(result.equities[`out${index}`], 7 - index);
  assert.ok(Math.abs(Object.values(result.equities).reduce((sum, value) => sum + value, 0) - 171) < 1e-9);
});

test('finite stack denominations preserve ICM even when their sum exceeds Number.MAX_VALUE', () => {
  for (const stack of [1e308, 1e-310]) {
    const result = calculateIcm([{ id: 'A', stack }, { id: 'B', stack }], [60, 40]);
    assert.ok(Math.abs(result.equities.A - 50) < 1e-9);
    assert.ok(Math.abs(result.equities.B - 50) < 1e-9);
  }
  const mixed = calculateIcm([{ id: 'A', stack: 1e308 }, { id: 'B', stack: 1e-310 }, { id: 'C', stack: 1e-310 }], [60, 30, 10]);
  assert.deepEqual(mixed.equities, { A: 60, B: 20, C: 20 });
});

test('unequal stacks retain hand-calculated equities for non-linear prizes', () => {
  const result = calculateIcm([{ id: 'A', stack: 6 }, { id: 'B', stack: 3 }, { id: 'C', stack: 1 }], [60, 30, 10]);
  // Six finishing permutations give [976/21, 104/3, 132/7].
  assert.ok(Math.abs(result.equities.A - 976 / 21) < 1e-9);
  assert.ok(Math.abs(result.equities.B - 104 / 3) < 1e-9);
  assert.ok(Math.abs(result.equities.C - 132 / 7) < 1e-9);
});

test('the full supported sixteen-player roster conserves prizes with equal stacks', () => {
  const players = Array.from({ length: 16 }, (_, index) => ({ id: `P${index}`, stack: 20 }));
  const start = performance.now();
  const result = calculateIcm(players, Array.from({ length: 16 }, (_, index) => 16 - index));
  assert.ok(performance.now() - start < 1000, 'supported limit must finish within the interactive budget');
  for (const value of Object.values(result.equities)) assert.ok(Math.abs(value - 8.5) < 1e-9);
  assert.ok(Math.abs(Object.values(result.equities).reduce((sum, value) => sum + value, 0) - 136) < 1e-9);
});
