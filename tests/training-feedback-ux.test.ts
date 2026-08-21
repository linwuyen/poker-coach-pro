import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { automaticSolverAnalysis, parseSolverCards } from '../src/features/training/SolverDecisionSession';
import type { PokerBenchPostflopRow } from '../src/solver-data/pokerbench';

const solverRow: PokerBenchPostflopRow = {
  id: 'postflop-ux-contract',
  split: 'postflop',
  availableMoves: ['Fold', 'Call', 'Raise 25'],
  correctDecision: 'Call',
  potSize: 18,
  heroPosition: 'OOP',
  holding: 'Kh8c',
  preflopAction: 'SB/3.0bb/BB/call',
  boardFlop: 'Ks7h2d',
  boardTurn: 'Jc',
  boardRiver: '7c',
  aggressorPosition: 'IP',
  postflopAction: 'OOP_CHECK/IP_BET_2/OOP_CALL/DealCard/Jc/OOP_CHECK/IP_CHECK/DealCard/7c/OOP_CHECK/IP_BET_8',
  evaluationAt: 'River',
};

test('PokerBench card codes become real CardUI-compatible cards', () => {
  assert.deepEqual(parseSolverCards('Kh8c'), [
    { rank: 'K', suit: 'hearts' },
    { rank: '8', suit: 'clubs' },
  ]);
  assert.deepEqual(parseSolverCards('Ks7h2dJc7c').map(card => `${card.rank}:${card.suit}`), [
    'K:spades', '7:hearts', '2:diamonds', 'J:clubs', '7:clubs',
  ]);
});

test('correct solver answers still receive teaching analysis', () => {
  const lines = automaticSolverAnalysis(solverRow, 'Call');
  assert.ok(lines.length >= 2);
  assert.match(lines.join('\n'), /選對跟注|optimal label/i);
  assert.match(lines.join('\n'), /沒有 per-action EV|沒有 per-action ev/i);
});

test('training UX requires explicit next and exposes explanations/tools', () => {
  const training = readFileSync('src/features/training/TrainingSession.tsx', 'utf8');
  const solver = readFileSync('src/features/training/SolverDecisionSession.tsx', 'utf8');

  assert.doesNotMatch(training, /setTimeout\(\(\)\s*=>\s*next\(\)/);
  assert.doesNotMatch(solver, /setTimeout\(\(\)\s*=>\s*next\(\)/);
  assert.doesNotMatch(training, /正確\s*·\s*自動下一個決策/);
  assert.doesNotMatch(solver, /正確\s*·\s*直接下一手/);

  assert.match(training, /data-testid="decision-explanation"/);
  assert.match(training, /其他選項為什麼不同/);
  assert.match(training, /Range \/ EV \/ Solver 證據/);
  assert.match(training, /AdvancedToolLinks/);

  assert.match(solver, /data-testid="solver-hole-cards"/);
  assert.match(solver, /data-testid="solver-board-cards"/);
  assert.match(solver, /<CardUI/);
  assert.match(solver, /答對了 · 先看完整 Solver 解說/);
  assert.match(solver, /AdvancedToolLinks/);
});
