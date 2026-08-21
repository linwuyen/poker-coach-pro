import assert from 'node:assert/strict';
import test from 'node:test';
import { ParsedHandHistory } from '../src/real-game/handHistory';
import { evaluateTournamentHandContext, joinTournamentContextsToHands, validateTournamentHandContext } from '../src/real-game/tournamentContext';

const hand: ParsedHandHistory = {
  source: 'pokerstars', id: 'mtt-1', format: 'MTT', tableSize: 3, smallBlind: 500, bigBlind: 1000,
  heroName: 'Hero', heroPosition: 'BTN', heroStackBB: 20, board: [],
  players: [{ seat: 1, name: 'Hero', stack: 20000, stackBB: 20 }, { seat: 2, name: 'V', stack: 10000, stackBB: 10 }, { seat: 3, name: 'P3', stack: 30000, stackBB: 30 }],
  actions: [], collected: 0, contributed: 0, returned: 0, raw: 'fixture',
};

const icm = {
  schemaVersion: 1 as const, id: 'bubble-call', version: '1', handId: 'mtt-1', model: 'icm' as const,
  heroId: 'hero', players: [{ id: 'hero', stack: 20 }, { id: 'villain', stack: 10 }, { id: 'p3', stack: 30 }], payouts: [100, 60, 0],
  utilityUnit: 'dollar-ev' as const, chosenAction: 'call', reference: 'fixture://mtt-state', generatedAt: '2026-08-21T00:00:00Z', methodology: 'Explicit snapshot',
  villainId: 'villain', amountAtRisk: 10, showdownEquity: 0.35,
};

test('tournament utility refuses to infer missing payout/risk state from HH', () => {
  assert.throws(() => validateTournamentHandContext({ ...icm, payouts: [] }));
  assert.throws(() => validateTournamentHandContext({ ...icm, showdownEquity: undefined }));
});

test('explicit ICM context evaluates fold/call utility and joins by hand id', () => {
  const evaluated = evaluateTournamentHandContext(icm);
  assert.equal(evaluated.handId, 'mtt-1');
  assert.ok(Number.isFinite(evaluated.utilityLoss));
  const joined = joinTournamentContextsToHands([hand], [icm], 123);
  assert.equal(joined.history.length, 1);
  assert.equal(joined.history[0].truthTier, 'exact-math');
  assert.equal(joined.history[0].utilityModel, 'icm');
  assert.equal(joined.unmatchedContextIds.length, 0);
});

test('FGS context uses only explicit probability trees and reports chosen-action regret', () => {
  const rootPlayers = [{ id: 'hero', stack: 20 }, { id: 'villain', stack: 10 }, { id: 'p3', stack: 30 }];
  const fgs = {
    schemaVersion: 1 as const, id: 'fgs-spot', version: '1', handId: 'mtt-1', model: 'fgs' as const,
    heroId: 'hero', players: rootPlayers, payouts: [100, 60, 0], utilityUnit: 'dollar-ev' as const,
    chosenAction: 'fold', reference: 'fixture://sim', generatedAt: '2026-08-21T00:00:00Z', methodology: 'Explicit simulator branches',
    actionTrees: [
      { action: 'fold', root: { id: 'fold-root', players: rootPlayers } },
      { action: 'jam', root: { id: 'jam-root', players: rootPlayers, children: [
        { id: 'jam-win', probability: 0.55, players: [{ id: 'hero', stack: 30 }, { id: 'villain', stack: 0 }, { id: 'p3', stack: 30 }] },
        { id: 'jam-lose', probability: 0.45, players: [{ id: 'hero', stack: 10 }, { id: 'villain', stack: 20 }, { id: 'p3', stack: 30 }] },
      ] } },
    ],
  };
  const result = evaluateTournamentHandContext(fgs);
  assert.ok(result.bestUtility >= result.chosenUtility);
  assert.ok(result.utilityLoss >= 0);
});
