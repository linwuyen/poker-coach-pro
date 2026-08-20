import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSemanticDecisionPairs } from '../src/learning-engine/semanticPairs';
import { PokerBenchPostflopRow, PokerBenchPreflopRow } from '../src/solver-data/pokerbench';

function preflop(id: string, overrides: Partial<PokerBenchPreflopRow> = {}): PokerBenchPreflopRow {
  return {
    id,
    split: 'preflop',
    prevLine: 'BTN raises 2.5',
    numPlayers: 6,
    numBets: 1,
    availableMoves: ['Fold', 'Call'],
    correctDecision: 'Call',
    potSize: 4,
    heroPosition: 'BB',
    holding: 'AhKd',
    ...overrides,
  };
}

function postflop(id: string, overrides: Partial<PokerBenchPostflopRow> = {}): PokerBenchPostflopRow {
  return {
    id,
    split: 'postflop',
    preflopAction: 'BTN raise 2.5 BB call',
    boardFlop: 'Ah7d2c',
    boardTurn: '',
    boardRiver: '',
    aggressorPosition: 'BTN',
    postflopAction: 'BTN bet 3',
    evaluationAt: 'Flop',
    availableMoves: ['Fold', 'Call'],
    correctDecision: 'Call',
    potSize: 9,
    heroPosition: 'BB',
    holding: 'KsQd',
    ...overrides,
  };
}

test('semantic pair requires solver label flip with only one controlled dimension changed', () => {
  const left = preflop('a');
  const right = preflop('b', { holding: '2h2d', correctDecision: 'Fold' });
  const pairs = buildSemanticDecisionPairs([left, right], { role: 'all' });
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].dimension, 'holding');
  assert.equal(pairs[0].left.correctDecision, 'Call');
  assert.equal(pairs[0].right.correctDecision, 'Fold');
});

test('rows that change multiple semantic dimensions are not mislabeled as a one-variable counterfactual', () => {
  const left = preflop('a');
  const right = preflop('b', { holding: '2h2d', heroPosition: 'SB', correctDecision: 'Fold' });
  const pairs = buildSemanticDecisionPairs([left, right], { role: 'all' });
  assert.equal(pairs.length, 0);
});

test('board-only solver flips become verified board counterfactuals', () => {
  const left = postflop('a');
  const right = postflop('b', { boardFlop: '9h8h7s', correctDecision: 'Fold' });
  const pairs = buildSemanticDecisionPairs([left, right], { role: 'all' });
  assert.ok(pairs.some(pair => pair.dimension === 'board'));
});

test('numeric action-line changes can be isolated as bet-size/pot-geometry changes', () => {
  const left = postflop('a', { postflopAction: 'BTN bet 3', potSize: 9, correctDecision: 'Call' });
  const right = postflop('b', { postflopAction: 'BTN bet 9', potSize: 15, correctDecision: 'Fold' });
  const pairs = buildSemanticDecisionPairs([left, right], { role: 'all' });
  assert.ok(pairs.some(pair => pair.dimension === 'bet-size'));
});
