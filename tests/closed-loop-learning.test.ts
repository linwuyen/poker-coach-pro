import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  adaptiveCalibrationReport,
  buildKnowledgeStates,
  candidateLearningSignal,
  verifiedEvNorthStar,
} from '../src/learning-engine/closedLoop';
import { inferSituationIdsFromScenarioStep } from '../src/learning-engine/contextIdentity';
import { normalizeSituationId } from '../src/learning-engine/coverageMatrix';
import type { InfiniteHandCandidate } from '../src/learning-engine/infiniteHandGenerator';
import { exactScenarioMinimalFlip } from '../src/learning-engine/minimalFlip';
import { inferScenarioStepSkillIds, SKILL_GRAPH } from '../src/learning-engine/skillGraph';
import { exactMathSemanticScenarios } from '../src/teaching/semanticMathScenarios';
import { reasoningProbeOptions, shouldShowReasoningProbe } from '../src/features/training/TrainingSession';
import type { Feedback, HistoryItem, Scenario } from '../src/types';

const DAY = 86400000;

function historyItem(values: Partial<HistoryItem> = {}): HistoryItem {
  return {
    schemaVersion: 6,
    attemptId: values.attemptId || Math.random().toString(36),
    trainingType: 'scenario',
    scenarioId: 'family-a',
    category: ['Exact Math', 'Pot Odds'],
    score: 10,
    judgment: '正確',
    timestamp: 1,
    correct: true,
    ...values,
  };
}

test('verified EV north star accepts only evaluation-grade exact/solver cash BB evidence', () => {
  const now = 30 * DAY;
  const history: HistoryItem[] = [
    historyItem({ trainingType: 'benchmark', timestamp: now - 10 * DAY, truthTier: 'exact-math', gameFormat: 'Cash', utilityUnit: 'bb', utilityModel: 'cash-chip-ev', evLossBB: 0.8 }),
    historyItem({ trainingType: 'benchmark', timestamp: now - 2 * DAY, truthTier: 'exact-math', gameFormat: 'Cash', utilityUnit: 'bb', utilityModel: 'cash-chip-ev', evLossBB: 0.3, durationMs: 3600000 }),
    historyItem({ trainingType: 'scenario', timestamp: now - 2 * DAY, truthTier: 'exact-math', gameFormat: 'Cash', utilityUnit: 'bb', utilityModel: 'cash-chip-ev', evLossBB: 9, durationMs: 60000, trainingDwellMs: 3600000 }),
    historyItem({ trainingType: 'benchmark', timestamp: now - 2 * DAY, truthTier: 'expert-baseline', gameFormat: 'Cash', utilityUnit: 'bb', utilityModel: 'cash-chip-ev', evLossBB: 7 }),
    historyItem({ trainingType: 'benchmark', timestamp: now - 2 * DAY, truthTier: 'exact-math', gameFormat: 'MTT', utilityUnit: 'bb', utilityModel: 'cash-chip-ev', evLossBB: 6 }),
  ];
  const result = verifiedEvNorthStar(history, now);
  assert.equal(result.samples, 2);
  assert.equal(result.previousAverageEvLossBB, 0.8);
  assert.equal(result.recentAverageEvLossBB, 0.3);
  assert.ok(Math.abs((result.deltaBBPerDecision || 0) + 0.5) < 1e-9);
  assert.equal(result.trainingHours, 1);
  assert.ok(Math.abs((result.learningRoiBBPerHour || 0) - 0.5) < 1e-9);
});

test('learning ROI never substitutes answer latency for complete training dwell', () => {
  const now = 30 * DAY;
  const result = verifiedEvNorthStar([
    historyItem({ trainingType: 'benchmark', timestamp: now - 10 * DAY, truthTier: 'exact-math', gameFormat: 'Cash', utilityUnit: 'bb', utilityModel: 'cash-chip-ev', evLossBB: 0.8 }),
    historyItem({ trainingType: 'benchmark', timestamp: now - 2 * DAY, truthTier: 'exact-math', gameFormat: 'Cash', utilityUnit: 'bb', utilityModel: 'cash-chip-ev', evLossBB: 0.3 }),
    historyItem({ trainingType: 'scenario', timestamp: now - 2 * DAY, durationMs: 3600000 }),
  ], now);
  assert.equal(result.trainingHours, 0);
  assert.equal(result.learningRoiBBPerHour, undefined);
});

test('current-step skill inference does not leak later-street skills into an attempt', () => {
  const scenario = { category: [] };
  const preflop = inferScenarioStepSkillIds(scenario, { conceptIds: ['RFI'], street: 'Preflop' });
  const flop = inferScenarioStepSkillIds(scenario, { conceptIds: ['Board Texture'], street: 'Flop' });
  assert.ok(preflop.includes('preflop.rfi'));
  assert.ok(!preflop.some(id => id.startsWith('postflop.')));
  assert.ok(flop.includes('postflop.board-texture'));
  assert.ok(!flop.some(id => id.startsWith('preflop.')));
});

