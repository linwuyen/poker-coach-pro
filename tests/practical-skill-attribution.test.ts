import assert from 'node:assert/strict';
import test from 'node:test';
import { inferScenarioStepSkillIds, calculateSkillMastery } from '../src/learning-engine/skillGraph';
import { buildKnowledgeStates } from '../src/learning-engine/closedLoop';
import { practicalCurriculum } from '../src/teaching/practicalCurriculum';
import { loadHistory, HISTORY_KEY, makeTrainingBackup } from '../src/utils/history';
import type { HistoryItem, ScenarioStep } from '../src/types';

test('explicit decision skills override broad lesson grouping and reject incompatible skills', () => {
  const step = { street: 'Preflop', skillIds: ['preflop.3bet', 'postflop.multiway', 'tournament.push-fold', 'unknown', 'preflop.3bet'] } as unknown as ScenarioStep;
  const actual = inferScenarioStepSkillIds({ category: ['9-max 位置與多人底池'], type: 'Cash Game' } as any, step);
  assert.deepEqual(actual, ['preflop.3bet']);
});

test('fallback cannot credit postflop skills on preflop or tournament skills for Cash', () => {
  assert.deepEqual(inferScenarioStepSkillIds({ category: ['多人', '3-bet', '短碼'], type: 'Cash Game' } as any, { street: 'Preflop' }), ['preflop.3bet']);
  assert.deepEqual(inferScenarioStepSkillIds({ category: ['3-bet', '短碼', 'SPR'], type: 'Cash Game' } as any, { street: 'Turn' }), ['math.spr', 'postflop.board-texture']);
});

const legacy: HistoryItem = {
  attemptId: 'existing-attempt', trainingType: 'scenario', scenarioId: 'course-cash-9max-value',
  decisionFamilyId: 'course-cash-9max-value', stepId: 'decision', gameFormat: 'Cash', street: 'Preflop',
  category: ['實戰課程', '9-max 位置與多人底池'], skillIds: ['postflop.multiway', 'preflop.rfi'],
  timestamp: 100, nextReviewAt: 100000, reviewIntervalDays: 1, score: 10, correct: true, judgment: '正確', selectedAction: '3-bet',
};

test('9max 3bet attempts credit 3bet rather than RFI or multiway, including old records', () => {
  const course = practicalCurriculum.find(s => s.id === legacy.scenarioId)!;
  assert.deepEqual(inferScenarioStepSkillIds(course, course.steps[0]), ['preflop.3bet']);
  const states = buildKnowledgeStates([legacy], 'cash');
  assert.equal(states.find(s => s.skillId === 'preflop.3bet')?.evidenceCount, 1);
  assert.equal(states.find(s => s.skillId === 'preflop.rfi')?.evidenceCount, 0);
  assert.equal(states.find(s => s.skillId === 'postflop.multiway')?.evidenceCount, 0);
  assert.deepEqual(calculateSkillMastery([legacy]).map(s => s.skillId), ['preflop.3bet']);
});

test('loading and exporting known course history repairs skills without deleting attempts or review deadlines', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const store = new Map([[HISTORY_KEY, JSON.stringify([legacy])]]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) } });
  try {
    const loaded = loadHistory();
    assert.equal(loaded.length, 1);
    assert.deepEqual(loaded[0].skillIds, ['preflop.3bet']);
    assert.equal(loaded[0].attemptId, legacy.attemptId);
    assert.equal(loaded[0].nextReviewAt, legacy.nextReviewAt);
    assert.equal(loaded[0].selectedAction, legacy.selectedAction);
    assert.deepEqual(makeTrainingBackup([legacy], []).history[0].skillIds, ['preflop.3bet']);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('unknown step ids do not borrow another decision skill from the same course', () => {
  const unknown = { ...legacy, stepId: 'missing-step', skillIds: ['math.pot-odds'] };
  assert.deepEqual(calculateSkillMastery([unknown]).map(s => s.skillId), ['math.pot-odds']);
});
