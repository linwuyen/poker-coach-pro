import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHandHistoryText } from '../src/real-game/handHistory';
import { buildVerifiedLeakEvidence } from '../src/real-game/leakPipeline';
import { StrategyProfile } from '../src/strategy-engine-v2/types';

const handText = `PokerStars Hand #9001: Hold'em No Limit ($0.50/$1.00 USD) - 2026/08/20 18:50:25 ET
Table 'Truth' 6-max Seat #6 is the button
Seat 1: P1 ($100 in chips)
Seat 2: P2 ($100 in chips)
Seat 3: P3 ($100 in chips)
Seat 4: P4 ($100 in chips)
Seat 5: P5 ($100 in chips)
Seat 6: Hero ($100 in chips)
P1: posts small blind $0.50
P2: posts big blind $1
*** HOLE CARDS ***
Dealt to Hero [Ah Kd]
Hero: raises $1.50 to $2.50
P1: folds
P2: folds
*** SUMMARY ***`;

function profile(stackDepthBB = 100): StrategyProfile {
  return {
    schemaVersion: 2,
    id: `solver:btn-rfi-${stackDepthBB}`,
    version: '1',
    name: `BTN RFI ${stackDepthBB}BB`,
    description: 'fixture',
    context: { format: 'cash', tableSize: '6max', spot: 'rfi', position: 'btn', stackDepthBB, anteBB: 0, rakePercent: 5, rakeCapBB: 2 },
    source: { type: 'solver', trustTier: 'verified-solver', label: 'fixture', reference: 'fixture://rfi', solverName: 'Fixture', solverVersion: '1', generatedAt: '2026-08-20T00:00:00Z', disclaimer: 'test' },
    ranges: { AKo: { raise: 1 } },
    evByHand: { AKo: { raise: 0.45, fold: 0 } },
    tags: ['test'],
  };
}

test('HH decision becomes verified regret evidence only under one exact immutable truth context', () => {
  const hands = parseHandHistoryText(handText);
  const result = buildVerifiedLeakEvidence(hands, [profile()], { rakePercent: 5, rakeCapBB: 2, importedAt: 123 });
  assert.equal(result.heroDecisions, 1);
  assert.equal(result.matchedDecisions, 1);
  assert.equal(result.gradedDecisions, 1);
  assert.equal(result.history[0].truthTier, 'verified-solver');
  assert.equal(result.history[0].evLossBB, 0);
  assert.equal(result.history[0].sourceHandId, '9001');
});

test('missing rake context leaves the same HH as exposure-only instead of pretending exact truth', () => {
  const result = buildVerifiedLeakEvidence(parseHandHistoryText(handText), [profile()]);
  assert.equal(result.matchedDecisions, 0);
  assert.equal(result.gradedDecisions, 0);
  assert.equal(result.history.length, 0);
  assert.equal(result.unsupportedDecisions, 1);
});

test('heuristic profile can never auto-grade a real hand even if its shape matches', () => {
  const heuristic: StrategyProfile = { ...profile(), source: { ...profile().source, type: 'heuristic', trustTier: 'heuristic-estimate' } };
  const result = buildVerifiedLeakEvidence(parseHandHistoryText(handText), [heuristic], { rakePercent: 5, rakeCapBB: 2 });
  assert.equal(result.gradedDecisions, 0);
});

test('first-in multiway grading uses the shortest live effective stack instead of Hero stack', () => {
  const shortBlind = handText.replace('Seat 2: P2 ($100 in chips)', 'Seat 2: P2 ($20 in chips)');
  const result = buildVerifiedLeakEvidence(parseHandHistoryText(shortBlind), [profile(20)], { rakePercent: 5, rakeCapBB: 2 });
  assert.equal(result.matchedDecisions, 1);
  assert.equal(result.gradedDecisions, 1);
  assert.equal(result.history[0].truthSourceId, 'solver:btn-rfi-20');
});
