import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildScenarioAnalysisContext } from '../src/features/analysis/analysisContext';
import { generateEquivalentDecisionVariants } from '../src/learning-engine/variantGenerator';
import { coreScenarios } from '../src/teaching/scenarioCatalog';
import type { HistoryItem } from '../src/types';

test('generated scenario analysis context stays atomic with the live decision', () => {
  const base = coreScenarios.find(scenario => scenario.id === '8');
  assert.ok(base, 'base scenario 8 must exist');
  const scenario = generateEquivalentDecisionVariants(base, 6)[4];
  assert.equal(scenario.id, 'gen-8-iso-13');
  assert.match(scenario.title, /KQs 面對三街壓力/);

  const step = scenario.steps[0];
  const feedback = step.feedbacks.Fold;
  assert.ok(feedback, 'Fold feedback must exist');

  const item: HistoryItem = {
    schemaVersion: 6,
    attemptId: 'analysis-context-regression',
    trainingType: 'scenario',
    scenarioId: scenario.id,
    stepId: step.id,
    category: scenario.category || [],
    score: feedback.score,
    judgment: feedback.judgment,
    timestamp: 1788037039183,
    selectedAction: 'Fold',
    bestAction: feedback.bestAction,
    street: step.street,
    position: scenario.position,
    correct: true,
    truthTier: 'expert-baseline',
    questionLabel: scenario.title,
  };

  const context = buildScenarioAnalysisContext(scenario, step, item, feedback);

  assert.equal(context.scenarioId, 'gen-8-iso-13');
  assert.equal(context.startingHand, 'KQs');
  assert.deepEqual(context.heroCards.map(card => card[0]), ['K', 'Q']);
  assert.equal(context.street, 'River');
  assert.equal(context.boardCards.length, 5);
  assert.equal(context.effectiveStackBB, 50);
  assert.equal(context.potBB, 16);
  assert.equal(context.selectedAction, 'Fold');
  assert.equal(context.bestAction, 'Fold');
  assert.equal(context.villainRange, undefined, 'expert-baseline scenario must not invent a villain range');
});

test('scenario tools receive live context and equity remounts on ctx hash changes', () => {
  const sessionSource = readFileSync('src/features/training/TrainingSession.tsx', 'utf8');
  const routerSource = readFileSync('src/main.tsx', 'utf8');

  assert.match(sessionSource, /buildScenarioAnalysisContext\(scenario, step, currentItem, feedback\)/);
  assert.match(sessionSource, /<AdvancedToolLinks tournament=\{scenario\.type === 'Tournament'\} context=\{analysisContext\} \/>/);
  assert.match(routerSource, /<EquityWorkbench key=\{route\} onExit=\{exitLab\} \/>/);
});
