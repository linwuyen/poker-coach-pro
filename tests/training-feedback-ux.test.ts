import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { AnalysisContext, analysisContextHref, readAnalysisContextFromHash, startingHandFromCodes } from '../src/features/analysis/analysisContext';
import { automaticSolverAnalysis, parseSolverCards } from '../src/features/training/SolverDecisionSession';
import { selectTargetedReviewCandidates } from '../src/learning-engine/targetedReview';
import type { InfiniteHandCandidate } from '../src/learning-engine/infiniteHandGenerator';
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
  assert.equal(startingHandFromCodes(['Kh', '8c']), 'K8o');
});

test('analysis context survives hash links without inventing data', () => {
  const context: AnalysisContext = {
    schemaVersion: 1,
    capturedAt: 1,
    source: 'pokerbench',
    heroCards: ['Kh', '8c'],
    boardCards: ['Ks', '7h', '2d', 'Jc', '7c'],
    startingHand: 'K8o',
    street: 'River',
    position: 'OOP',
    potBB: 18,
    selectedAction: 'Call',
    bestAction: 'Call',
    truthTier: 'verified-solver',
  };
  const href = analysisContextHref('#equity-workbench', context);
  assert.match(href, /^#equity-workbench\?ctx=/);
  assert.deepEqual(readAnalysisContextFromHash(href), context);
});

test('correct solver answers still receive teaching analysis', () => {
  const lines = automaticSolverAnalysis(solverRow, 'Call');
  assert.ok(lines.length >= 2);
  assert.match(lines.join('\n'), /選對跟注|optimal label/i);
  assert.match(lines.join('\n'), /沒有 per-action EV|沒有 per-action ev/i);
});

test('targeted repair selects three truth-gated structural siblings', () => {
  const make = (id: string, values: Partial<InfiniteHandCandidate> = {}) => ({
    kind: 'solver', id, source: 'pokerbench', familyId: 'family-a', presentationFingerprint: id,
    truthLabel: 'verified solver label', street: 'River', position: 'OOP', format: 'solver', stackBand: 'unknown', actionClass: 'call',
    ...values,
  }) as unknown as InfiniteHandCandidate;
  const failed = make('failed');
  const pool = [failed, make('same-family-1'), make('same-family-2'), make('same-family-3'), make('unrelated', { familyId: 'x', street: 'Preflop', position: 'BTN', actionClass: 'raise' })];
  const selected = selectTargetedReviewCandidates(pool, failed, [], 3);
  assert.deepEqual(selected.map(item => item.id), ['same-family-1', 'same-family-2', 'same-family-3']);
});

test('training UX requires explicit next and exposes contextual analysis tools', () => {
  const training = readFileSync('src/features/training/TrainingSession.tsx', 'utf8');
  const solver = readFileSync('src/features/training/SolverDecisionSession.tsx', 'utf8');
  const semantic = readFileSync('src/features/training/SemanticCounterfactualTrainer.tsx', 'utf8');
  const tools = readFileSync('src/features/training/AdvancedToolLinks.tsx', 'utf8');
  const main = readFileSync('src/main.tsx', 'utf8');

  assert.doesNotMatch(training, /setTimeout\(\(\)\s*=>\s*next\(\)/);
  assert.doesNotMatch(solver, /setTimeout\(\(\)\s*=>\s*next\(\)/);
  assert.doesNotMatch(semantic, /setTimeout\(\(\)\s*=>\s*next\(\)/);
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

  assert.match(semantic, /data-testid="semantic-next"/);
  assert.match(semantic, /<CardUI/);
  assert.match(tools, /#current-analysis/);
  assert.match(tools, /analysisContextHref/);
  assert.match(tools, /#semantic-counterfactual/);
  assert.match(main, /analysisRouteFromHash/);
});
