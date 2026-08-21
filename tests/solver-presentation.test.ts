import assert from 'node:assert/strict';
import test from 'node:test';
import {
  humanizeSolverMove,
  humanizeSolverPostflopLine,
  humanizeSolverPreflopLine,
  prettySolverCards,
} from '../src/features/training/SolverDecisionSession';

test('PokerBench card encodings are presented as readable cards', () => {
  assert.equal(prettySolverCards('AdTc'), 'A♦ T♣');
  assert.equal(prettySolverCards('5c2d3hTdQc'), '5♣ 2♦ 3♥ T♦ Q♣');
});

test('PokerBench actions are presented as poker language instead of dataset encoding', () => {
  assert.equal(humanizeSolverMove('Fold'), '棄牌');
  assert.equal(humanizeSolverMove('Call'), '跟注');
  assert.equal(humanizeSolverMove('Raise 22'), '加注到 22 BB');
  assert.equal(humanizeSolverMove('Bet 10'), '下注 10 BB');
});

test('preflop slash encoding becomes a readable action sequence', () => {
  assert.equal(
    humanizeSolverPreflopLine('CO/2.3bb/BTN/7.5bb/CO/call'),
    'CO 加注到 2.3 BB → BTN 加注到 7.5 BB → CO 跟注',
  );
});

test('postflop PokerBench encoding never leaks directly to the player', () => {
  const raw = 'OOP_CHECK/IP_CHECK/dealcards/Td/OOP_BET_10';
  const rendered = humanizeSolverPostflopLine(raw);
  assert.equal(rendered, 'OOP 過牌 → IP 過牌 → 發 T♦ → OOP 下注 10 BB');
  assert.equal(rendered.includes('OOP_CHECK'), false);
  assert.equal(rendered.includes('dealcards'), false);
});
