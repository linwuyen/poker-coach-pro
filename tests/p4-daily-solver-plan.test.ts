import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dailyCurriculumQuota,
  rebalanceDailyCurriculumQuota,
  selectDailyGeneralizationRows,
  selectDailySemanticPairs,
} from '../src/learning-engine/dailySolverPlan';
import { SolverCorpusRole } from '../src/learning-engine/solverCurriculum';
import { PokerBenchPreflopRow, PokerBenchRow } from '../src/solver-data/pokerbench';

function row(id: string, holding: string, correctDecision = 'Call'): PokerBenchPreflopRow {
  return {
    id,
    split: 'preflop',
    prevLine: 'BTN raises 2.5',
    numPlayers: 6,
    numBets: 1,
    availableMoves: ['Fold', 'Call'],
    correctDecision,
    potSize: 4,
    heroPosition: 'BB',
    holding,
  };
}

function roleOf(value: PokerBenchRow): SolverCorpusRole {
  if (value.id.startsWith('hold')) return 'holdout';
  if (value.id.startsWith('sib')) return 'sibling';
  return 'training';
}

const levelOf = () => 2 as const;

test('daily quotas sum exactly to configured 8/12/20 decisions', () => {
  for (const total of [8, 12, 20]) {
    const quota = dailyCurriculumQuota(total);
    assert.equal(quota.curated + quota.semanticDecisions + quota.generalization, total);
    assert.equal(quota.semanticDecisions, quota.semanticPairs * 2);
  }
});

test('due reviews consume the daily budget before new solver transfer work', () => {
  const base = dailyCurriculumQuota(12);
  const eightDue = rebalanceDailyCurriculumQuota(base, 8);
  assert.equal(eightDue.curated, 8);
  assert.equal(eightDue.curated + eightDue.semanticDecisions + eightDue.generalization, 12);
  const allDue = rebalanceDailyCurriculumQuota(base, 12);
  assert.deepEqual(allDue, { total: 12, curated: 12, semanticPairs: 0, semanticDecisions: 0, generalization: 0 });
});

test('Daily generalization never selects sibling or holdout rows', () => {
  const rows = [
    row('train-a', 'AhKd'),
    row('train-b', 'QhJd'),
    row('sib-a', '9h9d'),
    row('hold-a', '8h8d'),
  ];
  const selected = selectDailyGeneralizationRows(rows, [], 10, undefined, { roleOf, levelOf, random: () => 0.5 });
  assert.deepEqual(new Set(selected.map(item => item.id)), new Set(['train-a', 'train-b']));
});

test('Daily semantic pairs require both rows to be in training partition', () => {
  const trainingLeft = row('train-a', 'AhKd', 'Call');
  const trainingRight = row('train-b', '2h2d', 'Fold');
  const holdoutFlip = row('hold-c', '3h3d', 'Fold');
  const selected = selectDailySemanticPairs([trainingLeft, trainingRight, holdoutFlip], [], 5, undefined, { roleOf, levelOf, random: () => 0.5 });
  assert.equal(selected.length, 1);
  assert.ok([selected[0].left.id, selected[0].right.id].every(id => id.startsWith('train-')));
});

test('Daily generalization honors semantic-row exclusions', () => {
  const rows = [row('train-a', 'AhKd'), row('train-b', 'QhJd')];
  const selected = selectDailyGeneralizationRows(rows, [], 10, undefined, {
    roleOf,
    levelOf,
    random: () => 0.5,
    excludeIds: new Set(['train-a']),
  });
  assert.deepEqual(selected.map(item => item.id), ['train-b']);
});
