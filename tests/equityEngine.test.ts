import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateEquity, evaluateHoldem, expandHandNotation, parseCardsText } from '../src/poker/equityEngine';

function score(cards: string) { return evaluateHoldem(parseCardsText(cards)); }

test('hand evaluator orders straight flush above quads and full house', () => {
  const straightFlush = score('As Ks Qs Js Ts 2d 3c');
  const quads = score('Ah Ad Ac As Kd 2c 3h');
  const fullHouse = score('Kh Kd Kc Qs Qd 2c 3h');
  assert.ok(straightFlush[0] > quads[0]);
  assert.ok(quads[0] > fullHouse[0]);
});

test('canonical range expansion respects suitedness and blockers', () => {
  assert.equal(expandHandNotation('AKs').length, 4);
  assert.equal(expandHandNotation('AKo').length, 12);
  assert.equal(expandHandNotation('QQ').length, 6);
  assert.equal(expandHandNotation('AKs', parseCardsText('As')).length, 3);
});

test('river equity is exact and deterministic', () => {
  const result = calculateEquity({
    hero: parseCardsText('As Ah'),
    board: parseCardsText('Ac Kd 7s 2c 3h'),
    villainRange: [{ hand: 'KK' }, { hand: 'QQ' }],
  });
  assert.equal(result.method, 'exact');
  assert.equal(result.equity, 100);
});

test('turn equity enumerates all live rivers exactly for a small range', () => {
  const result = calculateEquity({
    hero: parseCardsText('As Ks'),
    board: parseCardsText('Qs Js 2c 4d'),
    villainRange: [{ hand: 'QQ', weight: 1 }],
    exactStateLimit: 100000,
  });
  assert.equal(result.method, 'exact');
  assert.ok(result.samples > 0);
  assert.ok(result.equity > 0 && result.equity < 100);
});

test('preflop large state spaces fall back to seeded Monte Carlo', () => {
  const request = {
    hero: parseCardsText('As Ks'),
    villainRange: [{ hand: 'QQ' }, { hand: 'JJ' }, { hand: 'AKo' }],
    iterations: 4000,
    seed: 42,
    exactStateLimit: 100,
  };
  const first = calculateEquity(request);
  const second = calculateEquity(request);
  assert.equal(first.method, 'monte-carlo');
  assert.equal(first.equity, second.equity);
  assert.equal(first.samples, 4000);
});
