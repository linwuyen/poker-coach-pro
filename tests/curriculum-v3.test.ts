import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { practicalCurriculum } from '../src/teaching/practicalCurriculum';
import { scenarios, semanticTeachingScenarios } from '../src/teaching/scenarioCatalog';
import { DEFAULT_PLAYER_PROFILE, getStackBand } from '../src/domain/playerProfile';
import { scenarioMatchesTrainingTrack, isAssessmentScenario } from '../src/domain/trainingTrack';
import { validateScenarios } from '../src/utils/validateScenarios';
import { CurriculumPanel } from '../src/features/training/CurriculumPanel';
import { TrainingSession } from '../src/features/training/TrainingSession';

const find = (key: string) => {
  const scenario = practicalCurriculum.find(s => s.id === `course-${key}`);
  assert.ok(scenario, `missing lesson ${key}`);
  return scenario;
};

test('MTT BBA reduces BB remaining stack without also reducing BTN stack', () => {
  const scenario = find('mtt-srp');
  assert.equal(scenario.userBB, 17.8);
  assert.equal(scenario.userStack, '17.8BB');
  assert.equal(scenario.effectiveStack, '16.8BB');
  assert.equal(scenario.steps[0].handState?.heroStackBB, 17.8);
  assert.equal(scenario.steps[0].handState?.villainStackBB, 16.8);
  assert.deepEqual(scenario.steps[0].potAccounting?.contributionsBB, [2.2, 2.2, 0.5, 1]);
  const html = renderToStaticMarkup(React.createElement(TrainingSession, { scenarios:[scenario], history:[], title:scenario.title, onRecord:()=>{}, onExit:()=>{}, onComplete:()=>{} }));
  const summary = html.match(/data-testid="decision-stacks"[^>]*>([\s\S]*?)<\/div>/)?.[1] || '';
  assert.ok(summary.includes('Hero 剩餘 17.8BB'));
  assert.ok(summary.includes('對手剩餘 16.8BB'));
  assert.ok(summary.includes('有效剩餘 16.8BB'));
});

test('authored answer insertion order cannot reveal the highest-scoring option', () => {
  const positions = practicalCurriculum.map(s => {
    const step = s.steps[0];
    return step.options.indexOf(step.feedbacks[step.options[0]]!.bestAction);
  });
  assert.ok(new Set(positions).size >= 3, 'correct options must appear across all three answer positions');
  assert.ok(positions.filter(p => p === 0).length < positions.length * 0.6, 'first option must not reveal the answer');
  for (const s of practicalCurriculum) {
    assert.deepEqual([...s.steps[0].options].sort(), Object.keys(s.steps[0].feedbacks).sort());
  }
});

test('MTT turn lessons teach second barrels, completed draws, low SPR value and a missed draw fold', () => {
  const expected = [
    ['mtt-turn-barrel', 'Bet half pot', 9.9, 25.8, 24.8],
    ['mtt-turn-flush', 'Check', 9.9, 25.8, 24.8],
    ['mtt-turn-low-spr', 'Bet half pot', 9.9, 15.8, 14.8],
    ['mtt-turn-missed-draw', 'Fold', 15.9, 34.8, 29.8],
  ] as const;
  for (const [key, best, pot, hero, villain] of expected) {
    const s = find(key), step = s.steps[0];
    assert.equal(s.type, 'Tournament');
    assert.equal(step.street, 'Turn');
    assert.equal(step.feedbacks[step.options[0]]!.bestAction, best);
    assert.equal(step.potSize, pot);
    assert.equal(step.handState?.heroStackBB, hero);
    assert.equal(step.handState?.villainStackBB, villain);
    assert.equal(s.userBB, hero);
    assert.equal(s.effectiveStack, `${Math.min(hero, villain)}BB`);
  }
});

