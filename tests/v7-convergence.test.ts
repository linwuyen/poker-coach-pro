import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedLearningValue } from '../src/learning-engine/trainingValue';
import { improvementProbabilityFromHistory } from '../src/learning-engine/errorModel';
import { solverContextFamilyId, solverCorpusRole } from '../src/learning-engine/solverCurriculum';
import { scenarioContextFamilyId, scenarioDecisionFamilyId } from '../src/learning-engine/contextIdentity';
import { HistoryItem, Scenario } from '../src/types';
import { PokerBenchPreflopRow } from '../src/solver-data/pokerbench';

function cashScenario(): Scenario {
  return {
    id: 'cash-bb-defense',
    title: 'BB 防守',
    category: ['BB 防守'],
    difficulty: '中階',
    type: 'Cash Game',
    blinds: '1/2',
    ante: false,
    userStack: '100BB',
    userBB: 100,
    position: 'BB',
    holeCards: [{ rank: 'A', suit: 'spades' }, { rank: 'K', suit: 'hearts' }],
    preAction: 'BTN open',
    effectiveStack: '100BB',
    steps: [{ id: 'p', street: 'Preflop', communityCards: [], description: 'BTN open', potSize: 3.5, options: ['Fold', 'Call'], feedbacks: {} }],
  };
}

function trainingLeak(scenario: Scenario, format: 'Cash' | 'MTT' = 'Cash'): HistoryItem {
  return {
    schemaVersion: 6,
    trainingType: 'scenario',
    scenarioId: scenario.id,
    decisionFamilyId: scenarioDecisionFamilyId(scenario),
    category: ['Training', format],
    gameFormat: format,
    contextFamilyId: scenarioContextFamilyId(scenario),
    score: 0,
    judgment: '錯誤',
    timestamp: 1,
    correct: false,
    truthTier: 'verified-solver',
    evLossBB: 0.4,
    street: 'Preflop',
    position: 'BB',
  };
}

function preflop(id: string, holding: string): PokerBenchPreflopRow {
  return {
    id,
    split: 'preflop',
    prevLine: 'BTN/2.5bb',
    heroPosition: 'BB',
    holding,
    correctDecision: 'Call',
    numPlayers: 6,
    numBets: 1,
    availableMoves: ['Fold', 'Call', 'Raise 9'],
    potSize: 4,
  };
}

test('curriculum frequency prior never masquerades as reportable bankroll EV gain', () => {
  const value = expectedLearningValue(cashScenario(), []);
  assert.equal(value.evGainEvidence, 'estimated');
  assert.equal(value.reportableExpectedEvGainPer100Hands, undefined);
  assert.equal(value.spotFrequencySource, 'heuristic-prior');
  assert.ok(value.expectedEvGainPer100Hands > 0);
});

test('verified trainer regret increases internal learning priority without creating real-play claims', () => {
  const scenario = cashScenario();
  const baseline = expectedLearningValue(scenario, []);
  const value = expectedLearningValue(scenario, [trainingLeak(scenario)]);
  assert.equal(value.evGainEvidence, 'verified');
  assert.equal(value.reportableExpectedEvGainPer100Hands, undefined);
  assert.ok(value.observedEvRegretBB > 0);
  assert.ok(value.expectedLossPer100Hands > baseline.expectedLossPer100Hands);
});

test('cash BB trainer regret does not become tournament dollar utility', () => {
  const cash = cashScenario();
  const scenario = { ...cash, id: 'mtt-bb-defense', type: 'Tournament' as const };
  const value = expectedLearningValue(scenario, [trainingLeak(cash, 'Cash')]);
  assert.equal(value.utilityMode, 'tournament-priority');
  assert.equal(value.reportableExpectedUtilityGainPer100Hands, undefined);
});

test('solver train and holdout split is stable at context-family level', () => {
  const ak = preflop('row-ak', 'AsKh');
  const aq = preflop('row-aq', 'AsQh');
  assert.equal(solverContextFamilyId(ak), solverContextFamilyId(aq));
  assert.equal(solverCorpusRole(ak), solverCorpusRole(aq));
});

test('repair probability learns from repeated recovery instead of only fixed heuristics', () => {
  const improving: HistoryItem[] = [false, true, false, true].map((correct, index) => ({
    scenarioId: 'repair', category: ['x'], score: correct ? 10 : 0, judgment: correct ? '正確' : '錯誤', timestamp: index * 1000, correct,
  }));
  const stuck: HistoryItem[] = [false, false, false, false].map((correct, index) => ({
    scenarioId: 'stuck', category: ['x'], score: 0, judgment: '錯誤', timestamp: index * 1000, correct,
  }));
  assert.ok(improvementProbabilityFromHistory(improving) > improvementProbabilityFromHistory(stuck));
});
