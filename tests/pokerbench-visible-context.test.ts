import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as pokerBench from '../src/solver-data/pokerbench';
import * as solverSession from '../src/features/training/SolverDecisionSession';
import { fingerprintPokerBenchRow } from '../src/solver-data/contextFingerprint';
import { SemanticCounterfactualSession } from '../src/features/training/SemanticCounterfactualTrainer';
import { buildSemanticDecisionPairs, type SemanticDecisionPair } from '../src/learning-engine/semanticPairs';
import { pokerBenchPresentationFingerprint } from '../src/learning-engine/infiniteHandGenerator';
import * as contrastive from '../src/features/training/ContrastiveTrainer';

// Actual pinned PokerBench postflop-5 shape: turn/river columns are runout,
// while evaluationAt and the action line ask for a decision on the flop.
const flop: pokerBench.PokerBenchPostflopRow = {
  id: 'postflop-5', split: 'postflop', preflopAction: 'SB/3.0bb/BB/call',
  boardFlop: '5c5dAh', boardTurn: '3h', boardRiver: 'Kh', aggressorPosition: 'OOP',
  postflopAction: 'OOP_BET_2', evaluationAt: 'Flop', availableMoves: ['Fold', 'Call', 'Raise 9'],
  potSize: 8, heroPosition: 'IP', holding: 'Ad4h', correctDecision: 'Call',
};
const turn: pokerBench.PokerBenchPostflopRow = {
  ...flop, id: 'postflop-2', boardFlop: 'Ks7h2d', boardTurn: 'Jc', boardRiver: '7c',
  evaluationAt: 'Turn', holding: 'AhQd',
};
const csv = [
  'preflop_action,board_flop,board_turn,board_river,aggressor_position,postflop_action,evaluation_at,available_moves,pot_size,hero_position,holding,correct_decision',
  'SB/3.0bb/BB/call,5c5dAh,3h,Kh,OOP,OOP_BET_2,Flop,"[\'Fold\', \'Call\', \'Raise 9\']",8,IP,Ad4h,Call',
  'SB/3.0bb/BB/call,Ks7h2d,Jc,7c,IP,OOP_CHECK,Turn,"[\'Fold\', \'Call\']",164,IP,AhQd,Call',
].join('\n');

test('CSV ingestion discards future cards from flop and turn decisions', () => {
  const rows = pokerBench.parsePokerBenchCsv(csv, 'postflop') as pokerBench.PokerBenchPostflopRow[];
  assert.equal(rows[0].boardTurn, '');
  assert.equal(rows[0].boardRiver, '');
  assert.equal(rows[1].boardTurn, 'Jc');
  assert.equal(rows[1].boardRiver, '');
});

