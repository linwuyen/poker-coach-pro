import assert from 'node:assert/strict';
import test from 'node:test';
import { scenarios } from '../src/data';
import { DEFAULT_PLAYER_PROFILE, filterRelevantScenarios } from '../src/domain/playerProfile';
import { getHiddenBenchmarkScenarios, getTrainingScenarios, splitBenchmarkScenarios } from '../src/learning-engine/benchmark';
import { buildTrainingPrescription, getPokerNorthStar } from '../src/learning-engine/prescription';
import { inferScenarioSituationNodes } from '../src/learning-engine/situationGraph';
import { estimateSpotFrequencyPer100Hands, expectedLearningValue } from '../src/learning-engine/trainingValue';
import { applyExploitAdjustment } from '../src/strategy-engine-v2/exploit';
import { getDecision } from '../src/strategy-engine-v2/engine';
import { STRATEGY_PROFILES_V2 } from '../src/strategy-engine-v2';
import { truthRank } from '../src/strategy-engine-v2/truth';
import { calculateHeadsUpIcmRisk, calculateHeadsUpPkoRisk, calculateIcm, satellitePayouts } from '../src/tournament/icm';
import { HistoryItem, Scenario } from '../src/types';

function scenario(id: string, title: string, category: string[], street: 'Preflop' | 'Flop' | 'Turn' | 'River', position = 'BTN'): Scenario {
  return {
    id, title, category, difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false,
    userStack: '100BB', userBB: 100, position, holeCards: [{ rank: 'A', suit: 'spades' }, { rank: 'K', suit: 'hearts' }],
    preAction: '', effectiveStack: '100BB', steps: [{ id: 'a', street, communityCards: [], description: title, potSize: 5, options: ['Fold', 'Call'], feedbacks: {} }],
  };
}

test('hidden benchmark split is stable and disjoint', () => {
  const first = splitBenchmarkScenarios(scenarios);
  const second = splitBenchmarkScenarios(scenarios);
  assert.deepEqual(first.holdout.map(item => item.id), second.holdout.map(item => item.id));
  assert.equal(first.training.some(item => first.holdout.some(hidden => hidden.id === item.id)), false);
  assert.equal(first.training.length + first.holdout.length, scenarios.length);
  assert.ok(first.holdout.length >= 1);
});

test('normal profile filtering never leaks hidden holdout scenarios', () => {
  const hidden = new Set(getHiddenBenchmarkScenarios(scenarios).map(item => item.id));
  const relevant = filterRelevantScenarios(scenarios, { ...DEFAULT_PLAYER_PROFILE, onboardingComplete: true });
  assert.equal(relevant.some(item => hidden.has(item.id)), false);
  assert.ok(getTrainingScenarios(scenarios).length > 0);
});

test('spot frequency favors common blind-defense work over rare overbets', () => {
  const bb = scenario('bb-defense-demo', 'BB 防守 BTN 開池', ['BB 防守'], 'Preflop', 'BB');
  const overbet = scenario('river-overbet-demo', 'River 面對 150% overbet', ['Bluff Catch'], 'River', 'BB');
  assert.ok(estimateSpotFrequencyPer100Hands(bb) > estimateSpotFrequencyPer100Hands(overbet));
  const bbValue = expectedLearningValue(bb, []);
  const overbetValue = expectedLearningValue(overbet, []);
  assert.ok(bbValue.spotFrequencyPer100Hands > overbetValue.spotFrequencyPer100Hands);
});

test('truth hierarchy never ranks heuristic above exact or solver data', () => {
  assert.ok(truthRank('verified-solver') > truthRank('exact-math'));
  assert.ok(truthRank('exact-math') > truthRank('population-exploit'));
  assert.ok(truthRank('population-exploit') > truthRank('expert-baseline'));
  assert.ok(truthRank('expert-baseline') > truthRank('heuristic-estimate'));
});

test('exploit overlay remains explicit heuristic and responds to archetype', () => {
  const profile = STRATEGY_PROFILES_V2.find(item => item.context.spot === 'bb-defense')!;
  const baseline = getDecision(profile, 'K7s');
  const nit = applyExploitAdjustment(baseline, 'nit');
  const lag = applyExploitAdjustment(baseline, 'lag');
  assert.equal(nit.trustTier, 'heuristic-estimate');
  assert.equal(lag.trustTier, 'heuristic-estimate');
  assert.ok(nit.adjusted.fold >= lag.adjusted.fold);
});

test('satellite payout vector creates equal tickets and conserves prize pool', () => {
  const payouts = satellitePayouts(3, 1);
  assert.deepEqual(payouts, [1, 1, 1]);
  const result = calculateIcm([{ id: 'a', stack: 40 }, { id: 'b', stack: 30 }, { id: 'c', stack: 20 }, { id: 'd', stack: 10 }], payouts);
  const sum = Object.values(result.equities).reduce((total, value) => total + value, 0);
  assert.ok(Math.abs(sum - 3) < 1e-9);
});

test('PKO bounty can lower the call break-even threshold when hero covers villain', () => {
  const input = {
    players: [{ id: 'hero', stack: 40 }, { id: 'villain', stack: 18 }, { id: 'p3', stack: 25 }, { id: 'p4', stack: 17 }],
    payouts: [50, 30, 20], heroId: 'hero', villainId: 'villain', amountAtRisk: 18, showdownEquity: 0.45,
  };
  const icm = calculateHeadsUpIcmRisk(input);
  const pko = calculateHeadsUpPkoRisk({ ...input, villainBountyValue: 12 });
  assert.equal(pko.canEliminateVillain, true);
  assert.ok(pko.bountyEv > 0);
  assert.ok(pko.pkoBreakEvenPercent < icm.icmBreakEvenPercent);
});

test('situation graph identifies river overbet context', () => {
  const spot = scenario('situation-demo', 'River 面對 150% overbet', ['Bluff Catch'], 'River', 'BB');
  const ids = inferScenarioSituationNodes(spot).map(item => item.id);
  assert.ok(ids.includes('situation.street.river'));
  assert.ok(ids.includes('situation.size.overbet'));
  assert.ok(ids.includes('situation.position.bb'));
});

test('prescription north star measures expected loss and hidden benchmark separately', () => {
  const now = Date.now();
  const history: HistoryItem[] = [
    { scenarioId: 'x', category: ['BB 防守'], score: 4, judgment: '錯誤', timestamp: now - 2 * 86400000, evLossBB: 0.2, spotFrequencyPer100Hands: 8, skillIds: ['preflop.bb-defense'], correct: false },
    { scenarioId: 'y', category: ['BB 防守'], score: 9, judgment: '正確', timestamp: now - 86400000, evLossBB: 0.02, spotFrequencyPer100Hands: 8, skillIds: ['preflop.bb-defense'], correct: true },
    { scenarioId: 'holdout', category: ['Transfer'], score: 8, judgment: '正確', timestamp: now, trainingType: 'benchmark', correct: true },
  ];
  const northStar = getPokerNorthStar(history, now);
  const prescription = buildTrainingPrescription(history, now);
  assert.ok(northStar.recentExpectedLossPer100 > 0);
  assert.equal(northStar.benchmarkAccuracy, 100);
  assert.equal(prescription.days.length, 4);
  assert.equal(prescription.days[3].purpose, 'holdout');
});
