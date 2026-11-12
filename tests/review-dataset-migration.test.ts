import assert from 'node:assert/strict';
import test from 'node:test';
import { currentDueReviews } from '../src/learning-engine';
import { candidateLearningSignal } from '../src/learning-engine/closedLoop';
import type { InfiniteHandCandidate } from '../src/learning-engine/infiniteHandGenerator';
import { solverDecisionFamilyId } from '../src/learning-engine/semanticPairs';
import { POKERBENCH_SOURCE, type PokerBenchPostflopRow } from '../src/solver-data/pokerbench';
import type { HistoryItem } from '../src/types';

const now = 1_800_000_000_000;
const row: PokerBenchPostflopRow = { id: 'postflop-5', split: 'postflop', preflopAction: 'SB/3.0bb/BB/call',
  boardFlop: '5c5dAh', boardTurn: '3h', boardRiver: 'Kh', aggressorPosition: 'OOP', postflopAction: 'OOP_BET_2',
  evaluationAt: 'Flop', availableMoves: ['Fold', 'Call', 'Raise 9'], potSize: 8, heroPosition: 'IP', holding: 'Ad4h', correctDecision: 'Call' };
// Reconstructed from the pinned row: full-runout vs visible-flop texture fingerprints.
const oldFamily = 'solver:postflop:pb-2f0f5ab1:A4o';
const correctedFamily = 'solver:postflop:pb-6c6991be:A4o';
const old: HistoryItem = { scenarioId: 'daily-solver:postflop_10k_test:postflop-5', trainingType: 'solver-corpus',
  decisionFamilyId: oldFamily, masteryKey: `${oldFamily}::solver-decision`, stepId: 'solver-decision', category: ['PokerBench'],
  datasetRowId: row.id, datasetSplit: 'postflop_10k_test', truthSourceId: POKERBENCH_SOURCE.id,
  timestamp: now - 3000, nextReviewAt: now - 1000, score: 0, correct: false, judgment: 'old mismatch' };
const reviewed: HistoryItem = { ...old, decisionFamilyId: correctedFamily, masteryKey: `${correctedFamily}::solver-decision`,
  decisionContextVersion: 2, timestamp: now - 500, nextReviewAt: now + 86_400_000, score: 10, correct: true, judgment: 'corrected review' };

test('corrected postflop-5 schedule supersedes its expired full-runout fingerprint', () => {
  assert.equal(solverDecisionFamilyId(row), correctedFamily);
  assert.deepEqual(currentDueReviews([reviewed, old], now), []);
  assert.deepEqual(currentDueReviews([old, reviewed], now + 86_400_001), [reviewed]);
  const candidate: InfiniteHandCandidate = { id: 'pokerbench:postflop:postflop-5', kind: 'solver', source: 'pokerbench',
    familyId: correctedFamily, presentationFingerprint: 'test-presentation', truthTier: 'verified-solver', truthLabel: 'label',
    street: 'Flop', position: 'IP', format: 'solver', stackBand: 'unknown', actionClass: 'call', row };
  assert.equal(candidateLearningSignal(candidate, [old, reviewed], now).duePressure, 0);
});

test('legacy missing split joins an unambiguous current dataset schedule', () => {
  assert.deepEqual(currentDueReviews([{ ...old, datasetSplit: undefined, truthSourceId: undefined }, reviewed], now), []);
});

test('stable schedule identities keep distinct dataset sources and known splits separate', () => {
  assert.deepEqual(currentDueReviews([old, { ...reviewed, truthSourceId: 'other-source' }], now), [old]);
  assert.deepEqual(currentDueReviews([old, { ...reviewed, datasetSplit: 'other-split' }], now), [old]);
});