test('legacy direct rows display only the board available at the decision street', () => {
  for (const [row, visible] of [[flop, ['5c', '5d', 'Ah']], [turn, ['Ks', '7h', '2d', 'Jc']]] as const) {
    const html = renderToStaticMarkup(React.createElement(solverSession.SolverDecisionSession, {
      rows: [row], history: [], onRecord() {}, onExit() {}, onComplete() {},
    }));
    const codes = [...html.matchAll(/data-card-code="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(codes.slice(0, -2), visible);
    assert.match(html, /6-max/);
    assert.match(html, /100 BB/);
    assert.match(html, /MTT.*ICM/);
  }
});

test('future cards cannot change a current decision fingerprint', () => {
  assert.deepEqual(fingerprintPokerBenchRow(flop), fingerprintPokerBenchRow({ ...flop, boardTurn: '2c', boardRiver: '7s' }));
  assert.deepEqual(fingerprintPokerBenchRow(turn), fingerprintPokerBenchRow({ ...turn, boardRiver: 'Ac' }));
});

test('hand strength and draw math use the visible street even for legacy raw rows', () => {
  assert.equal(typeof solverSession.analyzePokerBenchHand, 'function');
  const result = solverSession.analyzePokerBenchHand(flop);
  assert.equal(result.boardCards.length, 3);
  assert.deepEqual(result, solverSession.analyzePokerBenchHand({ ...flop, boardTurn: '', boardRiver: '' }));
  assert.equal(solverSession.analyzePokerBenchHand(turn).boardCards.length, 4);
});

test('semantic direct-row presentation also hides the future runout', () => {
  const pair = { id: 'pair', split: 'postflop', dimension: 'holding', left: flop, right: { ...flop, holding: 'AsQc' }, leftValue: 'A4o', rightValue: 'AQo' } as SemanticDecisionPair;
  const html = renderToStaticMarkup(React.createElement(SemanticCounterfactualSession, {
    pairs: [pair], history: [], onRecord() {}, onExit() {}, onComplete() {},
  }));
  assert.doesNotMatch(html, /data-card-code="(?:3h|Kh)"/);
});

test('a dataset label mismatch records label accuracy without claiming a major EV error', () => {
  assert.equal(typeof pokerBench.pokerBenchDecisionGrade, 'function');
  assert.deepEqual(pokerBench.pokerBenchDecisionGrade('Raise 9', 'Call'), {
    correct: false, score: 0, judgment: '與資料集主動作不同', feedbackQuality: 'label-mismatch',
  });
  assert.equal(pokerBench.pokerBenchDecisionGrade(' call ', 'Call').correct, true);
});

test('future runouts cannot create another presentation', () => {
  const otherRunout = { ...flop, id: 'same-visible', boardTurn: '2c', boardRiver: '7s' };
  assert.equal(pokerBenchPresentationFingerprint(flop), pokerBenchPresentationFingerprint(otherRunout));
});

test('future runouts cannot create a semantic board counterfactual', () => {
  const otherRunout = { ...flop, id: 'same-visible', boardTurn: '2c', boardRiver: '7s' };
  assert.deepEqual(buildSemanticDecisionPairs([flop, { ...otherRunout, correctDecision: 'Fold' }], { role: 'all' }), []);
});

test('rows read back from memory cache are normalized after legacy caller mutation', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(csv);
  try {
    const loaded = await pokerBench.loadPokerBenchSplit('postflop', true) as pokerBench.PokerBenchPostflopRow[];
    loaded[0].boardTurn = '3h';
    loaded[0].boardRiver = 'Kh';
    const cached = await pokerBench.loadPokerBenchSplit('postflop') as pokerBench.PokerBenchPostflopRow[];
    assert.equal(cached[0].boardTurn, '');
    assert.equal(cached[0].boardRiver, '');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('contrastive cards and differences ignore future runouts in direct legacy rows', () => {
  assert.equal(typeof contrastive.SpotCard, 'function');
  const html = renderToStaticMarkup(React.createElement(contrastive.SpotCard, {
    label: 'A', row: flop, selected: null, onSelect() {}, disabled: false,
  }));
  assert.match(html, /5c5dAh/);
  assert.doesNotMatch(html, /3hKh/);
  assert.deepEqual(contrastive.describeDifferences(flop, { ...flop, boardTurn: '2c', boardRiver: '7s' }), []);
});

test('legacy exposure follows stable dataset identity across corrected fingerprints', () => {
  assert.equal(typeof pokerBench.pokerBenchHistoryMatchesRow, 'function');
  const old = { datasetRowId: flop.id, datasetSplit: pokerBench.POKERBENCH_FILES.postflop.split,
    truthSourceRevision: pokerBench.POKERBENCH_SOURCE.revision };
  assert.equal(pokerBench.pokerBenchHistoryMatchesRow(old, flop), true);
  assert.equal(pokerBench.pokerBenchHistoryMatchesRow({ ...old, truthSourceRevision: undefined }, flop), true);
  assert.equal(pokerBench.pokerBenchHistoryMatchesRow({ ...old, truthSourceRevision: 'another-solver-revision' }, flop), false);
  assert.equal(pokerBench.pokerBenchHistoryMatchesRow({ ...old, datasetRowId: 'another-row' }, flop), false);
  assert.equal(pokerBench.pokerBenchHistoryMatchesRow({ ...old, datasetSplit: 'preflop_1k_test' }, flop), false);
});

test('preflop numeric BB labels describe raises rather than checks', () => {
  // Actual pinned preflop shape observed by the browser regression.
  const row = pokerBench.parsePokerBenchCsv([
    'prev_line,hero_pos,hero_holding,correct_decision,num_players,num_bets,available_moves,pot_size',
    'CO/2.3bb/BTN/7.5bb,BB,KdTd,20.0bb,3,2,"[\'20.0bb\', \'fold\']",11.3',
  ].join('\n'), 'preflop')[0];
  assert.deepEqual(pokerBench.parsePokerDecision(row.correctDecision).action, { type: 'raise', sizeBB: 20 });
  assert.equal(solverSession.humanizeSolverMove(row.correctDecision), '加注到 20.0 BB');
});