test('current-step situation inference exposes only the street actually tested', () => {
  const scenario = {
    id: 'multi-street-test', title: 'multi', category: [], difficulty: '中階', type: 'Cash Game', blinds: '1/2', ante: false,
    userStack: '100 BB', userBB: 100, position: 'BTN', holeCards: [], preAction: 'x', effectiveStack: '100 BB', tableSize: '6max',
    steps: [
      { id: 'flop', street: 'Flop', communityCards: [], description: 'f', potSize: 10, options: [], feedbacks: {} },
      { id: 'turn', street: 'Turn', communityCards: [], description: 't', potSize: 20, options: [], feedbacks: {} },
      { id: 'river', street: 'River', communityCards: [], description: 'r', potSize: 30, options: [], feedbacks: {} },
    ],
  } as Scenario;
  const ids = inferSituationIdsFromScenarioStep(scenario, scenario.steps[0]);
  assert.ok(ids.includes('street.flop'));
  assert.ok(!ids.includes('street.turn'));
  assert.ok(!ids.includes('street.river'));
  assert.ok(ids.includes('position.btn'));
  assert.ok(ids.includes('format.cash'));
});

test('knowledge state keeps zero-evidence skills visible as coverage gaps', () => {
  const states = buildKnowledgeStates([]);
  assert.equal(states.length, SKILL_GRAPH.length);
  assert.ok(states.every(state => state.dataGap));
  assert.ok(states.every(state => state.evidenceCount === 0));
});

test('solver decisions are first-class knowledge-state evidence', () => {
  const states = buildKnowledgeStates([
    historyItem({ trainingType: 'solver-corpus', skillIds: ['preflop.solver-decision'], category: ['PokerBench', 'Preflop'], street: 'Preflop', truthTier: 'verified-solver', correct: true }),
  ]);
  const solverState = states.find(state => state.skillId === 'preflop.solver-decision');
  assert.ok(solverState);
  assert.equal(solverState!.evidenceCount, 1);
  assert.equal(solverState!.understanding, 100);
});

test('coverage canonicalizes solver situation prefixes', () => {
  assert.equal(normalizeSituationId('situation.street.river'), 'street.river');
  assert.equal(normalizeSituationId('situation.position.btn'), 'position.btn');
  assert.equal(normalizeSituationId('street.river'), 'street.river');
});

test('active learning favors uncertainty and due repair instead of only recent novelty', () => {
  const scenario = exactMathSemanticScenarios[0];
  const candidate = {
    kind: 'scenario', id: 'curated:test', source: 'curated', familyId: scenario.decisionFamilyId || scenario.id,
    presentationFingerprint: 'x', truthLabel: 'exact', street: scenario.steps[0].street, position: scenario.position,
    format: 'cash', stackBand: '80-125', actionClass: 'call', scenario,
  } as unknown as InfiniteHandCandidate;
  const unseen = candidateLearningSignal(candidate, [], 1000);
  assert.equal(unseen.predictedSuccessProbability, 0.5);
  assert.equal(unseen.uncertainty, 1);
  const mastered = Array.from({ length: 8 }, (_, index) => historyItem({ decisionFamilyId: candidate.familyId, scenarioId: scenario.id, timestamp: 100 + index, correct: true }));
  const masteredSignal = candidateLearningSignal(candidate, mastered, 1000);
  assert.ok(masteredSignal.predictedSuccessProbability > unseen.predictedSuccessProbability);
  assert.ok(masteredSignal.uncertainty < unseen.uncertainty);
  const repair = [historyItem({ decisionFamilyId: candidate.familyId, scenarioId: scenario.id, timestamp: 900, correct: false, score: 0, nextReviewAt: 950, evLossBB: 1.5 })];
  const repairSignal = candidateLearningSignal(candidate, repair, 1000);
  assert.ok(repairSignal.duePressure > 0);
  assert.ok(repairSignal.priorityScore > masteredSignal.priorityScore);
});

test('adaptive predictor calibration reports Brier score from observed decisions', () => {
  const report = adaptiveCalibrationReport([historyItem({ predictedSuccessProbability: 0.8, correct: true }), historyItem({ predictedSuccessProbability: 0.2, correct: false })]);
  assert.equal(report.samples, 2);
  assert.ok(Math.abs((report.brierScore || 0) - 0.04) < 1e-9);
  assert.ok(report.bins.length >= 1);
});