test('Cash includes distinct 9max, 20–40BB short and over-100BB deep lessons with audited decisions', () => {
  const expected = [
    ['cash-9max-value', '3-bet', 4, 100, 97.5],
    ['cash-9max-multiway', 'Check', 9.5, 97, 97],
    ['cash-short-value', 'All-in', 18.5, 21, 21],
    ['cash-short-draw', 'Call', 26.5, 31, 23],
    ['cash-deep-pot-control', 'Check', 32.5, 184, 184],
    ['cash-deep-nuts', 'Bet big', 45.5, 177.5, 177.5],
  ] as const;
  for (const [key, best, pot, hero, villain] of expected) {
    const s = find(key), step = s.steps[0];
    assert.equal(s.type, 'Cash Game');
    assert.equal(step.feedbacks[step.options[0]]!.bestAction, best);
    assert.equal(step.potSize, pot);
    assert.equal(step.handState?.heroStackBB, hero);
    assert.equal(step.handState?.villainStackBB, villain);
    assert.equal(s.userBB, hero);
    assert.equal(s.effectiveStack, `${Math.min(hero, villain)}BB`);
  }
  assert.ok(expected.slice(0, 2).every(([id]) => find(id).tableSize === '9max'));
  assert.ok(expected.slice(2, 4).every(([id]) => find(id).userBB >= 20 && find(id).userBB <= 40));
  assert.ok(expected.slice(4).every(([id]) => Number.parseFloat(find(id).effectiveStack) > 100));
});

test('new lessons are legal, conditional and reachable in the catalog and filtered elective panel', () => {
  const newLessons = practicalCurriculum.filter(s => /course-(?:mtt-turn-|cash-9max-|cash-short-(?:value|draw)|cash-deep-)/.test(s.id));
  assert.ok(newLessons.length >= 10);
  assert.deepEqual(validateScenarios(newLessons), []);
  for (const s of newLessons) {
    const step = s.steps[0];
    assert.ok(step.assumptions && step.assumptions.length >= 2);
    assert.ok(step.strategySource?.includes('not a solver'));
    assert.equal(isAssessmentScenario(s), false);
    assert.ok(step.potAccounting);
    assert.ok(Math.abs(step.potAccounting.contributionsBB.reduce((sum, n) => sum + n, 0) - step.potSize) < 1e-8);
    assert.ok(step.handState?.actions.some(a => a.street === 'Preflop'));
    const facingBet = (step.potAccounting.callCostBB || 0) > 0;
    assert.ok(facingBet ? !step.options.includes('Check') : !step.options.includes('Call'));
    const track = s.type === 'Tournament' ? 'tournament' : 'cash';
    const profile = { ...DEFAULT_PLAYER_PROFILE, formats:[track], tableSizes:[s.tableSize!], stackBands:[getStackBand(Number.parseFloat(s.effectiveStack))], focusAreas:[step.street === 'Preflop' ? 'preflop' : 'postflop'] } as typeof DEFAULT_PLAYER_PROFILE;
    assert.ok(scenarios.some(candidate => candidate.id === s.id && scenarioMatchesTrainingTrack(candidate, track, profile)), `${s.id} must reach automatic training`);
    const html = renderToStaticMarkup(React.createElement(CurriculumPanel, { track, profile, history:[], onStart:()=>{}, onPreferences:()=>{} }));
    const button = html.match(new RegExp(`<button[^>]*data-testid="course-${s.id}"[^>]*>`))?.[0];
    assert.ok(button && !/\sdisabled(?:=|\s|>)/.test(button), `${s.id} must be selectable with matching preferences`);
  }
});

test('Cash exact-math training is directly selectable while respecting math preferences', () => {
  const profile = { ...DEFAULT_PLAYER_PROFILE, focusAreas: ['math'] as typeof DEFAULT_PLAYER_PROFILE.focusAreas };
  const html = renderToStaticMarkup(React.createElement(CurriculumPanel, { track:'cash', profile, history:[], onStart:()=>{}, onPreferences:()=>{} }));
  const candidates = semanticTeachingScenarios.filter(s => scenarioMatchesTrainingTrack(s, 'cash', profile));
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every(s => html.includes(`data-testid="course-${s.id}"`)));
});

