import assert from 'node:assert/strict';
import test from 'node:test';
import type { Scenario } from '../src/types';
import { tournamentTrainingScenarios, tournamentEvaluationScenarios } from '../src/teaching/tournamentMathScenarios';

test('MTT practice and held-out exercises are disjoint and retain tournament utility units', async () => {
  const training = tournamentTrainingScenarios, evaluation = tournamentEvaluationScenarios;
  assert.equal(training.length, 12);
  assert.equal(evaluation.length, 8);
  const ids = new Set(training.map((scenario: Scenario) => scenario.id));
  const families = new Set(training.map((scenario: Scenario) => scenario.decisionFamilyId));
  for (const scenario of evaluation) {
    assert.ok(!ids.has(scenario.id));
    assert.ok(!families.has(scenario.decisionFamilyId));
    assert.equal(scenario.benchmarkRole, 'holdout');
  }
  const models = new Set<string>();
  for (const scenario of [...training, ...evaluation]) {
    assert.equal(scenario.type, 'Tournament');
    assert.ok(scenario.tableSize);
    for (const step of scenario.steps) for (const feedback of Object.values(step.feedbacks)) {
      assert.equal(feedback?.evidence?.sourceConfidence, 'exact-math');
      assert.ok(Number.isFinite(feedback?.evidence?.actionUtility));
      assert.ok(Number.isFinite(feedback?.evidence?.utilityLoss));
      assert.equal(feedback?.evidence?.evLossBB, undefined);
      assert.equal(feedback?.evidence?.actionEvBB, undefined);
      assert.equal(feedback?.evidence?.bestEvBB, undefined);
      if (feedback?.evidence?.utilityModel) models.add(feedback.evidence.utilityModel);
      if (feedback?.evidence?.utilityModel !== 'tournament-chip-ev') assert.notEqual(feedback?.evidence?.utilityUnit, 'bb');
    }
  }
  assert.deepEqual([...models].sort(), ['icm', 'pko', 'satellite', 'tournament-chip-ev']);
});

test('MTT exercises use independently checked chip, ICM, seat and bounty arithmetic', async () => {
  const training = tournamentTrainingScenarios;
  const cases = [
    { id: 'mtt-train-chip-1', action: 'Call', call: 22, fold: 20, unit: 'bb' },
    { id: 'mtt-train-icm-1', action: 'Call', call: 51, fold: 50, unit: 'dollar-ev' },
    { id: 'mtt-train-satellite-1', action: 'Fold', call: .6, fold: 431 / 462, unit: 'seat-equity' },
    { id: 'mtt-train-pko-1', action: 'Call', call: 50.8, fold: 50, unit: 'dollar-ev' },
  ];
  for (const item of cases) {
    const scenario = training.find((candidate: Scenario) => candidate.id === item.id)!;
    assert.ok(scenario, item.id);
    const step = scenario.steps[0];
    assert.equal(step.feedbacks.Call?.bestAction, item.action);
    assert.ok(Math.abs(step.feedbacks.Call!.evidence!.actionUtility! - item.call) < 1e-9, item.id);
    assert.ok(Math.abs(step.feedbacks.Fold!.evidence!.actionUtility! - item.fold) < 1e-9, item.id);
    assert.equal(step.feedbacks.Call?.evidence?.utilityUnit, item.unit);
    assert.equal(step.feedbacks[item.action as 'Call' | 'Fold']?.evidence?.utilityLoss, 0);
  }
});
