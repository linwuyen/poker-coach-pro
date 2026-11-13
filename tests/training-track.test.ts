import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PLAYER_PROFILE } from '../src/domain/playerProfile';
import { coreScenarios } from '../src/teaching/scenarioCatalog';
import type { HistoryItem, PlayerProfile, Scenario } from '../src/types';

import * as track from '../src/domain/trainingTrack';
const profile: PlayerProfile = { ...DEFAULT_PLAYER_PROFILE, formats: ['cash', 'tournament'], tableSizes: ['6max'], stackBands: ['40-100'], focusAreas: ['mixed'] };
const cash: Scenario = { ...coreScenarios[0], type: 'Cash Game', tableSize: '6max', userBB: 100 };
const mtt: Scenario = { ...cash, type: 'Tournament' };

test('selected track and strict table/stack preferences never substitute the opposite format', () => {
  assert.equal(typeof track.scenarioMatchesTrainingTrack, 'function', 'track filtering must exist');
  assert.equal(track.scenarioMatchesTrainingTrack(cash, 'cash', profile), true);
  assert.equal(track.scenarioMatchesTrainingTrack(mtt, 'cash', profile), false);
  assert.equal(track.scenarioMatchesTrainingTrack(cash, 'tournament', profile), false);
  assert.equal(track.scenarioMatchesTrainingTrack({ ...cash, tableSize: undefined }, 'cash', profile), false);
  assert.equal(track.scenarioMatchesTrainingTrack({ ...cash, userBB: 20, effectiveStack: '20BB' }, 'cash', profile), false);
  assert.equal(track.scenarioMatchesTrainingTrack(cash, 'cash', { ...profile, formats: ['tournament'] }), false);
});

test('focus constrains real scenario streets and short-stack depth', () => {
  assert.equal(typeof track.scenarioMatchesTrainingTrack, 'function');
  const river = { ...cash, steps: [{ ...cash.steps[0], street: 'River' as const }] };
  assert.equal(track.scenarioMatchesTrainingTrack(river, 'cash', { ...profile, focusAreas: ['preflop'] }), false);
  assert.equal(track.scenarioMatchesTrainingTrack(river, 'cash', { ...profile, focusAreas: ['postflop'] }), true);
  assert.equal(track.scenarioMatchesTrainingTrack(river, 'cash', { ...profile, focusAreas: ['short-stack'] }), false);
  const multistreet = { ...cash, steps: [{ ...cash.steps[0], street: 'Preflop' as const }, ...river.steps] };
  assert.equal(track.scenarioMatchesTrainingTrack(multistreet, 'cash', { ...profile, focusAreas: ['preflop'] }), false, 'a preflop preference must not lead into river decisions');
});

test('strict assessment excludes authored answers and requires evidence for every graded action', () => {
  assert.equal(typeof track.isAssessmentScenario, 'function');
  assert.equal(track.isAssessmentScenario(cash), false);
  const step = { ...cash.steps[0], options: ['Fold', 'Call'] as Scenario['steps'][number]['options'], feedbacks: {
    Fold: { score: 10, bestAction: 'Fold', evidence: { sourceConfidence: 'exact-math' } },
    Call: { score: 0, bestAction: 'Fold', evidence: { sourceConfidence: 'expert-baseline' } },
  } } as Scenario['steps'][number];
  assert.equal(track.isAssessmentScenario({ ...cash, steps: [step] }), false);
  assert.equal(track.isAssessmentScenario({ ...cash, steps: [{ ...step, feedbacks: { ...step.feedbacks, Call: { ...step.feedbacks.Call!, evidence: { sourceConfidence: 'exact-math' } } } }] }), true);
});

