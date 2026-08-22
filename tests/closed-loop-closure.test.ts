import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { exactScenarioMinimalFlip } from '../src/learning-engine/minimalFlip';
import { exactMathSemanticScenarios } from '../src/teaching/semanticMathScenarios';
import type { Scenario } from '../src/types';

test('correct action with failed reasoning is routed back into targeted repair', () => {
  const table = readFileSync('src/features/training/InfiniteTrainingTable.tsx', 'utf8');
  assert.match(table, /annotated\.correct === false \|\| annotated\.reasoningProbeResult === 'fail'/);
  assert.match(table, /fragile-reasoning-review/);
  assert.match(table, /selectTargetedReviewCandidates\(pool, candidate/);
});

test('hidden exam waits for the full mixed holdout pool before question one', () => {
  const exam = readFileSync('src/features/training/ExamMode.tsx', 'utf8');
  assert.match(exam, /if \(loadingSolver\) \{/);
  assert.doesNotMatch(exam, /if \(loadingSolver && !pool\.length\)/);
  assert.match(exam, /initialHistory/);
});

test('minimal flip does not guess a target action when exact evidence has multiple alternatives', () => {
  const base = exactMathSemanticScenarios[0];
  const scenario = JSON.parse(JSON.stringify(base)) as Scenario;
  const step = scenario.steps[0];
  step.options = ['Fold', 'Call', 'Raise'];
  const callFeedback = step.feedbacks.Call;
  if (!callFeedback) throw new Error('fixture lacks Call feedback');
  step.feedbacks.Raise = { ...callFeedback, judgment: '錯誤', score: 2, bestAction: callFeedback.bestAction };
  const flip = exactScenarioMinimalFlip(scenario, step.id);
  assert.ok(flip);
  assert.equal(flip!.toAction, '見 reversal 證據（多選項，不猜）');
});
