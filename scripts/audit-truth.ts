import assert from 'node:assert/strict';
import { isTruthBackedScenario, scenarioBestAction } from '../src/learning-engine/infiniteHandGenerator';
import { buildGeneratedVariantPool } from '../src/learning-engine/variantGenerator';
import {
  coreScenarios,
  curatedTeachingVariants,
  scenarios,
  semanticTeachingScenarios,
} from '../src/teaching/scenarioCatalog';
import { Scenario } from '../src/types';

function definedFeedbacks(scenario: Scenario) {
  return scenario.steps.flatMap(step => Object.values(step.feedbacks).filter(Boolean));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function assertExactMathEvidence(scenario: Scenario): void {
  assert.ok(scenario.steps.length > 0, `${scenario.id}: exact-math scenario has no steps`);
  for (const step of scenario.steps) {
    assert.ok(step.strategySource?.toLowerCase().includes('exact'), `${scenario.id}/${step.id}: exact-math step must name an exact derivation source`);
    const feedbacks = Object.values(step.feedbacks).filter(Boolean);
    assert.ok(feedbacks.length >= 2, `${scenario.id}/${step.id}: exact-math decision needs at least two graded actions`);
    for (const feedback of feedbacks) {
      const evidence = feedback!.evidence;
      assert.equal(evidence?.sourceConfidence, 'exact-math', `${scenario.id}/${step.id}: every graded action must retain exact-math provenance`);

      const actionEvBB = evidence?.actionEvBB;
      const bestEvBB = evidence?.bestEvBB;
      const evLossBB = evidence?.evLossBB;
      assert.ok(Number.isFinite(actionEvBB), `${scenario.id}/${step.id}: action EV must be finite`);
      assert.ok(Number.isFinite(bestEvBB), `${scenario.id}/${step.id}: best EV must be finite`);
      assert.ok(Number.isFinite(evLossBB), `${scenario.id}/${step.id}: EV loss must be finite`);

      const expectedEvLossBB = round3(bestEvBB! - actionEvBB!);
      assert.ok(
        Math.abs(evLossBB! - expectedEvLossBB) <= Number.EPSILON * 8,
        `${scenario.id}/${step.id}: EV loss identity mismatch; expected ${expectedEvLossBB}BB from bestEvBB - actionEvBB, got ${evLossBB}BB`,
      );
      assert.ok(evLossBB! >= 0, `${scenario.id}/${step.id}: exact EV loss cannot be negative`);
      assert.ok(evidence?.objective, `${scenario.id}/${step.id}: exact-math objective is missing`);
      assert.ok(evidence?.reversals?.length, `${scenario.id}/${step.id}: exact reversal evidence is missing`);
    }
  }
}

function bestActionVector(scenario: Scenario): string[] {
  return scenario.steps.map((_, index) => scenarioBestAction(scenario, index) || 'UNKNOWN');
}

function assertInheritedTruth(base: Scenario, variant: Scenario): void {
  assert.equal(variant.reviewSourceId, base.id, `${variant.id}: reviewSourceId must identify its canonical source`);
  assert.equal(variant.decisionFamilyId, base.decisionFamilyId || base.id, `${variant.id}: cosmetic variants must not create new mastery families`);
  assert.deepEqual(bestActionVector(variant), bestActionVector(base), `${variant.id}: a suit-only transform changed strategy truth`);
  assert.equal(variant.type, base.type, `${variant.id}: a truth-preserving transform changed game format`);
  assert.equal(variant.position, base.position, `${variant.id}: a truth-preserving transform changed position`);
  assert.equal(variant.userBB, base.userBB, `${variant.id}: a truth-preserving transform changed stack depth`);
  assert.equal(variant.steps.length, base.steps.length, `${variant.id}: a truth-preserving transform changed the decision path`);
}

assert.equal(coreScenarios.length, 88, 'Canonical reviewed family inventory changed; update the truth audit intentionally.');
assert.equal(semanticTeachingScenarios.length, 64, 'Exact-math family inventory changed; update the truth audit intentionally.');
assert.equal(curatedTeachingVariants.length, 64, 'Rendered suit-isomorphic inventory changed unexpectedly.');
assert.equal(scenarios.length, 216, 'Production scenario inventory changed unexpectedly.');
assert.equal(scenarios.every(isTruthBackedScenario), true, 'Every production scenario must remain internally gradeable.');

semanticTeachingScenarios.forEach(assertExactMathEvidence);

const coreById = new Map(coreScenarios.map(item => [item.id, item]));
for (const variant of curatedTeachingVariants) {
  const base = variant.reviewSourceId ? coreById.get(variant.reviewSourceId) : undefined;
  assert.ok(base, `${variant.id}: curated variant source is missing`);
  assertInheritedTruth(base!, variant);
}

const generated = buildGeneratedVariantPool(coreScenarios, 6);
assert.equal(generated.length, 528, 'Generated safe-variant inventory changed unexpectedly.');
for (const variant of generated) {
  const base = variant.reviewSourceId ? coreById.get(variant.reviewSourceId) : undefined;
  assert.ok(base, `${variant.id}: generated variant source is missing`);
  assertInheritedTruth(base!, variant);
}

const genuineFamilies = new Set([...coreScenarios, ...semanticTeachingScenarios].map(item => item.decisionFamilyId || item.id));
assert.equal(genuineFamilies.size, 152, 'Genuine semantic family count must not be inflated by cosmetic variants.');

const exactFeedbackCount = semanticTeachingScenarios.reduce((sum, scenario) => sum + definedFeedbacks(scenario).length, 0);
console.log(JSON.stringify({
  renderedScenarios: scenarios.length,
  genuineDecisionFamilies: genuineFamilies.size,
  reviewedCoreFamilies: coreScenarios.length,
  exactMathFamilies: semanticTeachingScenarios.length,
  exactMathGradedActions: exactFeedbackCount,
  curatedSuitIsomorphs: curatedTeachingVariants.length,
  generatedSafeVariants: generated.length,
  invariant: 'Unknown/unsupported evidence is never upgraded by this audit; it only verifies declared exact math and truth-preserving transforms.',
}, null, 2));
