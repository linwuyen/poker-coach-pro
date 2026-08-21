import assert from 'node:assert/strict';
import test from 'node:test';
import { verifiedRealGameLeakBoost } from '../src/learning-engine/dailySolverPlan';
import { PokerBenchPreflopRow } from '../src/solver-data/pokerbench';
import { HistoryItem } from '../src/types';

const row: PokerBenchPreflopRow = {
  id: 'pb-1', split: 'preflop', availableMoves: ['Fold', 'Call'], correctDecision: 'Call', potSize: 4,
  heroPosition: 'BB', holding: 'AKo', prevLine: 'BTN Raise 2.5', numPlayers: 6, numBets: 1,
};

test('verified cash HH regret boosts only matching situation-level Daily priority', () => {
  const history: HistoryItem[] = [{
    schemaVersion: 6, trainingType: 'real-hand', scenarioId: 'hh-grade-1', category: ['Real Game'], score: 4,
    judgment: 'verified-regret', timestamp: 1, position: 'BB', street: 'Preflop', truthTier: 'verified-solver', evLossBB: 0.5,
    gameFormat: 'Cash', utilityUnit: 'bb', utilityModel: 'cash-chip-ev', spotFrequencyPer100Hands: 4, correct: false,
  }];
  assert.ok(verifiedRealGameLeakBoost(row, history) > 1);
  assert.equal(verifiedRealGameLeakBoost({ ...row, heroPosition: 'BTN' }, history), 1);
  assert.equal(verifiedRealGameLeakBoost(row, [{ ...history[0], truthTier: 'heuristic-estimate' }]), 1);
  assert.equal(verifiedRealGameLeakBoost(row, [{ ...history[0], gameFormat: 'MTT', utilityUnit: undefined, utilityModel: 'priority-only' }]), 1);
});
