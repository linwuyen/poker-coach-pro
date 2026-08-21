import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHandHistoryText } from '../src/real-game/handHistory';
import { reconstructTournamentContextDrafts, validateTournamentMetadata } from '../src/real-game/tournamentReconstruction';

const hh = `PokerStars Hand #14001: Tournament #777001, Hold'em No Limit (500/1000) - 2026/08/20 18:50:25 ET
Table '777001 1' 3-max Seat #1 is the button
Seat 1: Hero (20000 in chips)
Seat 2: V (10000 in chips)
Seat 3: P3 (30000 in chips)
Hero: posts small blind 500
V: posts big blind 1000
*** HOLE CARDS ***
Dealt to Hero [As Kd]
P3: folds
Hero: raises 1500 to 2000
V: folds
*** SUMMARY ***`;

const metadata = {
  schemaVersion: 1 as const,
  tournamentId: '777001',
  generatedAt: '2026-08-21T00:00:00Z',
  reference: 'fixture://lobby-export',
  methodology: 'Full lobby stack snapshot captured at hand start.',
  payouts: [100, 60, 0],
  utilityUnit: 'dollar-ev' as const,
  snapshots: [{
    handId: '14001', playersRemaining: 3,
    players: [{ id: 'Hero', stack: 20000 }, { id: 'V', stack: 10000 }, { id: 'P3', stack: 30000 }],
  }],
};

test('tournament reconstruction extracts hand/tournament identity and joins one reusable lobby snapshot', () => {
  validateTournamentMetadata(metadata);
  const draft = reconstructTournamentContextDrafts(parseHandHistoryText(hh), [metadata])[0];
  assert.equal(draft.tournamentId, '777001');
  assert.equal(draft.completeFieldState, true);
  assert.equal(draft.playersRemaining, 3);
  assert.deepEqual(draft.payouts, [100,60,0]);
  assert.equal(draft.missing.length, 0);
});

test('ordinary MTT HH never silently treats table stacks as full tournament state', () => {
  const draft = reconstructTournamentContextDrafts(parseHandHistoryText(hh), [])[0];
  assert.equal(draft.completeFieldState, false);
  assert.ok(draft.missing.includes('tournament-metadata'));
  assert.equal(draft.fullFieldPlayers, undefined);
});