test('PokerBench stays cash 6max starting100BB and respects focus', () => {
  assert.equal(typeof track.pokerBenchMatchesTrainingTrack, 'function');
  const row = { id: 'fixture', split: 'preflop' as const, numPlayers: 6, numBets: 1, prevLine: '', holding: 'AsKd', heroPosition: 'BTN', potSize: 3, availableMoves: ['fold', 'call'], correctDecision: 'call' };
  const unrestricted = { ...profile, stackBands: DEFAULT_PLAYER_PROFILE.stackBands };
  assert.equal(track.pokerBenchMatchesTrainingTrack(row, 'cash', unrestricted), true);
  assert.equal(track.pokerBenchMatchesTrainingTrack(row, 'cash', profile), false, 'starting100BB cannot satisfy a remaining effective-stack constraint');
  assert.equal(track.pokerBenchMatchesTrainingTrack(row, 'tournament', profile), false);
  assert.equal(track.pokerBenchMatchesTrainingTrack(row, 'cash', { ...profile, tableSizes: ['9max'] }), false);
  assert.equal(track.pokerBenchMatchesTrainingTrack(row, 'cash', { ...profile, stackBands: ['10-20'] }), false);
  assert.equal(track.pokerBenchMatchesTrainingTrack(row, 'cash', { ...unrestricted, focusAreas: ['short-stack'] }), false);
  assert.equal(track.pokerBenchMatchesTrainingTrack(row, 'cash', { ...unrestricted, focusAreas: ['postflop'] }), false);
});

test('optional scenario categories do not crash preference filtering', () => {
  assert.equal(track.scenarioMatchesTrainingTrack({ ...cash, category: undefined }, 'cash', profile), true);
});

test('track progress separates formats and excludes unknown legacy context', () => {
  assert.equal(typeof track.historyForTrainingTrack, 'function');
  const base = { scenarioId: 'x', category: [], score: 10, judgment: 'correct', timestamp: 1 };
  const history: HistoryItem[] = [{ ...base, gameFormat: 'Cash' }, { ...base, gameFormat: 'MTT' }, { ...base }];
  assert.equal(track.historyForTrainingTrack(history, 'cash').length, 1);
  assert.equal(track.historyForTrainingTrack(history, 'tournament').length, 1);
});

test('recognized legacy PokerBench provenance retains cash history without inferring unrelated unknown records', () => {
  const base: HistoryItem = { scenarioId: 'legacy', category: ['PokerBench', 'Daily Generalization', 'Flop'], score: 10, judgment: 'correct', timestamp: 1 };
  const legacy = { ...base, trainingType: 'solver-corpus' as const, datasetSplit: 'postflop_10k_test', datasetRowId: 'postflop-5' };
  const unknown = { ...base, datasetRowId: 'postflop-5' };
  const external = { ...legacy, truthSourceId: 'other-solver' };
  assert.deepEqual(track.historyForTrainingTrack([legacy, unknown, external], 'cash'), [legacy]);
  assert.deepEqual(track.historyForTrainingTrack([legacy], 'tournament'), []);
});

test('selected track persists and cannot override disabled profile formats', () => {
  assert.equal(typeof track.loadTrainingTrack, 'function');
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  track.saveTrainingTrack('tournament', storage);
  assert.equal(track.loadTrainingTrack(profile, storage), 'tournament');
  assert.equal(track.loadTrainingTrack({ ...profile, formats: ['cash'] }, storage), 'cash');
});

test('tournament evaluation regret separates ICM prize units from chip EV and unknown evidence', () => {
  assert.equal(typeof track.tournamentEvaluationGroups, 'function');
  const base: HistoryItem = { scenarioId: 'mtt', category: [], score: 10, judgment: 'correct', timestamp: 1, gameFormat: 'MTT', examMode: true, examCompletedAt: 2, truthTier: 'exact-math' };
  assert.deepEqual(track.tournamentEvaluationGroups([
    { ...base, utilityModel: 'icm', utilityUnit: 'dollar-ev', utilityLoss: 4 },
    { ...base, utilityModel: 'icm', utilityUnit: 'dollar-ev', utilityLoss: 0 },
    { ...base, utilityModel: 'tournament-chip-ev', utilityUnit: 'bb', utilityLoss: 100 },
    { ...base, utilityModel: 'pko', utilityUnit: 'dollar-ev' },
  ]), [
    { model: 'icm', unit: 'dollar-ev', samples: 2, averageLoss: 2 },
    { model: 'tournament-chip-ev', unit: 'bb', samples: 1, averageLoss: 100 },
  ]);
});
