import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMastery, getHistoryMasteryKey } from '../src/learning-engine';
import { expectedLearningValue } from '../src/learning-engine/trainingValue';
import { HistoryItem, Scenario } from '../src/types';

function scenario(id: string, family?: string): Scenario {
  return {
    id,
    decisionFamilyId: family,
    title: id,
    category: ['Preflop'],
    difficulty: '新手',
    type: 'Cash Game',
    blinds: '1/2',
    ante: false,
    userStack: '200',
    userBB: 100,
    position: 'BB',
    holeCards: [{ rank: 'A', suit: 'spades' }, { rank: 'K', suit: 'diamonds' }],
    preAction: 'BTN Open 2BB',
    effectiveStack: '100BB',
    benchmarkRole: 'training',
    steps: [{
      id: 'decision', street: 'Preflop', communityCards: [], description: 'act', potSize: 3.5,
      options: ['Fold', 'Call'],
      feedbacks: {
        Fold: { judgment: '錯誤', score: 0, bestAction: 'Call', why: 'x', conceptualError: 'x', remember: 'x', nextStepId: 'next_hand' },
        Call: { judgment: '正確', score: 10, bestAction: 'Call', why: 'x', conceptualError: '無', remember: 'x', nextStepId: 'next_hand' },
      },
    }],
  };
}

function attempt(scenarioId: string, timestamp: number): HistoryItem {
  return {
    scenarioId,
    stepId: 'decision',
    masteryKey: `${scenarioId}::decision`,
    category: ['Preflop'],
    score: 10,
    judgment: '正確',
    correct: true,
    timestamp,
  };
}

test('legacy teach/gen variant ids collapse into the same mastery node', () => {
  const a = attempt('teach-23-iso-2', 1000);
  const b = attempt('gen-23-iso-9', 2000);
  assert.equal(getHistoryMasteryKey(a), '23::decision');
  assert.equal(getHistoryMasteryKey(b), '23::decision');
  const mastery = calculateMastery([a, b], 3000);
  assert.equal(mastery.length, 1);
  assert.equal(mastery[0].scenarioId, '23');
  assert.equal(mastery[0].attempts, 2);
});

test('explicit decisionFamilyId prevents cosmetic variants from appearing unseen', () => {
  const baseHistory = attempt('23', 1000);
  const variant = scenario('visual-copy-23', '23');
  const value = expectedLearningValue(variant, [baseHistory], 2000);
  assert.equal(value.unseen, false);
});
