import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  canonicalHolding,
  decisionsMatch,
  deterministicSample,
  isSizingDecisionRow,
  parsePokerBenchCsv,
  parsePokerDecision,
  POKERBENCH_SOURCE,
} from '../src/solver-data/pokerbench';

test('PokerBench source is pinned and licensed', () => {
  assert.equal(POKERBENCH_SOURCE.license, 'Apache-2.0');
  assert.match(POKERBENCH_SOURCE.revision, /^[a-f0-9]{40}$/);
  assert.match(POKERBENCH_SOURCE.dataset, /huggingface\.co\/datasets\/RZ412\/PokerBench/);
});

test('preflop CSV parser preserves quoted move arrays', () => {
  const csv = [
    'prev_line,hero_pos,hero_holding,correct_decision,num_players,num_bets,available_moves,pot_size',
    '"UTG/2.0bb/BTN/call/SB/13.0bb/BB/allin/UTG/fold/BTN/fold",SB,KdKc,call,4,3,"[\'call\', \'fold\']",117.0',
  ].join('\n');
  const rows = parsePokerBenchCsv(csv, 'preflop');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].holding, 'KdKc');
  assert.deepEqual(rows[0].availableMoves, ['call', 'fold']);
  assert.equal(rows[0].correctDecision, 'call');
});

test('postflop parser keeps solver bet size as an action', () => {
  const csv = [
    'preflop_action,board_flop,board_turn,board_river,aggressor_position,postflop_action,evaluation_at,available_moves,pot_size,hero_position,holding,correct_decision',
    '"HJ/2.0bb/BB/call",Ks7h2d,Jc,7c,OOP,"OOP_CHECK/IP_CHECK/dealcards/Jc/OOP_CHECK/IP_BET_5/OOP_RAISE_14",River,"[\'Check\', \'Bet 24\']",32,IP,8h8c,"Bet 24"',
  ].join('\n');
  const rows = parsePokerBenchCsv(csv, 'postflop');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].split, 'postflop');
  assert.deepEqual(rows[0].availableMoves, ['Check', 'Bet 24']);
  assert.ok(isSizingDecisionRow(rows[0]));
  assert.equal(rows[0].correctDecision, 'Bet 24');
});

test('solver decision parser preserves action and amount', () => {
  assert.deepEqual(parsePokerDecision('Bet 24').action, { type: 'bet', sizeBB: 24 });
  assert.deepEqual(parsePokerDecision('Raise 18.5').action, { type: 'raise', sizeBB: 18.5 });
  assert.deepEqual(parsePokerDecision('allin').action, { type: 'all-in' });
  assert.ok(decisionsMatch('  BET   24 ', 'Bet 24'));
  assert.equal(decisionsMatch('Bet 24', 'Bet 18'), false);
});

test('exact holdings normalize to canonical preflop classes', () => {
  assert.equal(canonicalHolding('KdKc'), 'KK');
  assert.equal(canonicalHolding('AsKs'), 'AKs');
  assert.equal(canonicalHolding('AsKd'), 'AKo');
});

test('deterministic sampling is stable and seed dependent', () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({ id: String(index + 1) }));
  const first = deterministicSample(rows, 6, 'alpha').map(item => item.id);
  const again = deterministicSample(rows, 6, 'alpha').map(item => item.id);
  const other = deterministicSample(rows, 6, 'beta').map(item => item.id);
  assert.deepEqual(first, again);
  assert.notDeepEqual(first, other);
  assert.equal(new Set(first).size, 6);
});

test('sizing trainer no longer embeds heuristic EV values', () => {
  const source = fs.readFileSync('src/features/training/SizingTrainer.tsx', 'utf8');
  assert.doesNotMatch(source, /evBB|heuristic-estimate|EV Regret/);
  assert.match(source, /PokerBenchTrainer/);
});
