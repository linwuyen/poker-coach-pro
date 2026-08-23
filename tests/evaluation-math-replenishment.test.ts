import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExactMathEvaluationScenarios } from '../src/teaching/evaluationMathScenarios';
import { scenarios as scenarioCatalog } from '../src/teaching/scenarioCatalog';

test('replenished exact-math holdouts do not expose a sequence-to-answer shortcut', () => {
  const generated = buildExactMathEvaluationScenarios(64000, 128);
  const catalogIds = new Set(scenarioCatalog.map(scenario => scenario.id));
  const bestActionsByIdParity = [new Set<string>(), new Set<string>()];

  assert.equal(generated.length, 128);
  assert.equal(new Set(generated.map(scenario => scenario.id)).size, generated.length);
  assert.ok(generated.every(scenario => scenario.benchmarkRole === 'holdout'));
  assert.ok(generated.every(scenario => !catalogIds.has(scenario.id)));
  assert.ok(generated.every(scenario => !/#\d+/.test(scenario.title)));

  for (const scenario of generated) {
    const match = /^eval-math-pot-odds-(\d+)$/.exec(scenario.id);
    assert.ok(match, `unexpected generated id: ${scenario.id}`);
    const bestAction = scenario.steps[0].feedbacks.Fold?.bestAction;
    assert.ok(bestAction === 'Fold' || bestAction === 'Call');
    bestActionsByIdParity[Number(match![1]) % 2].add(bestAction);
  }

  assert.deepEqual([...bestActionsByIdParity[0]].sort(), ['Call', 'Fold']);
  assert.deepEqual([...bestActionsByIdParity[1]].sort(), ['Call', 'Fold']);
});
