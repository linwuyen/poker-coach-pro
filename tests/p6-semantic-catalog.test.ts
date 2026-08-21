import assert from 'node:assert/strict';
import test from 'node:test';
import { coreScenarios, curatedTeachingVariants, scenarios, semanticTeachingScenarios } from '../src/teaching/scenarioCatalog';
import { validateScenarios } from '../src/utils/validateScenarios';

test('P6 expands the bank to 152 genuine decision families plus cosmetic retrieval instances', () => {
  assert.equal(coreScenarios.length, 88);
  assert.equal(semanticTeachingScenarios.length, 64);
  assert.equal(curatedTeachingVariants.length, 64);
  assert.equal(scenarios.length, 216);
  assert.equal(new Set(scenarios.map(scenario => scenario.decisionFamilyId || scenario.id)).size, 152);
  assert.deepEqual(validateScenarios(scenarios), []);
});

test('exact-math semantic catalog contains real decision-boundary flips, not suit renames', () => {
  const potOdds = semanticTeachingScenarios.filter(scenario => scenario.id.startsWith('math-pot-odds-'));
  const bluffs = semanticTeachingScenarios.filter(scenario => scenario.id.startsWith('math-pure-bluff-'));
  assert.equal(potOdds.length, 32);
  assert.equal(bluffs.length, 32);
  const potBest = new Set(potOdds.map(scenario => scenario.steps[0].feedbacks.Fold?.bestAction));
  assert.ok(potBest.has('Fold'));
  assert.ok(potBest.has('Call'));
  const bluffBest = new Set(bluffs.map(scenario => scenario.steps[0].feedbacks.Check?.bestAction));
  assert.ok(bluffBest.has('Check'));
  assert.ok([...bluffBest].some(action => action && action !== 'Check'));
  assert.ok(semanticTeachingScenarios.every(scenario => scenario.steps[0].feedbacks[scenario.steps[0].options[0]]?.evidence?.sourceConfidence === 'exact-math'));
});
