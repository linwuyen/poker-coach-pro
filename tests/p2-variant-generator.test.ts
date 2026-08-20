import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGeneratedVariantPool, generateEquivalentDecisionVariants, sampleVariantSession } from '../src/learning-engine/variantGenerator';
import { coreScenarios } from '../src/teaching/scenarioCatalog';
import { validateScenarios } from '../src/utils/validateScenarios';

test('variant generator creates 528 safe transfer nodes from the 88-scenario core', () => {
  const pool = buildGeneratedVariantPool(coreScenarios, 6);
  assert.equal(pool.length, 528);
  assert.equal(new Set(pool.map(item => item.id)).size, 528);
  assert.deepEqual(validateScenarios(pool), []);
});

test('equivalent variants preserve strategic ground truth', () => {
  const source = coreScenarios[0];
  const variants = generateEquivalentDecisionVariants(source, 6);
  const sourceBest = source.steps.map(step => Object.values(step.feedbacks).filter(Boolean).map(feedback => feedback!.bestAction));
  variants.forEach(variant => {
    assert.equal(variant.reviewSourceId, source.id);
    assert.deepEqual(variant.steps.map(step => Object.values(step.feedbacks).filter(Boolean).map(feedback => feedback!.bestAction)), sourceBest);
  });
});

test('random variant session has unique ids and avoids same source back-to-back', () => {
  const pool = buildGeneratedVariantPool(coreScenarios.slice(0, 5), 6);
  let cursor = 0;
  const values = [0.9, 0.1, 0.7, 0.2, 0.8, 0.3, 0.6, 0.4, 0.5];
  const session = sampleVariantSession(pool, 24, () => values[(cursor++) % values.length]);
  assert.equal(session.length, 24);
  assert.equal(new Set(session.map(item => item.id)).size, 24);
  for (let index = 1; index < session.length; index += 1) {
    assert.notEqual(session[index].reviewSourceId, session[index - 1].reviewSourceId);
  }
});
