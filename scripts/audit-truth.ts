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
import { practicalCurriculum } from '../src/teaching/practicalCurriculum';
import { tournamentTrainingScenarios } from '../src/teaching/tournamentMathScenarios';
import { heldOutTurnAssessments } from '../src/teaching/heldOutTurnAssessments';

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
assert.equal(scenarios.length, 294, 'Production scenario inventory changed unexpectedly.');
assert.equal(scenarios.every(isTruthBackedScenario), true, 'Every production scenario must remain internally gradeable.');

semanticTeachingScenarios.forEach(assertExactMathEvidence);
for (const scenario of tournamentTrainingScenarios) {
  for (const feedback of definedFeedbacks(scenario)) {
    const evidence = feedback!.evidence!;
    assert.equal(evidence.sourceConfidence, 'exact-math');
    assert.ok(Number.isFinite(evidence.actionUtility) && Number.isFinite(evidence.bestUtility) && Number.isFinite(evidence.utilityLoss));
    assert.ok(Math.abs(evidence.bestUtility! - evidence.actionUtility! - evidence.utilityLoss!) < 1e-8);
    assert.equal(evidence.evLossBB, undefined, 'MTT utility must not be fabricated as cash BB loss');
    assert.ok(evidence.utilityUnit && evidence.utilityModel);
  }
}

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

const declaredFamilies = new Set([...coreScenarios, ...semanticTeachingScenarios, ...tournamentTrainingScenarios, ...practicalCurriculum, ...heldOutTurnAssessments].map(item => item.decisionFamilyId || item.id));
assert.equal(new Set(semanticTeachingScenarios.map(s => s.steps[0].description)).size, 48, 'Repeated numeric inputs must not inflate independent coverage.');
assert.equal(declaredFamilies.size, 206, 'Declared family inventory must exclude cosmetic variants and table aliases.');
assert.equal(heldOutTurnAssessments.length, 32);
assert.equal(new Set(heldOutTurnAssessments.map(item => item.decisionFamilyId)).size, 8);
for (const scenario of heldOutTurnAssessments) {
  assert.equal(scenario.benchmarkRole, 'holdout');
  for (const feedback of definedFeedbacks(scenario)) {
    const evidence = feedback!.evidence!;
    assert.equal(evidence.sourceConfidence, 'exact-math');
    assert.ok(Number.isFinite(evidence.actionUtility) && Number.isFinite(evidence.bestUtility));
    assert.ok(Math.abs(evidence.bestUtility! - evidence.actionUtility! - evidence.utilityLoss!) < 1e-8);
    if (scenario.type === 'Tournament') assert.equal(evidence.evLossBB, undefined);
  }
}

const exactFeedbackCount = semanticTeachingScenarios.reduce((sum, scenario) => sum + definedFeedbacks(scenario).length, 0);
console.log(JSON.stringify({
  renderedScenarios: scenarios.length,
  declaredDecisionFamilies: declaredFamilies.size,
  reviewedCoreFamilies: coreScenarios.length,
  renderedCashMathLessons: semanticTeachingScenarios.length,
  independentCashMathInputs: new Set(semanticTeachingScenarios.map(s => s.steps[0].description)).size,
  exactMathGradedActions: exactFeedbackCount,
  curatedSuitIsomorphs: curatedTeachingVariants.length,
  generatedSafeVariants: generated.length,
  invariant: 'Unknown/unsupported evidence is never upgraded by this audit; it only verifies declared exact math and truth-preserving transforms.',
}, null, 2));
