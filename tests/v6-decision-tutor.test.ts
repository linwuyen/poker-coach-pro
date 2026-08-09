import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBoardTexture } from '../src/learning-engine/boardTexture';
import { buildCalibrationReport } from '../src/learning-engine/calibration';
import { classifyDecisionError } from '../src/learning-engine/errorModel';
import { solverCorpusRole, solverCurriculum, buildContrastivePairs } from '../src/learning-engine/solverCurriculum';
import { strategyDistance, strategyEvRegret } from '../src/learning-engine/strategyDistance';
import { expectedLearningValue } from '../src/learning-engine/trainingValue';
import { fingerprintPokerBenchRow } from '../src/solver-data/contextFingerprint';
import { PokerBenchPreflopRow, PokerBenchPostflopRow } from '../src/solver-data/pokerbench';
import { HistoryItem, Scenario } from '../src/types';

const preflop = (id: string, correctDecision = 'Call'): PokerBenchPreflopRow => ({
  id,
  split: 'preflop',
  prevLine: 'BTN/2.5bb',
  heroPosition: 'BB',
  holding: 'AsKh',
  correctDecision,
  numPlayers: 6,
  numBets: 1,
  availableMoves: ['Fold', 'Call', 'Raise 9'],
  potSize: 4,
});

const postflop = (id: string, boardFlop: string, correctDecision = 'Check'): PokerBenchPostflopRow => ({
  id,
  split: 'postflop',
  preflopAction: 'BTN/2.5bb/BB/call',
  boardFlop,
  boardTurn: '',
  boardRiver: '',
  aggressorPosition: 'IP',
  postflopAction: 'OOP_CHECK',
  evaluationAt: 'Flop',
  availableMoves: ['Check', 'Bet 2', 'Bet 5'],
  potSize: 6,
  heroPosition: 'IP',
  holding: 'AsKh',
  correctDecision,
});

test('board texture engine distinguishes static rainbow from connected two-tone', () => {
  const dry = analyzeBoardTexture('Ks7h2d');
  const wet = analyzeBoardTexture('8c7c4d');
  assert.equal(dry.pairing, 'unpaired');
  assert.equal(dry.tone, 'rainbow');
  assert.equal(dry.dynamics, 'static');
  assert.equal(wet.tone, 'two-tone');
  assert.ok(wet.straightConnectivity > dry.straightConnectivity);
});

test('context fingerprint is deterministic and changes on material board texture', () => {
  const left = fingerprintPokerBenchRow(postflop('a', 'Ks7h2d'));
  const same = fingerprintPokerBenchRow(postflop('b', 'Ks7h2d'));
  const different = fingerprintPokerBenchRow(postflop('c', '8c7c4d'));
  assert.equal(left.id, same.id);
  assert.notEqual(left.id, different.id);
});

test('strategy distance scores full distributions rather than binary labels', () => {
  const target = { raise: 0.55, call: 0.45, fold: 0 };
  assert.equal(strategyDistance(target, target).similarity, 100);
  const pureRaise = strategyDistance(target, { raise: 1, call: 0, fold: 0 });
  assert.equal(pureRaise.totalVariation, 0.45);
  assert.equal(pureRaise.similarity, 55);
});

test('strategy EV regret is only computed when action EV is available', () => {
  const target = { raise: 0.5, call: 0.5 };
  const chosen = { raise: 1, call: 0 };
  assert.equal(strategyEvRegret(target, chosen, { raise: 1, call: 1.2 }), 0.1);
  assert.equal(strategyEvRegret(target, chosen, { raise: 1 }), undefined);
});

test('solver corpus partition is stable and keeps holdout outside training', () => {
  const rows = Array.from({ length: 1000 }, (_, index) => preflop(`role-${index}`));
  const counts = { training: 0, sibling: 0, holdout: 0 };
  rows.forEach(row => { counts[solverCorpusRole(row)] += 1; });
  assert.ok(counts.training > 740 && counts.training < 860);
  assert.ok(counts.sibling > 50 && counts.sibling < 150);
  assert.ok(counts.holdout > 50 && counts.holdout < 150);
  assert.equal(solverCorpusRole(rows[12]), solverCorpusRole(rows[12]));
});

test('solver curriculum promotes complex sizing and reserves transfer as level five', () => {
  const simple = preflop('simple');
  simple.availableMoves = ['Fold', 'Call'];
  simple.numBets = 0;
  assert.ok(solverCurriculum(simple).level <= 2);
  const complex = postflop('complex', '8c7c4d', 'Bet 5');
  assert.ok(solverCurriculum(complex).level >= 3);
});

test('contrastive pairs require different solver labels from sibling partition', () => {
  const sibling: PokerBenchPreflopRow[] = [];
  for (let index = 0; sibling.length < 8 && index < 1000; index += 1) {
    const row = preflop(`pair-${index}`, sibling.length % 2 ? 'Raise 9' : 'Call');
    if (solverCorpusRole(row) === 'sibling') sibling.push(row);
  }
  const pairs = buildContrastivePairs(sibling, 2);
  assert.ok(pairs.length >= 1);
  assert.notEqual(pairs[0].left.correctDecision, pairs[0].right.correctDecision);
});

test('calibration report detects high-confidence overconfidence', () => {
  const history: HistoryItem[] = Array.from({ length: 10 }, (_, index) => ({ scenarioId: `c${index}`, category: ['x'], score: index < 5 ? 10 : 0, judgment: index < 5 ? '正確' : '錯誤', timestamp: index, confidence: 4, correct: index < 5 }));
  const report = buildCalibrationReport(history);
  assert.equal(report.label, 'overconfident');
  assert.ok(report.overconfidence > 0.2);
});

test('error model separates knowledge gap mental model and sizing boundary', () => {
  assert.equal(classifyDecisionError({ correct: false, confidence: 1 }), 'knowledge-gap');
  assert.equal(classifyDecisionError({ correct: false, confidence: 4, selectedDecision: { type: 'call' }, bestDecision: { type: 'fold' } }), 'mental-model');
  assert.equal(classifyDecisionError({ correct: false, confidence: 3, selectedDecision: { type: 'bet', sizeBB: 5 }, bestDecision: { type: 'bet', sizeBB: 10 } }), 'sizing-boundary');
  assert.equal(classifyDecisionError({ correct: true, confidence: 1 }), 'lucky-guess');
});

test('expected learning value exposes expected EV gain and improvement probability', () => {
  const scenario: Scenario = {
    id: 'bb-defense-test', title: 'BB 防守', category: ['BB 防守'], difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false,
    userStack: '100BB', userBB: 100, position: 'BB', holeCards: [{ rank: 'A', suit: 'spades' }, { rank: 'K', suit: 'hearts' }], preAction: 'BTN open', effectiveStack: '100BB',
    steps: [{ id: 'p', street: 'Preflop', communityCards: [], description: 'BTN open', potSize: 3.5, options: ['Fold', 'Call'], feedbacks: {} }],
  };
  const value = expectedLearningValue(scenario, []);
  assert.ok(value.probabilityOfImprovement >= 0.25 && value.probabilityOfImprovement <= 0.92);
  assert.ok(value.expectedEvGainPer100Hands > 0);
});
