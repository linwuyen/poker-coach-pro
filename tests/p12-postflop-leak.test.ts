import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHandHistoryText } from '../src/real-game/handHistory';
import { buildVerifiedPostflopLeakEvidence } from '../src/real-game/postflopLeakPipeline';
import { extractObservedPostflopDecisions } from '../src/real-game/postflopState';
import { PostflopTruthNode } from '../src/strategy-engine-v3';

const hh = `PokerStars Hand #12001: Hold'em No Limit ($0.50/$1.00 USD) - 2026/08/20 18:50:25 ET
Table 'Postflop' 6-max Seat #6 is the button
Seat 1: SB ($100 in chips)
Seat 2: BB ($100 in chips)
Seat 3: UTG ($100 in chips)
Seat 4: HJ ($100 in chips)
Seat 5: CO ($100 in chips)
Seat 6: Hero ($100 in chips)
SB: posts small blind $0.50
BB: posts big blind $1
*** HOLE CARDS ***
Dealt to Hero [As Kd]
UTG: folds
HJ: folds
CO: folds
Hero: raises $1.50 to $2.50
SB: folds
BB: calls $1.50
*** FLOP *** [Ah 8c 4d]
BB: checks
Hero: checks
*** TURN *** [Ah 8c 4d] [7s]
BB: checks
Hero: checks
*** SUMMARY ***`;

function truth(): PostflopTruthNode {
  return {
    schemaVersion: 3, id: 'solver-v3:flop-a84', version: '1', name: 'A84r cbet', description: 'fixture',
    context: {
      format: 'cash', tableSize: '6max', street: 'Flop', heroPosition: 'btn', villainPosition: 'bb', playersInHand: 2,
      effectiveStackBB: 97.5, potBB: 5.5, spr: 17.727, toCallBB: 0, board: ['Ah','8c','4d'],
      preflopLine: [
        { actor: 'utg', action: 'fold' }, { actor: 'hj', action: 'fold' }, { actor: 'co', action: 'fold' },
        { actor: 'btn', action: 'raise', toBB: 2.5 }, { actor: 'sb', action: 'fold' }, { actor: 'bb', action: 'call' },
      ],
      streetLine: [{ actor: 'bb', action: 'check' }], lastAggressorPosition: 'btn', rakePercent: 5, rakeCapBB: 2,
    },
    source: { type: 'solver', trustTier: 'verified-solver', label: 'fixture', reference: 'fixture://postflop', solverName: 'Fixture', solverVersion: '1', generatedAt: '2026-08-21T00:00:00Z', disclaimer: 'test' },
    strategyByCombo: { AsKd: { bet: 1 } }, evByCombo: { AsKd: { check: 0.9, bet: 1.2 } }, tags: ['test'],
  };
}

test('HH replay reconstructs pot, SPR, board and action line before Hero flop decision', () => {
  const hand = parseHandHistoryText(hh)[0];
  const observed = extractObservedPostflopDecisions(hand, { rakePercent: 5, rakeCapBB: 2 });
  assert.ok(observed.length >= 2);
  const flop = observed[0];
  assert.equal(flop.query.street, 'Flop');
  assert.equal(flop.query.potBB, 5.5);
  assert.equal(flop.query.effectiveStackBB, 97.5);
  assert.deepEqual(flop.query.board, ['Ah','8c','4d']);
  assert.equal(flop.query.streetLine.length, 1);
});

test('postflop HH becomes verified regret only under one exact v3 node with chosen-action EV', () => {
  const result = buildVerifiedPostflopLeakEvidence(parseHandHistoryText(hh), [truth()], { rakePercent: 5, rakeCapBB: 2 });
  assert.equal(result.matchedDecisions, 1);
  assert.equal(result.gradedDecisions, 1);
  assert.equal(result.history[0].street, 'Flop');
  assert.equal(result.history[0].truthTier, 'verified-solver');
  assert.ok(Math.abs((result.history[0].evLossBB || 0) - 0.3) < 1e-9);
});

test('postflop grading stays Unknown when rake context is missing', () => {
  const result = buildVerifiedPostflopLeakEvidence(parseHandHistoryText(hh), [truth()]);
  assert.equal(result.gradedDecisions, 0);
});
