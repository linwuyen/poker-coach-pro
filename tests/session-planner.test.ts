import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDailyTrainingPlan, getDueScenarioIds } from '../src/features/training/sessionPlanner';
import { DEFAULT_PLAYER_PROFILE } from '../src/domain/playerProfile';
import { HistoryItem, PlayerProfile, Scenario } from '../src/types';

function scenario(id: string, category: string, type: Scenario['type'] = 'Cash Game', userBB = 100): Scenario {
  return {
    id, title: `Scenario ${id}`, category: [category], difficulty: '新手', type, blinds: '1/2', ante: false,
    userStack: `${userBB}BB`, userBB, position: 'BTN', holeCards: [], preAction: '前位棄牌', effectiveStack: `${userBB}BB`,
    tableSize: type === 'Cash Game' ? '6max' : '9max', steps: [{ id: 'decision', street: 'Preflop', communityCards: [], description: 'Action?', potSize: 1.5, options: [], feedbacks: {} }],
  };
}

const now = 1_800_000_000_000;

test('daily plan returns unique scenarios and respects requested size', () => {
  const all = Array.from({ length: 20 }, (_, index) => scenario(String(index + 1), index % 2 ? '多人底池' : 'SPR'));
  const history: HistoryItem[] = [
    { scenarioId: '1', stepId: 'decision', category: ['SPR'], score: 2, judgment: '錯誤', timestamp: now - 1000, nextReviewAt: now - 1 },
    { scenarioId: '2', stepId: 'decision', category: ['多人底池'], score: 4, judgment: '錯誤', timestamp: now - 2000, nextReviewAt: now - 1 },
    { scenarioId: '3', stepId: 'decision', category: ['SPR'], score: 10, judgment: '正確', timestamp: now - 3000, nextReviewAt: now + 86400000 },
    { scenarioId: '4', stepId: 'decision', category: ['多人底池'], score: 3, judgment: '錯誤', timestamp: now - 4000, nextReviewAt: now + 600000 },
  ];
  const plan = buildDailyTrainingPlan(all, history, 12, now);
  assert.equal(plan.items.length, 12);
  assert.equal(new Set(plan.items.map(item => item.scenario.id)).size, 12);
  assert.equal(plan.counts['due-review'], 2);
  assert.ok(plan.counts.new >= 1);
});

test('wrong answers with a future nextReviewAt are not due', () => {
  const history: HistoryItem[] = [{ scenarioId: '1', stepId: 'decision', category: [], score: 0, judgment: '錯誤', timestamp: now - 1000, nextReviewAt: now + 600000 }];
  assert.deepEqual(getDueScenarioIds(history, now), []);
});

test('player profile prioritizes relevant format and stack band', () => {
  const all = [scenario('cash', 'Cash', 'Cash Game', 100), scenario('mtt', 'ICM', 'Tournament', 20), ...Array.from({ length: 12 }, (_, index) => scenario(`m${index}`, 'MTT', 'Tournament', 25))];
  const profile: PlayerProfile = { ...DEFAULT_PLAYER_PROFILE, onboardingComplete: true, formats: ['tournament'], tableSizes: ['9max'], stackBands: ['10-20', '20-40'] };
  const plan = buildDailyTrainingPlan(all, [], 8, now, profile);
  assert.ok(plan.items.some(item => item.scenario.id === 'mtt'));
  assert.ok(plan.items.filter(item => item.scenario.type === 'Tournament').length >= 7);
});

test('daily plan degrades gracefully with a small question bank', () => {
  const all = [scenario('1', 'Preflop'), scenario('2', 'SPR')];
  const plan = buildDailyTrainingPlan(all, [], 12, now);
  assert.equal(plan.items.length, 2);
  assert.deepEqual(plan.items.map(item => item.scenario.id).sort(), ['1', '2']);
});
