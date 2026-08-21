import assert from 'node:assert/strict';
import test from 'node:test';
import { FgsNode, calculateFgs, calculateIcm, compareFgsActions } from '../src/tournament/icm';

const payouts = [50, 30, 20];
const root: FgsNode = {
  id: 'root',
  players: [{ id: 'Hero', stack: 30 }, { id: 'V1', stack: 40 }, { id: 'V2', stack: 30 }],
  children: [
    { id: 'a', probability: 0.6, players: [{ id: 'Hero', stack: 60 }, { id: 'V1', stack: 10 }, { id: 'V2', stack: 30 }] },
    { id: 'b', probability: 0.4, players: [{ id: 'Hero', stack: 0 }, { id: 'V1', stack: 70 }, { id: 'V2', stack: 30 }] },
  ],
};

test('FGS performs probability-weighted backward induction over exact ICM leaves', () => {
  const result = calculateFgs({ root, payouts, heroId: 'Hero' });
  const a = calculateIcm(root.children![0].players!, payouts).equities.Hero;
  const b = calculateIcm(root.children![1].players!, payouts).equities.Hero;
  assert.ok(Math.abs(result.heroEquity - (0.6 * a + 0.4 * b)) < 1e-10);
  assert.equal(result.leafCount, 2);
  assert.equal(result.nodeCount, 3);
  assert.equal(result.maxDepth, 1);
});

test('FGS refuses hidden probability mass instead of normalizing invented branches', () => {
  const broken: FgsNode = { ...root, id: 'broken', children: root.children!.map((child, index) => ({ ...child, id: `broken-${index}`, probability: 0.4 })) };
  assert.throws(() => calculateFgs({ root: broken, payouts, heroId: 'Hero' }), /probabilities must sum to 1/);
});

test('FGS requires eliminated players to remain in the state with stack zero', () => {
  const broken: FgsNode = {
    id: 'root2',
    players: root.players,
    children: [
      { id: 'only', probability: 1, players: [{ id: 'V1', stack: 70 }, { id: 'V2', stack: 30 }] },
    ],
  };
  assert.throws(() => calculateFgs({ root: broken, payouts, heroId: 'Hero' }), /preserve the same player ids/);
});

test('FGS action comparison ranks supplied action trees by conditional hero dollar EV', () => {
  const safer: FgsNode = { id: 'safe-root', players: root.players, children: [{ id: 'safe-leaf', probability: 1, players: [{ id: 'Hero', stack: 35 }, { id: 'V1', stack: 35 }, { id: 'V2', stack: 30 }] }] };
  const rows = compareFgsActions([{ action: 'Risk', root }, { action: 'Safe', root: safer }], payouts, 'Hero');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].deltaVsBest, 0);
  assert.ok(rows[1].deltaVsBest <= 0);
});
