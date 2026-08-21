import test from 'node:test';
import assert from 'node:assert/strict';
import { HistoryItem, Scenario } from '../src/types';
import { scenarioContextFamilyId } from '../src/learning-engine/contextIdentity';
import { expectedLearningValue } from '../src/learning-engine/trainingValue';
import { calculateSkillMastery } from '../src/learning-engine/skillGraph';
import { learningOutcomeSummary } from '../src/learning-engine/errorModel';
import { transferBenchmarkReport } from '../src/learning-engine/transferBenchmark';
import { importPostSessionJson } from '../src/real-game/sessionImport';

function scenario(type: Scenario['type'] = 'Cash Game'): Scenario {
  return {
    id: type === 'Cash Game' ? 'cash-bb-btn' : 'mtt-bb-btn',
    title: 'BB vs BTN open',
    category: ['BB 防守'],
    difficulty: '中階',
    type,
    blinds: '1/2',
    ante: type === 'Tournament',
    userStack: '40BB',
    userBB: 40,
    position: 'BB',
    tableSize: '6max',
    holeCards: [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'hearts' }],
    preAction: 'BTN open 2.5BB',
    effectiveStack: '40BB',
    steps: [{ id: 'p', street: 'Preflop', communityCards: [], description: 'BTN open 2.5BB', potSize: 4, options: ['Fold', 'Call', 'Raise'], feedbacks: {} }],
  };
}

function cashEvidence(target: Scenario, familyOverride?: string): HistoryItem {
  const family = familyOverride || scenarioContextFamilyId(target);
  return {
    schemaVersion: 5,
    trainingType: 'real-hand',
    scenarioId: 'real-cash',
    category: ['Cash', 'BB 防守'],
    gameFormat: 'Cash',
    sessionId: 'cash-session',
    handsObserved: 500,
    spotExposureCount: 40,
    spotFrequencyPer100Hands: 8,
    contextFamilyId: family,
    evidenceFamilyId: `Cash:${family}`,
    skillIds: ['preflop.bb-defense'],
    score: 3,
    judgment: 'leak',
    timestamp: 1000,
    correct: false,
    truthTier: 'verified-solver',
    utilityLoss: 0.3,
    utilityUnit: 'bb',
    utilityModel: 'cash-chip-ev',
  };
}

test('same skill is not enough to join evidence across context families', () => {
  const target = scenario('Cash Game');
  const value = expectedLearningValue(target, [cashEvidence(target, 'ctx-different')]);
  assert.equal(value.spotFrequencySource, 'heuristic-prior');
  assert.equal(value.evGainEvidence, 'estimated');
  assert.equal(value.reportableExpectedEvGainPer100Hands, undefined);
});

test('matched cash context joins exposure and verified regret', () => {
  const target = scenario('Cash Game');
  const value = expectedLearningValue(target, [cashEvidence(target)]);
  assert.equal(value.utilityMode, 'cash-bb');
  assert.equal(value.utilityUnit, 'bb');
  assert.equal(value.spotFrequencyPer100Hands, 8);
  assert.equal(value.evGainEvidence, 'verified');
  assert.ok((value.reportableExpectedEvGainPer100Hands || 0) > 0);
});

test('tournament typed dollar utility is scheduled as tournament utility, not BB', () => {
  const target = scenario('Tournament');
  const family = scenarioContextFamilyId(target);
  const evidence: HistoryItem = {
    schemaVersion: 5,
    trainingType: 'real-hand',
    scenarioId: 'mtt-real',
    category: ['MTT', 'ICM'],
    gameFormat: 'MTT',
    sessionId: 'mtt-session',
    handsObserved: 200,
    spotExposureCount: 4,
    contextFamilyId: family,
    skillIds: ['tournament.icm'],
    score: 2,
    judgment: 'ICM leak',
    timestamp: 1000,
    correct: false,
    truthTier: 'exact-math',
    utilityLoss: 12.5,
    utilityUnit: 'dollar-ev',
    utilityModel: 'icm',
  };
  const value = expectedLearningValue(target, [evidence]);
  assert.equal(value.utilityMode, 'tournament-dollar');
  assert.equal(value.utilityUnit, 'dollar-ev');
  assert.equal(value.reportableExpectedEvGainPer100Hands, undefined);
  assert.ok((value.reportableExpectedUtilityGainPer100Hands || 0) > 0);
});

