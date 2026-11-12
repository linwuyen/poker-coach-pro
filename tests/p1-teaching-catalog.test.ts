import assert from 'node:assert/strict';
import test from 'node:test';
import { scenarios } from '../src/data';
import { coreScenarios, curatedTeachingVariants, semanticTeachingScenarios } from '../src/teaching/scenarioCatalog';
import { validateScenarios } from '../src/utils/validateScenarios';

test('teaching catalog has 164 decision families including explicit MTT math plus cosmetic retrieval instances', () => {
  assert.equal(coreScenarios.length, 88);
  assert.equal(semanticTeachingScenarios.length, 64);
  assert.equal(curatedTeachingVariants.length, 64);
  assert.equal(scenarios.length, 228);
  assert.equal(new Set(scenarios.map(scenario => scenario.decisionFamilyId || scenario.id)).size, 164);
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
