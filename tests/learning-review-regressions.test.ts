import assert from 'node:assert/strict';
import test from 'node:test';
import { currentDueReviews, getLearningMetrics } from '../src/learning-engine';
import { calculateSkillMastery } from '../src/learning-engine/skillGraph';
import { buildInfiniteCandidatePool, selectNextInfiniteCandidate } from '../src/learning-engine/infiniteHandGenerator';
import { candidateLearningSignal, createCandidateLearningSignalResolver, isEvaluationAttempt } from '../src/learning-engine/closedLoop';
import { transferBenchmarkReport } from '../src/learning-engine/transferBenchmark';
import { solverCorpusRole } from '../src/learning-engine/solverCurriculum';
import { selectTargetedReviewCandidates } from '../src/learning-engine/targetedReview';
import { coreScenarios } from '../src/teaching/scenarioCatalog';
import type { PokerBenchPostflopRow } from '../src/solver-data/pokerbench';
import type { HistoryItem } from '../src/types';

const now = 1_800_000_000_000;
const attempt = (changes: Partial<HistoryItem> = {}): HistoryItem => ({
  scenarioId: 'practice', decisionFamilyId: 'practice', stepId: 's', category: ['Pot Odds'],
  trainingType: 'scenario', gameFormat: 'Cash', skillIds: ['math.pot-odds'],
  score: 10, correct: true, judgment: 'correct', timestamp: now - 86400000,
  truthTier: 'exact-math', ...changes,
});
const holdout: PokerBenchPostflopRow = {
  id: 'postflop-5', split: 'postflop', preflopAction: 'SB/3.0bb/BB/call',
  boardFlop: '5c5dAh', boardTurn: '3h', boardRiver: 'Kh', aggressorPosition: 'OOP',
  postflopAction: 'OOP_BET_2', evaluationAt: 'Flop', availableMoves: ['Fold', 'Call', 'Raise 9'],
  potSize: 8, heroPosition: 'IP', holding: 'Ad4h', correctDecision: 'Call',
};
const oldExposure = attempt({
  scenarioId: 'daily-solver:postflop_10k_test:postflop-5', trainingType: 'solver-corpus',
  decisionFamilyId: 'solver:postflop:pb-2f0f5ab1:A4o',
  masteryKey: 'solver:postflop:pb-2f0f5ab1:A4o::solver-decision', stepId: 'solver-decision',
  datasetRowId: holdout.id, datasetSplit: 'postflop_10k_test', truthSourceId: 'pokerbench-aaai2025',
  timestamp: now - 3000, nextReviewAt: now - 1000, score: 0, correct: false,
});

test('an exposed migrated holdout is reachable only while its review is due', () => {
  assert.equal(solverCorpusRole(holdout), 'holdout');
  assert.equal(buildInfiniteCandidatePool([], [], [holdout]).length, 0);
  assert.equal(currentDueReviews([oldExposure], now).length, 1);
  const pool = buildInfiniteCandidatePool([], [], [holdout], [oldExposure], now);
  assert.equal(pool.length, 1);
  assert.equal(pool[0].reviewOnly, true);
  assert.equal(selectNextInfiniteCandidate(pool, [oldExposure], [], [], () => 0, now)?.id, pool[0].id);
  const reviewed = { ...oldExposure, decisionFamilyId: pool[0].familyId, timestamp: now, nextReviewAt: now + 86400000 };
  assert.equal(buildInfiniteCandidatePool([], [], [holdout], [oldExposure, reviewed], now).length, 0);
  assert.equal(buildInfiniteCandidatePool([], [], [holdout], [{ ...oldExposure, truthSourceId: 'another-source' }], now).length, 0);
  assert.equal(buildInfiniteCandidatePool([], [], [holdout], [{ ...oldExposure, datasetSplit: 'another-split' }], now).length, 0);
});

test('holdout review remains practice and cannot renew transfer assessment credit', () => {
  const review = attempt({ ...oldExposure, isReview: true, isUnseen: false, solverCorpusRole: 'holdout', decisionContextVersion: 2, isTransferTest: true, transferLevel: 'structural' });
  assert.equal(isEvaluationAttempt(review), false);
  assert.equal(transferBenchmarkReport([oldExposure, review]).structural.attempts, 0);
});

test('a migrated sibling partition row is available only for its exposed due review', () => {
  const sibling: PokerBenchPostflopRow = {
    id: 'postflop-10', split: 'postflop', preflopAction: 'CO/2.3bb/BB/call',
    boardFlop: 'Qc8cAc', boardTurn: 'Kh', boardRiver: '3s', aggressorPosition: 'OOP',
    postflopAction: 'OOP_CHECK/IP_CHECK/dealcards/Kh/OOP_CHECK/IP_BET_6/OOP_CALL/dealcards/3s/OOP_BET_9',
    evaluationAt: 'River', availableMoves: ['Fold', 'Call', 'Raise 32'],
    potSize: 26, heroPosition: 'IP', holding: '4s4h', correctDecision: 'Fold',
  };
  const prior = { ...oldExposure, datasetRowId: sibling.id, scenarioId: 'daily-solver:postflop_10k_test:postflop-10' };
  assert.equal(solverCorpusRole(sibling), 'sibling');
  assert.equal(buildInfiniteCandidatePool([], [], [sibling], [], now).length, 0);
  assert.equal(currentDueReviews([prior], now).length, 1);
  const pool = buildInfiniteCandidatePool([], [], [sibling], [prior], now);
  assert.equal(pool.length, 1);
  assert.equal(pool[0].reviewOnly, true);
  const reviewed = { ...prior, timestamp: now, nextReviewAt: now + 86400000, decisionFamilyId: pool[0].familyId };
  assert.equal(buildInfiniteCandidatePool([], [], [sibling], [prior, reviewed], now).length, 0);
});