test('tournament chip BB evidence is rejected as incompatible utility', () => {
  const target = scenario('Tournament');
  const family = scenarioContextFamilyId(target);
  const evidence: HistoryItem = {
    schemaVersion: 5,
    trainingType: 'real-hand', scenarioId: 'mtt-chip', category: ['MTT'], gameFormat: 'MTT', contextFamilyId: family,
    sessionId: 'mtt-session', handsObserved: 100, spotExposureCount: 2,
    score: 0, judgment: 'wrong', timestamp: 1, correct: false, truthTier: 'exact-math',
    utilityLoss: 1.5, utilityUnit: 'bb', utilityModel: 'cash-chip-ev',
  };
  const value = expectedLearningValue(target, [evidence]);
  assert.equal(value.utilityMode, 'tournament-priority');
  assert.equal(value.reportableExpectedUtilityGainPer100Hands, undefined);
});

test('effective sample confidence rewards context diversity over duplicate drilling', () => {
  const base = (index: number, family: string): HistoryItem => ({
    schemaVersion: 5,
    trainingType: 'scenario',
    scenarioId: `s-${family}`,
    contextFamilyId: family,
    category: ['BB 防守'],
    skillIds: ['preflop.bb-defense'],
    score: 10,
    judgment: '正確',
    timestamp: Date.UTC(2026, 7, 1 + index),
    correct: true,
    truthTier: 'verified-solver',
  });
  const duplicates = Array.from({ length: 8 }, (_, index) => base(index, 'ctx-one'));
  const diverse = Array.from({ length: 8 }, (_, index) => base(index, `ctx-${index}`));
  const duplicateMastery = calculateSkillMastery(duplicates, Date.UTC(2026, 8, 1))[0];
  const diverseMastery = calculateSkillMastery(diverse, Date.UTC(2026, 8, 1))[0];
  assert.ok(diverseMastery.effectiveSampleSize > duplicateMastery.effectiveSampleSize);
  assert.ok(diverseMastery.sampleConfidence > duplicateMastery.sampleConfidence);
});

test('learning outcome separates immediate repair, delayed retention and transfer', () => {
  const history: HistoryItem[] = [
    { scenarioId: 'a', category: ['x'], score: 0, judgment: 'wrong', timestamp: 0, correct: false },
    { scenarioId: 'a', category: ['x'], score: 10, judgment: 'right', timestamp: 1000, correct: true },
    { scenarioId: 'a', category: ['x'], score: 10, judgment: 'right', timestamp: 24 * 3600 * 1000, correct: true, isDelayedReview: true },
    { scenarioId: 'b', category: ['x'], score: 10, judgment: 'right', timestamp: 48 * 3600 * 1000, correct: true, isTransferTest: true, transferLevel: 'context' },
  ];
  const outcome = learningOutcomeSummary(history);
  assert.ok(outcome.repairSamples >= 1);
  assert.equal(outcome.retentionSamples, 1);
  assert.equal(outcome.transferSamples, 1);
  assert.ok(outcome.delayedRetention > 0.5);
  assert.ok(outcome.transferSuccess > 0.5);
});

test('transfer report separates near context and structural generalization', () => {
  const history: HistoryItem[] = [
    { scenarioId: 'n', category: ['x'], score: 10, judgment: 'right', timestamp: 1, correct: true, isTransferTest: true, transferLevel: 'near' },
    { scenarioId: 'c', category: ['x'], score: 0, judgment: 'wrong', timestamp: 2, correct: false, isTransferTest: true, transferLevel: 'context' },
    { scenarioId: 's', category: ['x'], score: 10, judgment: 'right', timestamp: 3, correct: true, isTransferTest: true, transferLevel: 'structural' },
  ];
  const report = transferBenchmarkReport(history);
  assert.equal(report.near.accuracy, 100);
  assert.equal(report.context.accuracy, 0);
  assert.equal(report.structural.accuracy, 100);
});

test('post-session importer emits typed v6 evidence', () => {
  const target = scenario('Cash Game');
  const family = scenarioContextFamilyId(target);
  const payload = JSON.stringify({
    schemaVersion: 1,
    session: { id: 'import-1', format: 'Cash', handsObserved: 1000 },
    spots: [{ contextFamilyId: family, label: 'BB vs BTN', skillIds: ['preflop.bb-defense'], exposureCount: 55, mistakeCount: 6, utilityLoss: 0.22, utilityUnit: 'bb', utilityModel: 'cash-chip-ev', truthTier: 'verified-solver' }],
  });
  const [item] = importPostSessionJson(payload, 123);
  assert.equal(item.schemaVersion, 6);
  assert.equal(item.sessionId, 'import-1');
  assert.equal(item.handsObserved, 1000);
  assert.equal(item.spotExposureCount, 55);
  assert.equal(item.contextFamilyId, family);
  assert.equal(item.utilityUnit, 'bb');
  assert.equal(item.spotFrequencyPer100Hands, 5.5);
});
