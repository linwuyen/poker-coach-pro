import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { exactScenarioMinimalFlip } from '../src/learning-engine/minimalFlip';
import { exactMathSemanticScenarios } from '../src/teaching/semanticMathScenarios';
import type { Scenario } from '../src/types';

test('correct action with failed reasoning is routed back into targeted repair', () => {
  const table = readFileSync('src/features/training/InfiniteTrainingTable.tsx', 'utf8');
  assert.match(table, /annotated\.correct\s*===\s*false\s*\|\|\s*annotated\.reasoningProbeResult\s*===\s*'fail'/);
  assert.match(table, /fragile-reasoning-review/);
  assert.match(table, /selectTargetedReviewCandidates\(pool,\s*candidate/);
});

test('hidden exam waits for the full mixed holdout pool before question one', () => {
  const exam = readFileSync('src/features/training/ExamMode.tsx', 'utf8');
  assert.match(exam, /if\s*\(\s*loadingSolver\s*\)\s*return/);
  assert.doesNotMatch(exam, /if\s*\(\s*loadingSolver\s*&&\s*!pool\.length/);
  assert.match(exam, /initialHistory/);
});

test('revealed hidden exam cannot replay the same holdout inside one session', () => {
  const exam = readFileSync('src/features/training/ExamMode.tsx', 'utf8');
  assert.match(exam, /if\s*\(\s*complete\s*\)\s*return\s*<ExamReport\s+items=\{sessionItems\}\s+onExit=\{onExit\}\s*\/>/);
  assert.doesNotMatch(exam, /onRestart|再測一次/);
  assert.match(exam, /答案已揭露；本次 holdout session 不允許立即重考/);
  assert.match(exam, /data-testid="exam-exit-after-report"/);
});

test('hidden exam excludes previously exposed candidates at pool build and revalidates them inside the exclusive commit', () => {
  const exam = readFileSync('src/features/training/ExamMode.tsx', 'utf8');
  const history = readFileSync('src/utils/history.ts', 'utf8');
  assert.match(exam, /const\s+unseen\s*=\s*\(items:ExamCandidate\[\]\)\s*=>\s*items\.filter\(candidate\s*=>\s*!seen\(candidate\)\)/);
  assert.match(exam, /unseen\(evaluationCandidates\)/);
  assert.match(exam, /unseen\(benchmarkCandidates\)/);
  assert.match(exam, /unseen\(solverCandidates\)/);
  assert.doesNotMatch(exam, /Number\(seen\(a\)\)\s*-\s*Number\(seen\(b\)\)/);
  assert.match(exam, /await updateHistoryExclusive\(latest=>/);
  assert.match(exam, /filterFreshEvaluationItems\(latest,committedItems\)/);
  assert.match(history, /locks\.request\(HISTORY_WRITE_LOCK,\s*\{\s*mode:\s*'exclusive'\s*\}/);
  assert.match(exam, /取得 cross-tab exclusive history lock/);
  assert.match(exam, /中途退出或 lock 失敗都不留下 evaluation evidence/);
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
