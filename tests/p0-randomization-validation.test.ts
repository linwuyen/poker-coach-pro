import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PLAYER_PROFILE } from '../src/domain/playerProfile';
import { buildDailyTrainingPlan } from '../src/features/training/sessionPlanner';
import { ActionType, Scenario } from '../src/types';
import { validateScenarios } from '../src/utils/validateScenarios';

function makeScenario(id: string, bestAction: ActionType = 'Call'): Scenario {
  return {
    id,
    title: `Scenario ${id}`,
    category: ['Preflop'],
    difficulty: '新手',
    type: 'Cash Game',
    blinds: '1/2',
    ante: false,
    userStack: '200',
    userBB: 100,
    position: 'BB',
    holeCards: [
      { rank: 'A', suit: 'spades' },
      { rank: '8', suit: 'diamonds' },
    ],
    preAction: 'BTN Open 2BB',
    effectiveStack: '100BB',
    tableSize: '6max',
    benchmarkRole: 'training',
    steps: [{
      id: 'decision',
      street: 'Preflop',
      communityCards: [],
      description: 'Hero to act',
      potSize: 3.5,
      options: ['Fold', 'Call'],
      feedbacks: {
        Fold: { judgment: bestAction === 'Fold' ? '正確' : '錯誤', score: bestAction === 'Fold' ? 10 : 0, bestAction, why: 'test', conceptualError: 'test', remember: 'test', nextStepId: 'next_hand' },
        Call: { judgment: bestAction === 'Call' ? '正確' : '錯誤', score: bestAction === 'Call' ? 10 : 0, bestAction, why: 'test', conceptualError: 'test', remember: 'test', nextStepId: 'next_hand' },
      },
    }],
  };
}

test('daily planner samples high-value candidates without duplicates and can avoid the previous first question', () => {
  const all = Array.from({ length: 30 }, (_, index) => makeScenario(String(index + 1)));
  const randomValues = [0.02, 0.61, 0.34, 0.88, 0.19, 0.73, 0.42, 0.95, 0.11, 0.57, 0.26, 0.81];
  let cursor = 0;
  const random = () => randomValues[(cursor++) % randomValues.length];
  const first = buildDailyTrainingPlan(all, [], 8, 1_800_000_000_000, { ...DEFAULT_PLAYER_PROFILE, onboardingComplete: true }, { random });
  assert.equal(first.items.length, 8);
  assert.equal(new Set(first.items.map(item => item.scenario.id)).size, 8);

  cursor = 0;
  const second = buildDailyTrainingPlan(all, [], 8, 1_800_000_000_000, { ...DEFAULT_PLAYER_PROFILE, onboardingComplete: true }, {
    random,
    avoidFirstScenarioId: first.items[0].scenario.id,
  });
  assert.notEqual(second.items[0].scenario.id, first.items[0].scenario.id);
});

test('due review remains in the plan even when novelty penalties apply', () => {
  const all = Array.from({ length: 20 }, (_, index) => makeScenario(String(index + 1)));
  const now = 1_800_000_000_000;
  const history = [{
    scenarioId: '1', stepId: 'decision', category: ['Preflop'], score: 0, judgment: '錯誤', timestamp: now - 86400000, nextReviewAt: now - 1,
  }];
  const plan = buildDailyTrainingPlan(all, history, 6, now, undefined, { random: () => 0.99 });
  assert.ok(plan.items.some(item => item.scenario.id === '1'));
  assert.equal(plan.counts['due-review'], 1);
});

test('scenario validator rejects contradictory bestAction declarations', () => {
  const broken = makeScenario('broken');
  broken.steps[0].feedbacks.Fold!.bestAction = 'Fold';
  const errors = validateScenarios([broken]);
  assert.ok(errors.some(error => error.includes('disagree on canonical bestAction')));
});

test('scenario validator rejects judgment and score contradictions', () => {
  const broken = makeScenario('broken-score');
  broken.steps[0].feedbacks.Call!.score = 5;
  const errors = validateScenarios([broken]);
  assert.ok(errors.some(error => error.includes('judgment "正確" requires score >= 8')));
});
