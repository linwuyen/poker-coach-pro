import assert from 'node:assert/strict';
import test from 'node:test';
import { practicalCurriculum } from '../src/teaching/practicalCurriculum';
import { DEFAULT_PLAYER_PROFILE } from '../src/domain/playerProfile';
import { scenarioMatchesTrainingTrack, isAssessmentScenario } from '../src/domain/trainingTrack';
import { validateScenarios } from '../src/utils/validateScenarios';
import { coreScenarios } from '../src/teaching/scenarioCatalog';
import { buildTournamentEvaluationScenarios } from '../src/teaching/tournamentMathScenarios';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrainingSession } from '../src/features/training/TrainingSession';

test('decision-critical lesson assumptions are visible before grading', () => {
  const scenario = practicalCurriculum.find(s => s.id === 'course-mtt-30')!;
  const html = renderToStaticMarkup(React.createElement(TrainingSession, { scenarios:[scenario], history:[], title:scenario.title, onRecord:()=>{}, onExit:()=>{}, onComplete:()=>{} }));
  assert.ok(html.includes('無顯著 ICM 壓力'));
  assert.ok(html.indexOf('無顯著 ICM 壓力') < html.indexOf('data-testid="decision-action"'));
  assert.ok(!html.includes(scenario.steps[0].feedbacks.Raise!.why));
});

test('both practical curricula have usable preflop, postflop, short-stack and bluff-catching lessons', () => {
  assert.deepEqual(validateScenarios(practicalCurriculum), []);
  for (const track of ['cash', 'tournament'] as const) {
    for (const focus of ['preflop', 'postflop', 'short-stack', 'bluff-catching'] as const) {
      const available = practicalCurriculum.filter(s => scenarioMatchesTrainingTrack(s, track, { ...DEFAULT_PLAYER_PROFILE, focusAreas: [focus] }));
      assert.ok(available.length > 0, `${track}/${focus}`);
    }
  }
  for (const depth of [10, 15, 20, 30, 40]) {
    assert.ok(practicalCurriculum.some(s => s.type === 'Tournament' && s.userBB === depth && s.steps[0].street === 'Preflop'), `${depth}BB MTT`);
  }
  for (const s of practicalCurriculum) {
    assert.equal(isAssessmentScenario(s), false, 'authored coaching must not become exact assessment');
    assert.ok(s.steps.every(step => step.assumptions!.length >= 2));
  }
});

test('stack preferences match explicit effective depth, not Hero covering stack', () => {
  const s = { ...coreScenarios[0], tableSize: '6max' as const, userBB: 100, effectiveStack: '18BB' };
  const profile = { ...DEFAULT_PLAYER_PROFILE, stackBands: ['10-20'] as const, focusAreas: ['short-stack'] as const };
  assert.equal(scenarioMatchesTrainingTrack(s, 'cash', { ...profile, stackBands: [...profile.stackBands], focusAreas: [...profile.focusAreas] }), true);
  assert.equal(scenarioMatchesTrainingTrack({ ...s, effectiveStack: 'unknown' }, 'cash', DEFAULT_PLAYER_PROFILE), false);
});

test('authored alternatives never silently enter a different betting line', () => {
  const s86 = coreScenarios.find(s => s.id === '86')!;
  const s87 = coreScenarios.find(s => s.id === '87')!;
  assert.equal(s86.steps[0].feedbacks.Check!.nextStepId, 'next_hand');
  assert.equal(s86.steps[1].feedbacks['Bet half pot']!.nextStepId, 'next_hand');
  assert.equal(s87.steps[0].feedbacks.Call!.nextStepId, 'next_hand');
  assert.equal(s87.steps[1].feedbacks.Check!.nextStepId, 'next_hand');
  assert.equal(s87.steps[1].feedbacks['Bet half pot']!.nextStepId, 'next_hand');
  assert.equal(s87.steps[1].potSize, 22.5);
  assert.equal(s87.steps[2].potSize, 55.5);
  assert.equal(s87.steps[2].handState!.heroStackBB, 73);
});

test('MTT assessment supplies fresh balanced numeric models beyond the first exam', () => {
  const a = buildTournamentEvaluationScenarios(100, 32);
  const b = buildTournamentEvaluationScenarios(132, 32);
  assert.equal(a.length, 32);
  assert.equal(new Set([...a, ...b].map(s => s.id)).size, 64);
  assert.equal(new Set([...a, ...b].map(s => s.preAction + s.steps[0].description)).size, 64);
  assert.deepEqual(validateScenarios([...a, ...b]), []);
  for (const model of ['tournament-chip-ev', 'icm', 'satellite', 'pko']) {
    assert.equal(a.filter(s => s.steps[0].feedbacks.Call!.evidence!.utilityModel === model).length, 8);
  }
  assert.ok(a.every(s => s.benchmarkRole === 'holdout' && isAssessmentScenario(s)));
});
