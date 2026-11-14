import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PLAYER_PROFILE } from '../src/domain/playerProfile';
import { trackExamCandidates } from '../src/features/training/ExamMode';
import { buildExactMathEvaluationScenarios } from '../src/teaching/evaluationMathScenarios';
import { tournamentEvaluationScenarios, tournamentTrainingScenarios } from '../src/teaching/tournamentMathScenarios';
import { scenarios } from '../src/teaching/scenarioCatalog';
import { buildInfiniteCandidatePool } from '../src/learning-engine/infiniteHandGenerator';
import { scenarioMatchesTrainingTrack } from '../src/domain/trainingTrack';
import * as trackDomain from '../src/domain/trainingTrack';
import { buildSituationCoverage } from '../src/learning-engine/coverageMatrix';
import type { PlayerProfile, Scenario } from '../src/types';

test('real evaluation banks give each track only its own format and no authored answer keys', () => {
  const bank = [...scenarios, ...buildExactMathEvaluationScenarios(0, 5), ...tournamentEvaluationScenarios];
  const cash = trackExamCandidates(bank, [], 'cash', DEFAULT_PLAYER_PROFILE);
  const tournament = trackExamCandidates(bank, [], 'tournament', DEFAULT_PLAYER_PROFILE);
  assert.ok(cash.length >= 5);
  assert.ok(tournament.length >= tournamentEvaluationScenarios.length);
  for (const item of cash) {
    assert.equal(item.kind, 'scenario');
    if (item.kind === 'scenario') assert.equal(item.scenario.type, 'Cash Game');
  }
  for (const item of tournament) {
    assert.equal(item.kind, 'scenario');
    if (item.kind === 'scenario') assert.equal(item.scenario.type, 'Tournament');
  }
});

test('unavailable cash exam preferences produce an empty pool rather than MTT substitutions', () => {
  const bank = [...buildExactMathEvaluationScenarios(0, 5), ...tournamentEvaluationScenarios];
  assert.deepEqual(trackExamCandidates(bank, [], 'cash', { ...DEFAULT_PLAYER_PROFILE, tableSizes: ['9max'] }), []);
});

test('actual tournament practice survives truth gating without admitting evaluation exercises', () => {
  const pool = buildInfiniteCandidatePool([...scenarios, ...tournamentTrainingScenarios, ...tournamentEvaluationScenarios], [], []);
  const mtt = pool.filter(item => item.kind === 'scenario' && scenarioMatchesTrainingTrack(item.scenario, 'tournament', DEFAULT_PLAYER_PROFILE));
  assert.ok(mtt.length >= tournamentTrainingScenarios.length);
  assert.equal(mtt.some(item => item.kind === 'scenario' && tournamentEvaluationScenarios.some(evaluation => evaluation.id === item.scenario.id)), false);
});

test('coverage catalog follows selected track and includes eight MTT utility and sixteen Turn assessments', () => {
  const getCatalog = (trackDomain as unknown as { trainingTrackCoverageCatalog?: (bank: Scenario[], assessment: Scenario[], track: 'cash' | 'tournament', profile: PlayerProfile) => Scenario[] }).trainingTrackCoverageCatalog;
  assert.equal(typeof getCatalog, 'function');
  const assessments = [...buildExactMathEvaluationScenarios(0, 5), ...tournamentEvaluationScenarios];
  const tournament = getCatalog!(scenarios, assessments, 'tournament', DEFAULT_PLAYER_PROFILE);
  const cash = getCatalog!(scenarios, assessments, 'cash', DEFAULT_PLAYER_PROFILE);
  assert.ok(tournament.every(scenario => scenario.type === 'Tournament'));
  assert.ok(cash.every(scenario => scenario.type === 'Cash Game'));
  const mttCoverage = buildSituationCoverage(tournament, []);
  assert.equal(mttCoverage.find(row => row.situationId === 'format.mtt')?.holdoutScenarios, 24);
  assert.equal(mttCoverage.some(row => row.situationId === 'format.cash'), false);
  assert.deepEqual(getCatalog!(scenarios, assessments, 'cash', { ...DEFAULT_PLAYER_PROFILE, tableSizes: [], stackBands: ['10-20'] }), []);
});
