import assert from 'node:assert/strict';
import test from 'node:test';
import { trainingLeakBoost } from '../src/learning-engine/dailySolverPlan';
import { PokerBenchPreflopRow } from '../src/solver-data/pokerbench';
import { HistoryItem } from '../src/types';

const row: PokerBenchPreflopRow = {
  id: 'pb-1', split: 'preflop', availableMoves: ['Fold', 'Call'], correctDecision: 'Call', potSize: 4,
  heroPosition: 'BB', holding: 'AKo', prevLine: 'BTN Raise 2.5', numPlayers: 6, numBets: 1,
};

function miss(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    schemaVersion: 6, trainingType: 'solver-corpus', scenarioId: 'train-1', category: ['Training'], score: 0,
    judgment: '錯誤', timestamp: 1, position: 'BB', street: 'Preflop', truthTier: 'verified-solver', evLossBB: 0.5,
    correct: false, ...overrides,
  };
}

test('truth-backed trainer mistakes boost only matching solver situations', () => {
  assert.ok(trainingLeakBoost(row, [miss()]) > 1);
  assert.equal(trainingLeakBoost({ ...row, heroPosition: 'BTN' }, [miss()]), 1);
  assert.equal(trainingLeakBoost(row, [miss({ position: 'BB', street: 'Flop' })]), 1);
});

test('ordinary wrong training decisions still route practice without inventing EV truth', () => {
  const history = [miss({ trainingType: 'scenario', truthTier: 'expert-baseline', evLossBB: undefined })];
  const boost = trainingLeakBoost(row, history);
  assert.ok(boost > 1);
  assert.ok(boost < trainingLeakBoost(row, [miss()]));
});