test('minimal flip accepts exact reversal evidence and refuses weaker truth', () => {
  const exact = exactMathSemanticScenarios[0];
  const flip = exactScenarioMinimalFlip(exact, exact.steps[0].id);
  assert.ok(flip);
  assert.equal(flip!.source, 'exact-math');
  assert.match(flip!.change, /break-even|Equity|門檻/i);
  const weak = JSON.parse(JSON.stringify(exact)) as Scenario;
  Object.values(weak.steps[0].feedbacks).forEach(feedback => { if (feedback?.evidence) feedback.evidence.sourceConfidence = 'expert-baseline'; });
  assert.equal(exactScenarioMinimalFlip(weak, weak.steps[0].id), undefined);
});

test('reasoning probe is occasional, post-answer, and exact-math gated', () => {
  const feedback: Feedback = { judgment: '正確', score: 10, bestAction: 'Call', why: 'x', conceptualError: '無', remember: 'x', nextStepId: 'next_hand', evidence: { sourceConfidence: 'exact-math', reversals: ['Equity 低於 25% 時翻轉為 Fold'] } };
  let shown = 0;
  for (let index = 0; index < 32; index += 1) if (shouldShowReasoningProbe(historyItem({ attemptId: `probe-${index}`, correct: true }), feedback)) shown += 1;
  assert.ok(shown > 0 && shown < 32);
  assert.equal(shouldShowReasoningProbe(historyItem({ correct: false }), feedback), false);
  assert.equal(shouldShowReasoningProbe(historyItem({ correct: true }), { ...feedback, evidence: { ...feedback.evidence, sourceConfidence: 'expert-baseline' } }), false);
});

test('reasoning probe correct option position varies by attempt while truth stays attached', () => {
  const reversal = 'Equity 低於 25% 時翻轉為 Fold';
  const positions = new Set<number>();
  for (let index = 0; index < 32; index += 1) {
    const options = reasoningProbeOptions(reversal, `attempt-${index}`);
    assert.equal(options.filter(option => option.correct).length, 1);
    assert.equal(options.find(option => option.correct)?.text, reversal);
    positions.add(options.findIndex(option => option.correct));
  }
  assert.ok(positions.size > 1);
});

test('closed-loop product surfaces are actually wired into the player flow', () => {
  const app = readFileSync('src/app/AppV2.tsx', 'utf8');
  const main = readFileSync('src/main.tsx', 'utf8');
  const table = readFileSync('src/features/training/InfiniteTrainingTable.tsx', 'utf8');
  const training = readFileSync('src/features/training/TrainingSession.tsx', 'utf8');
  const solver = readFileSync('src/features/training/SolverDecisionSession.tsx', 'utf8');
  const exam = readFileSync('src/features/training/ExamMode.tsx', 'utf8');
  const tools = readFileSync('src/features/training/AdvancedToolLinks.tsx', 'utf8');

  assert.match(app, /verifiedEvNorthStar/); assert.match(app, /buildKnowledgeStates/); assert.match(app, /adaptiveCalibrationReport/); assert.match(app, /knowledge-state-matrix/); assert.match(app, /#exam-mode/);
  assert.match(main, /#exam-mode/); assert.match(main, /#minimal-flip/);
  assert.match(table, /candidateLearningSignal/); assert.match(table, /predictedSuccessProbability/); assert.match(table, /active-learning-signal/);
  assert.match(table, /typeof annotated\.trainingDwellMs === 'number'/);
  assert.doesNotMatch(table, /candidateStartedAt|finalizeTrainingDwell/);
  assert.match(table, /inferScenarioStepSkillIds/);
  assert.match(training, /reasoning-probe/); assert.match(training, /fragile-knowledge/); assert.match(training, /reasoningProbeOptions/);
  assert.match(training, /skillIds: inferScenarioStepSkillIds\(scenario, step\)/);
  assert.match(training, /situationIds: inferSituationIdsFromScenarioStep\(scenario, step\)/);
  assert.match(training, /trainingDwellMs: Math\.max\(0, Date\.now\(\) - startedAt\.current\)/);
  assert.match(training, /utilityModel: verifiedCashEv \? 'cash-chip-ev'/);
  assert.match(solver, /trainingDwellMs: Math\.max\(0, Date\.now\(\) - startedAt\.current\)/);
  assert.match(exam, /feedback intentionally withheld|feedback withheld|不顯示正誤/); assert.match(exam, /initialHistory/); assert.match(exam, /submissionLock\.current/); assert.match(exam, /disabled=\{disabled\}/);
  assert.match(exam, /skillIds: inferScenarioStepSkillIds\(scenario, step\)/);
  assert.match(exam, /situationIds: inferSituationIdsFromScenarioStep\(scenario, step\)/);
  assert.doesNotMatch(exam, /<TrainingSession/); assert.doesNotMatch(exam, /<SolverDecisionSession/);
  assert.match(tools, /#minimal-flip/);
});