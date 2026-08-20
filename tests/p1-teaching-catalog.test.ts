import assert from 'node:assert/strict';
import test from 'node:test';
import { scenarios } from '../src/data';
import { coreScenarios, curatedTeachingVariants } from '../src/teaching/scenarioCatalog';
import { validateScenarios } from '../src/utils/validateScenarios';

test('teaching catalog expands the 88-scenario core to at least 150 validated scenarios', () => {
  assert.equal(coreScenarios.length, 88);
  assert.equal(curatedTeachingVariants.length, 64);
  assert.equal(scenarios.length, 152);
  assert.deepEqual(validateScenarios(scenarios), []);
});

test('curated variants preserve best actions while changing physical suit identity', () => {
  const variant = curatedTeachingVariants[0];
  const source = coreScenarios.find(item => item.id === variant.reviewSourceId);
  assert.ok(source);
  assert.notEqual(variant.id, source!.id);
  assert.deepEqual(
    variant.steps.map(step => Object.values(step.feedbacks).filter(Boolean).map(feedback => feedback!.bestAction)),
    source!.steps.map(step => Object.values(step.feedbacks).filter(Boolean).map(feedback => feedback!.bestAction)),
  );
  assert.notDeepEqual(variant.holeCards, source!.holeCards);
});
