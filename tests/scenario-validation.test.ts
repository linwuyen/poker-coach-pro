import assert from 'node:assert/strict';
import test from 'node:test';
import { scenarios } from '../src/data';
import { validateScenarios } from '../src/utils/validateScenarios';

test('all bundled scenarios satisfy the content contract', () => {
  assert.deepEqual(validateScenarios(scenarios), []);
});

test('the library includes branching multi-street practice', () => {
  const multiStreet = scenarios.filter(scenario => scenario.steps.length > 1);
  assert.ok(multiStreet.length >= 3);
  assert.ok(multiStreet.some(scenario => Object.values(scenario.steps[0].feedbacks).some(feedback => feedback?.nextStepId !== 'next_hand')));
});
