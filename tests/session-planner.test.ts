import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDailyTrainingPlan } from '../src/features/training/sessionPlanner';
import { HistoryItem, Scenario } from '../src/types';

function scenario(id: string, category: string): Scenario {
  return {
    id,
    title: `Scenario ${id}`,
    category: [category],
    difficulty: '新手',
    type: 'Cash Game',
    blinds: '1/2',
    ante: false,
    userStack: '200',
    userBB: 100,
    position: 'BTN',
    holeCards: [],
    preAction: '前位棄牌',
    effectiveStack: '100BB',
    steps: [],
  };
}

test('daily plan returns unique scenarios and respects requested size', () => {
  const all = Array.from({ length: 20 }, (_, index) => scenario(String(index + 1), index % 2 ? '多人底池' : 'SPR'));
  const now = Date.now();
  const history: HistoryItem[] = [
    { scenarioId: '1', category: ['SPR'], score: 2, judgment: '錯誤', timestamp: now - 1000, nextReviewAt: now - 1 },
    { scenarioId: '2', category: ['多人底池'], score: 4, judgment: '錯誤', timestamp: now - 2000, nextReviewAt: now - 1 },
    { scenarioId: '3', category: ['SPR'], score: 10, judgment: '正確', timestamp: now - 3000 },
    { scenarioId: '4', category: ['多人底池'], score: 3, judgment: '錯誤', timestamp: now - 4000 },
  ];
  const plan = buildDailyTrainingPlan(all, history, 12, now);
  assert.equal(plan.items.length, 12);
  assert.equal(new Set(plan.items.map(item => item.scenario.id)).size, 12);
  assert.ok(plan.counts['due-review'] >= 2);
  assert.ok(plan.counts.new >= 1);
});

test('daily plan degrades gracefully with a small question bank', () => {
  const all = [scenario('1', 'Preflop'), scenario('2', 'SPR')];
  const plan = buildDailyTrainingPlan(all, [], 12, Date.now());
  assert.equal(plan.items.length, 2);
  assert.deepEqual(plan.items.map(item => item.scenario.id).sort(), ['1', '2']);
});
