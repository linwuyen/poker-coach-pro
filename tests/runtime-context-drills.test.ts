import assert from 'node:assert/strict';
import test from 'node:test';
import * as analysisContext from '../src/features/analysis/analysisContext';
import * as rangeTrainer from '../src/features/range/RangeReadingTrainer';
import * as counterfactualTrainer from '../src/features/training/CounterfactualTrainer';
import * as historyStorage from '../src/utils/history';
import { RANGE_QUESTIONS } from '../src/features/range/data';
import { historyForTrainingTrack } from '../src/domain/trainingTrack';
import { coreScenarios } from '../src/teaching/scenarioCatalog';
import type { HistoryItem } from '../src/types';
import type { PokerBenchRow } from '../src/solver-data/pokerbench';

const row: PokerBenchRow = {
  id: 'postflop-123', split: 'postflop', holding: 'AsQd', heroPosition: 'BTN',
  potSize: 17, availableMoves: ['Fold', 'Call'], correctDecision: 'Call',
  preflopAction: 'BTN/2.5bb/BB/call', aggressorPosition: 'BB', postflopAction: 'OOP_BET_6',
  boardFlop: 'Qh8d2c', boardTurn: 'Ks', boardRiver: '3h', evaluationAt: 'Turn',
};
const submission: HistoryItem = {
  scenarioId: 'daily-solver:postflop_10k_test:postflop-123', stepId: 'solver-decision',
  trainingType: 'solver-corpus', category: [], score: 0, judgment: '不同', timestamp: 1234,
  selectedAction: 'Fold', bestAction: 'Call', datasetRowId: row.id,
  truthTier: 'verified-solver', truthSourceRef: 'https://huggingface.co/datasets/RZ412/PokerBench',
};

test('solver analysis uses one submitted row, including visible board and provenance', () => {
  assert.equal(typeof analysisContext.buildPokerBenchAnalysisContext, 'function');
  const context = analysisContext.buildPokerBenchAnalysisContext(row, submission);
  assert.equal(context.source, 'pokerbench');
  assert.equal(context.scenarioId, 'daily-solver:postflop_10k_test:postflop-123');
  assert.equal(context.datasetRowId, 'postflop-123');
  assert.deepEqual(context.heroCards, ['As', 'Qd']);
  assert.deepEqual(context.boardCards, ['Qh', '8d', '2c', 'Ks']);
  assert.equal(context.street, 'Turn');
  assert.equal(context.position, 'BTN');
  assert.equal(context.potBB, 17);
  assert.equal(context.selectedAction, 'Fold');
  assert.equal(context.bestAction, 'Call');
  assert.equal(context.gameFormat, 'Cash');
  assert.equal(context.truthTier, 'verified-solver');
  assert.equal(context.truthSource, 'https://huggingface.co/datasets/RZ412/PokerBench');
  assert.equal(context.effectiveStackBB, undefined, 'starting stack is not current effective stack');
  assert.equal(context.villainRange, undefined);
});

test('later-street analysis never relabels initial or Hero-only stacks as current effective depth', () => {
  const scenario = coreScenarios.find(item => item.id === '87')!;
  const river = scenario.steps.find(step => step.id === 'river')!;
  const feedback = river.feedbacks.Check!;
  const item = { ...submission, scenarioId: scenario.id, stepId: river.id };
  assert.equal(river.handState?.heroStackBB, 73);
  const unknownOpponent = analysisContext.buildScenarioAnalysisContext(scenario, river, item, feedback);
  assert.equal(unknownOpponent.effectiveStackBB, undefined);
  const currentStacks = { ...river, handState: { ...river.handState, heroStackBB: 73, villainStackBB: 61 } };
  assert.equal(analysisContext.buildScenarioAnalysisContext(scenario, currentStacks, item, feedback).effectiveStackBB, 61);
  assert.equal(analysisContext.buildScenarioAnalysisContext(scenario, { ...river, handState: undefined }, item, feedback).effectiveStackBB, undefined);
});

test('range questions declare their intrinsic format independently of the selected track', () => {
  assert.deepEqual(RANGE_QUESTIONS.map(question => [question.id, question.gameFormat]), [
    ['co-shove-aqs', 'MTT'], ['fourbet-shove-qq', 'Cash'], ['flop-cbet-second-pair', 'Cash'],
    ['turn-checkraise-aq', 'Cash'], ['river-overbet-kj', 'Cash'], ['multiway-donk-aa', 'Cash'],
  ]);
});

test('new range and counterfactual submissions survive persistence and track filtering', async () => {
  assert.equal(typeof rangeTrainer.buildRangeHistoryItems, 'function');
  assert.equal(typeof counterfactualTrainer.buildCounterfactualHistoryItems, 'function');
  assert.equal(typeof historyStorage.persistHistoryItems, 'function');
  const stored = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  } });
  try {
    const tournament = RANGE_QUESTIONS[0];
    const cash = RANGE_QUESTIONS[1];
    const range = rangeTrainer.buildRangeHistoryItems(tournament, {
      selections: [{ hand: 'AA', frequency: 1 }], selectedEquity: 'under-30',
      potOddsEstimate: 40, selectedAction: 'fold', confidence: 4,
    }, [], 1000);
    const counter = counterfactualTrainer.buildCounterfactualHistoryItems(cash, 'bet-size',
      { 'size-0.5': 'fold', 'size-1': 'fold', 'size-1.75': 'fold' }, 4, [], 1000, 2000);
    await historyStorage.persistHistoryItems([...range, ...counter]);
    const reloaded = historyStorage.loadHistory();
    assert.equal(reloaded.length, 7);
    assert.deepEqual(reloaded.map(item => item.schemaVersion), [6, 6, 6, 6, 6, 6, 6]);
    assert.equal(historyForTrainingTrack(reloaded, 'tournament').length, 4);
    assert.equal(historyForTrainingTrack(reloaded, 'cash').length, 3);
    assert.equal(reloaded[0].truthTier, 'heuristic-estimate');
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('delayed drill batches preserve another writer\'s finalized attempt', async () => {
  const stored = new Map<string, string>();
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let commit: (() => unknown) | undefined;
  let finish: (value: unknown) => void;
  const pending = new Promise(resolve => { finish = resolve; });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: {
    request: (_name: string, _options: unknown, callback: () => unknown) => {
      commit = callback;
      return pending;
    },
  } } });
  try {
    const previous = { ...submission, attemptId: 'previous', trainingDwellMs: 10 };
    stored.set(historyStorage.HISTORY_KEY, JSON.stringify([previous]));
    const batch = historyStorage.persistHistoryItems([{ ...submission, attemptId: 'new-drill', gameFormat: 'Cash' }]);
    assert.equal(historyStorage.loadHistory().length, 1, 'held lock keeps the batch pending');
    stored.set(historyStorage.HISTORY_KEY, JSON.stringify([{ ...previous, trainingDwellMs: 9000 }]));
    assert.ok(commit);
    finish!(commit());
    await batch;
    const reloaded = historyStorage.loadHistory();
    assert.equal(reloaded.length, 2);
    assert.equal(reloaded.find(item => item.attemptId === 'previous')?.trainingDwellMs, 9000);
    assert.equal(reloaded.find(item => item.attemptId === 'new-drill')?.gameFormat, 'Cash');
  } finally {
    if (localStorageDescriptor) Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});
