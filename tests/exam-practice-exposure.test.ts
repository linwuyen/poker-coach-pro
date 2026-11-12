import assert from 'node:assert/strict';
import test from 'node:test';
import * as exam from '../src/features/training/ExamMode';
import { POKERBENCH_SOURCE, type PokerBenchPostflopRow } from '../src/solver-data/pokerbench';
import { solverCorpusRole } from '../src/learning-engine/solverCurriculum';
import type { HistoryItem } from '../src/types';

// Source postflop-5 moved from training to holdout after future-card removal.
const row: PokerBenchPostflopRow = { id: 'postflop-5', split: 'postflop', holding: 'Ad4h', heroPosition: 'IP', potSize: 8,
  availableMoves: ['Fold', 'Call', 'Raise 9'], correctDecision: 'Call', preflopAction: 'SB/3.0bb/BB/call', boardFlop: '5c5dAh', boardTurn: '3h', boardRiver: 'Kh', aggressorPosition: 'OOP', postflopAction: 'OOP_BET_2', evaluationAt: 'Flop' };
const candidate = { kind: 'solver' as const, id: 'solver:postflop:postflop-5', row };
const base: HistoryItem = { scenarioId: 'legacy', category: ['PokerBench'], score: 10, judgment: 'correct', timestamp: 1,
  datasetRowId: row.id, datasetSplit: 'postflop_10k_test', truthSourceId: POKERBENCH_SOURCE.id };

test('all prior stable solver practice identities exclude a migrated row from the unseen exam pool', () => {
  const hasExposed = exam.isExamCandidateExposed;
  assert.equal(solverCorpusRole(row), 'holdout');
  assert.equal(typeof hasExposed, 'function');
  for (const trainingType of ['solver-corpus', 'contrastive', 'counterfactual'] as const) {
    assert.equal(hasExposed!(candidate, [{ ...base, trainingType, gameFormat: undefined }]), true);
    assert.equal(exam.evaluationIdentity({ ...base, trainingType }), exam.evaluationIdentity({ ...base, trainingType: 'solver-benchmark' }));
  }
  assert.equal(hasExposed!(candidate, [{ ...base, truthSourceId: 'other-solver' }]), false);
  assert.equal(hasExposed!(candidate, [{ ...base, datasetSplit: 'preflop_1k_test' }]), false);
  assert.equal(hasExposed!(candidate, [{ ...base, datasetRowId: 'another-row' }]), false);
});

test('exclusive completion guard rejects practice exposures written after the initial exam snapshot', () => {
  const completion = { ...base, attemptId: 'exam', trainingType: 'solver-benchmark' as const, examMode: true, isUnseen: true };
  for (const trainingType of ['solver-corpus', 'contrastive', 'counterfactual'] as const) {
    assert.deepEqual(exam.filterFreshEvaluationItems([{ ...base, attemptId: 'concurrent-practice', trainingType }], [completion]), []);
  }
});

test('legacy solver exam scenario identifiers retain exposure when dataset split was not saved', () => {
  const prior = { ...base, datasetSplit: undefined, truthSourceId: undefined, trainingType: 'solver-benchmark' as const, scenarioId: `exam-solver:postflop:${row.id}` };
  assert.deepEqual(exam.filterFreshEvaluationItems([prior], [{ ...base, trainingType: 'solver-benchmark' }]), []);
});