test('a consumed reserved review cannot be selected from a stale pool', () => {
  const pool = buildInfiniteCandidatePool([], [], [holdout], [oldExposure], now);
  const reviewed = { ...oldExposure, timestamp: now, nextReviewAt: now + 86400000 };
  assert.equal(selectNextInfiniteCandidate(pool, [oldExposure, reviewed], [], [], () => 0, now), undefined);
  assert.equal(selectNextInfiniteCandidate(pool, [], [], [], () => 0, now), undefined);
});

test('reserved due reviews never enter the immediate repair queue', () => {
  const pool = buildInfiniteCandidatePool([], [], [holdout], [oldExposure], now);
  const other = { ...pool[0], id: 'ordinary-failed-question', reviewOnly: false };
  assert.deepEqual(selectTargetedReviewCandidates(pool, other), []);
});

test('rehearsal success cannot mask failed delayed or independent transfer validation', () => {
  const rehearsal = Array.from({ length: 20 }, (_, index) => attempt({ timestamp: now - 86400000 + index, isReview: index > 0, isUnseen: index === 0 }));
  const delayed = attempt({ timestamp: now - 1000, isReview: true, isUnseen: false, isDelayedReview: true, score: 0, correct: false });
  const transfer = attempt({ scenarioId: 'unseen-exam', decisionFamilyId: 'unseen-exam', timestamp: now - 500,
    trainingType: 'benchmark', isTransferTest: true, transferLevel: 'structural', isUnseen: true,
    examMode: true, examSessionId: 'exam', examStartedAt: now - 900, examCompletedAt: now - 100, score: 0, correct: false });
  for (const [retentionCorrect, transferCorrect] of [[false, false], [true, false], [false, true]]) {
    const history = [...rehearsal, { ...delayed, correct: retentionCorrect, score: retentionCorrect ? 10 : 0 }, { ...transfer, correct: transferCorrect, score: transferCorrect ? 10 : 0 }];
    assert.notEqual(calculateSkillMastery(history, now)[0].status, 'mastered');
    assert.equal(getLearningMetrics(history).masteredNodes, 0);
  }
});

test('only two validation answers are insufficient evidence for mastery', () => {
  const history = [attempt({ isDelayedReview: true }), attempt({ scenarioId: 'other', decisionFamilyId: 'other', timestamp: now,
    isTransferTest: true, trainingType: 'transfer' })];
  assert.notEqual(calculateSkillMastery(history, now)[0].status, 'mastered');
});

test('large history selection stays responsive with 8000 candidates and 10000 attempts', () => {
  const base = buildInfiniteCandidatePool(coreScenarios, [], []).find(candidate => candidate.kind === 'scenario')!;
  const pool = Array.from({ length: 8000 }, (_, index) => ({ ...base, id: `candidate-${index}`, familyId: `family-${index}` }));
  const history = Array.from({ length: 10000 }, (_, index) => attempt({ scenarioId: `question-${index}`, decisionFamilyId: `family-${index % pool.length}`, timestamp: now - index, correct: index % 2 === 0 }));
  const started = performance.now();
  const selected = selectNextInfiniteCandidate(pool, history, [], [], () => 0.7, now);
  const elapsed = performance.now() - started;
  assert.ok(selected);
  assert.ok(elapsed < 1500, `selection took ${Math.round(elapsed)} ms; budget is 1500 ms`);
});

test('indexed signals preserve overlapping identities, chronological windows, and tied timestamps', () => {
  const candidate = buildInfiniteCandidatePool(coreScenarios, [], []).find(item => item.kind === 'scenario')!;
  assert.equal(candidate.kind, 'scenario');
  if (candidate.kind !== 'scenario') return;
  const matching = Array.from({ length: 60 }, (_, index) => attempt({
    scenarioId: index % 3 === 0 ? candidate.scenario.id : 'other',
    decisionFamilyId: index % 3 === 1 ? candidate.familyId : 'other',
    contextFamilyId: index % 3 === 2 || index % 3 === 0 ? candidate.familyId : 'other',
    timestamp: now - 1000 + Math.floor(index / 2), correct: index >= 40,
  }));
  const unrelated = Array.from({ length: 20 }, () => attempt({ scenarioId: 'unrelated', decisionFamilyId: 'unrelated', timestamp: now }));
  const history = [...matching, ...unrelated];
  const resolve = createCandidateLearningSignalResolver(history, now);
  assert.equal(resolve(candidate).predictedSuccessProbability, 0.5, 'last 40 contain 20 successes and 20 failures, counted once');
  assert.deepEqual(resolve(candidate), candidateLearningSignal(candidate, history, now));
  assert.deepEqual(resolve({ ...candidate }), candidateLearningSignal({ ...candidate }, history, now));

  const solver = buildInfiniteCandidatePool([], [], [holdout], [oldExposure], now)[0];
  const solverHistory = [...history, oldExposure, { ...oldExposure, timestamp: now, nextReviewAt: now + 86400000, correct: true }];
  const solverSignal = createCandidateLearningSignalResolver(solverHistory, now)(solver);
  assert.equal(solverSignal.predictedSuccessProbability, 0.5);
  assert.equal(solverSignal.duePressure, 0);
  assert.deepEqual(solverSignal, candidateLearningSignal(solver, solverHistory, now));
});
