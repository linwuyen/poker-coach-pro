import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCardsText } from '../src/poker/equityEngine';
import { analyzeHandMath, evaluateHandStrength } from '../src/utils/handMath';

const strength = (hole: string, board: string) => evaluateHandStrength(parseCardsText(hole), parseCardsText(board));
const draws = (hole: string, board: string) => analyzeHandMath(parseCardsText(hole), parseCardsText(board));

test('a pair supplied entirely by the board is not Hero top, middle or bottom pair', () => {
  for (const [hole, board] of [['Td 9s', 'Jc Jh 4s'], ['Ah Qd', 'Jc Jh Ks'], ['Ah Qd', '2c 2h Ks']]) {
    const result = strength(hole, board);
    assert.equal(result.level, 2);
    assert.match(result.name, /公共牌.*一對|Board Pair/i);
    assert.doesNotMatch(result.name, /Top Pair|Middle Pair|Bottom Pair/);
  }
  assert.match(strength('Jd 9s', 'Jc 8h 4s').name, /Top Pair/);
  assert.match(strength('Qd Qs', 'Jc 8h 4s').name, /Overpair/);
});

test('playing the board compares every best-five tiebreaker and discards unused hole cards', () => {
  for (const [hole, board] of [
    ['Td 9s', 'Ac Ad Kc Kh Qs'],
    ['2d 2s', 'Ac Ad Kc Kh Qs'],
    ['2h 3d', 'Ah Kh Qh Jh 9h'],
    ['8c 7d', 'Ac Kd Qh Js Tc'],
    ['2c 3d', 'Ah As Ad Ac Kd'],
  ]) assert.match(strength(hole, board).name, /Playing the board/i, `${hole} / ${board}`);
  for (const [hole, board] of [
    ['Ad 9s', 'Kc Kd Qc Qh 2s'],
    ['Th 3d', 'Ah Kh Qh Jh 9h'],
    ['Tc 2d', '9c 8d 7h 6s 5c'],
    ['Ac 3d', 'Kh Ks Kd Kc 2d'],
  ]) assert.doesNotMatch(strength(hole, board).name, /Playing the board/i, `${hole} / ${board}`);
  assert.equal(strength('Ah Ad', 'As Kh Kd Kc 2s').level, 7, 'two triplets use the higher trips in a full house');
});

test('a made flush counts one straight-flush out separately from five flush upgrades', () => {
  const result = draws('Qh 9h', 'Jh 4h 5s Kh');
  assert.equal(result.outs, 6);
  assert.deepEqual([...result.outCards].sort(), ['5h', '6h', '7h', '8h', 'Ah', 'Th']);
  assert.deepEqual(result.outsByType, { straight: 0, flush: 0, straightFlush: 1, flushUpgrade: 5 });
  assert.match(result.drawDescription, /同花順.*1.*同花升級.*5/);
  assert.doesNotMatch(result.drawDescription, /Gutshot|卡順/);
  assert.equal(result.hitProbNext, 13);
});

test('a future board-only flush does not count as a Hero flush improvement', () => {
  const result = draws('2h Ac', 'Kh Qh Jh 9h');
  assert.equal(result.outs, 0);
  assert.equal(result.hasDraw, false);
});

test('straight and flush completion cards are disjoint, retain wheels, and name double gutshots accurately', () => {
  const combo = draws('Ah 5h', '2h 3h Kc');
  assert.equal(combo.outs, 12);
  assert.deepEqual(combo.outsByType, { straight: 3, flush: 8, straightFlush: 1, flushUpgrade: 0 });
  assert.equal(new Set(combo.outCards).size, 12);
  const doubleGutshot = draws('Jh 9c', '7s 8d Kc');
  assert.equal(doubleGutshot.outs, 4, 'only tens complete this gutshot');
  assert.equal(draws('Jh 9c', '7s Td Kc').outs, 8, 'eights and queens complete separate internal gaps');
  assert.match(draws('Jh 9c', '7s Td Kc').drawDescription, /Double Gutshot|雙卡順/);
  assert.equal(draws('Ah 2c', '3s 4d Kc').outs, 4);
  assert.equal(draws('Ah Kc', '2s 3d 4c 5h').outs, 0, 'board-only sixes do not improve Hero wheel');
  assert.equal(draws('Ah Kh', '2h 3h 7c 8s 9d').outs, 0, 'river has no next card');
});
