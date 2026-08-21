import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeTournamentSummaryWithSnapshots, parsePokerStarsTournamentSummary, tournamentLobbyCsvToMetadata } from '../src/real-game/tournamentAdapters';
import { reconstructTournamentContextDrafts } from '../src/real-game/tournamentReconstruction';
import { parseHandHistoryText } from '../src/real-game/handHistory';

test('P15 full-field lobby CSV builds validated reusable tournament snapshots',()=>{const rows=[
 'tournament_id,hand_id,players_remaining,player_id,stack,bounty,generated_at,reference,methodology,utility_unit,payout_vector_json,tournament_name',
 'T55,H100,3,Hero,12000,25,2026-08-21T00:00:00Z,export://lobby,Full lobby export,dollar-ev,"[100,60,40]",Final',
 'T55,H100,3,V1,8000,10,2026-08-21T00:00:00Z,export://lobby,Full lobby export,dollar-ev,"[100,60,40]",Final',
 'T55,H100,3,V2,5000,5,2026-08-21T00:00:00Z,export://lobby,Full lobby export,dollar-ev,"[100,60,40]",Final',
 ].join('\n');const meta=tournamentLobbyCsvToMetadata(rows);assert.equal(meta.length,1);assert.equal(meta[0].snapshots[0].players.length,3);assert.equal(meta[0].snapshots[0].bounties?.Hero,25);});

test('P15 tournament summary extracts only explicit payouts and can replace placeholder payout vector',()=>{const summary=parsePokerStarsTournamentSummary(`PokerStars Tournament #T55, Sunday Final\n1: Alice won $100\n2: Bob won $60\n3: Carol won $40`,{reference:'summary://T55',generatedAt:'2026-08-21T00:00:00Z'});assert.deepEqual(summary.payouts,[100,60,40]);const csv=['tournament_id,hand_id,players_remaining,player_id,stack,bounty,generated_at,reference,methodology,utility_unit,payout_vector_json','T55,H100,2,Hero,12000,,2026-08-21T00:00:00Z,export://lobby,Full lobby export,dollar-ev,"[1]"','T55,H100,2,V1,8000,,2026-08-21T00:00:00Z,export://lobby,Full lobby export,dollar-ev,"[1]"'].join('\n');const merged=mergeTournamentSummaryWithSnapshots(summary,tournamentLobbyCsvToMetadata(csv)[0]);assert.deepEqual(merged.payouts,[100,60,40]);assert.match(merged.reference,/summary:\/\/T55/);});

test('P15 reconstructed HH becomes complete only when matching full-field snapshot exists',()=>{const hh=`PokerStars Hand #H100: Tournament #T55, Hold'em No Limit (500/1000) - 2026/08/21 03:00:00 ET\nTable 'Final' 6-max Seat #1 is the button\nSeat 1: Hero (12000 in chips)\nSeat 2: V1 (8000 in chips)\nHero: posts small blind 500\nV1: posts big blind 1000\n*** HOLE CARDS ***\nDealt to Hero [As Kd]\nHero: raises 1500 to 2000\nV1: folds`;const csv=['tournament_id,hand_id,players_remaining,player_id,stack,bounty,generated_at,reference,methodology,utility_unit,payout_vector_json','T55,H100,2,Hero,12000,,2026-08-21T00:00:00Z,export://lobby,Full lobby export,dollar-ev,"[100,60]"','T55,H100,2,V1,8000,,2026-08-21T00:00:00Z,export://lobby,Full lobby export,dollar-ev,"[100,60]"'].join('\n');const draft=reconstructTournamentContextDrafts(parseHandHistoryText(hh),tournamentLobbyCsvToMetadata(csv))[0];assert.equal(draft.completeFieldState,true);assert.equal(draft.playersRemaining,2);});
