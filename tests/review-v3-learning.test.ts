import assert from 'node:assert/strict';
import test from 'node:test';
import * as exams from '../src/features/training/ExamMode';
import { buildKnowledgeStates } from '../src/learning-engine/closedLoop';
import { DEFAULT_PLAYER_PROFILE } from '../src/domain/playerProfile';
import { scenarioMatchesTrainingTrack } from '../src/domain/trainingTrack';
import { buildTournamentEvaluationScenarios } from '../src/teaching/tournamentMathScenarios';
import type { HistoryItem, PlayerProfile } from '../src/types';

const restrictive: PlayerProfile = { ...DEFAULT_PLAYER_PROFILE, formats: ['tournament'], tableSizes: ['6max'], stackBands: ['40-100'], focusAreas: ['mixed'] };
const start = 91827849792;
const refill = () => {
  const fn = (exams as typeof exams & { buildFreshEvaluationCandidates?: (start: number, history: HistoryItem[], track: 'cash' | 'tournament', profile: PlayerProfile, size?: number, limit?: number) => ReturnType<typeof exams.trackExamCandidates> }).buildFreshEvaluationCandidates;
  assert.equal(typeof fn, 'function', 'the exam must refill after preference filtering');
  return fn!;
};

test('restrictive MTT exam refills an empty first block and balances all four eligible models', () => {
  assert.equal(exams.trackExamCandidates(buildTournamentEvaluationScenarios(start, 100), [], 'tournament', restrictive).length, 0);
  const result = refill()(start, [], 'tournament', restrictive);
  assert.equal(result.length, 25);
  assert.equal(new Set(result.map(item => item.id)).size, 25);
  const counts = new Map<string, number>();
  for (const item of result) {
    assert.equal(item.kind, 'scenario');
    if (item.kind !== 'scenario') continue;
    assert.ok(scenarioMatchesTrainingTrack(item.scenario, 'tournament', restrictive));
    const model = item.scenario.steps[item.stepIndex].feedbacks.Call!.evidence!.utilityModel!;
    counts.set(model, (counts.get(model) || 0) + 1);
  }
  assert.deepEqual([...counts.keys()].sort(), ['icm', 'pko', 'satellite', 'tournament-chip-ev']);
  assert.ok(Math.max(...counts.values()) - Math.min(...counts.values()) <= 1);
});

test('refill excludes prior exposure, fills shallow MTT preferences, and stops at the scan limit', () => {
  const fn = refill();
  const exposed: HistoryItem[] = fn(start, [], 'tournament', restrictive).flatMap(item => item.kind === 'scenario' ? [{ scenarioId: item.scenario.id, stepId: item.scenario.steps[item.stepIndex].id, category: [], score: 10, judgment: 'correct', timestamp: 1 }] : []);
  const fresh = fn(start, exposed, 'tournament', restrictive);
  assert.equal(fresh.length, 25);
  assert.ok(fresh.every(item => !exams.isExamCandidateExposed(item, exposed)));
  const shallow = fn(start, [], 'tournament', { ...restrictive, stackBands: ['10-20'] });
  assert.equal(shallow.length, 25);
  assert.equal(new Set(shallow.map(item => item.kind === 'scenario' && item.scenario.steps[item.stepIndex].feedbacks.Call!.evidence!.utilityModel)).size, 4);
  assert.deepEqual(fn(start, [], 'tournament', restrictive, 25, 100), []);
  assert.deepEqual(fn(start, [], 'tournament', { ...restrictive, focusAreas: ['preflop'] }, 25, 100), []);
});

test('knowledge priorities keep shared skills but exclude tournament-only nodes from Cash', () => {
  const scoped = buildKnowledgeStates as (history: HistoryItem[], track?: 'cash' | 'tournament') => ReturnType<typeof buildKnowledgeStates>;
  const cash = scoped([], 'cash');
  assert.ok(cash.length > 0);
  assert.equal(cash.some(item => item.skillId.startsWith('tournament.')), false);
  assert.ok(cash.some(item => item.skillId === 'math.pot-odds'));
  const history: HistoryItem[] = [{ scenarioId: 'mtt', gameFormat: 'MTT', skillIds: ['math.pot-odds', 'tournament.icm'], category: [], score: 0, judgment: 'wrong', timestamp: 1 }];
  assert.equal(scoped(history, 'cash').find(item => item.skillId === 'math.pot-odds')?.evidenceCount, 0);
  assert.equal(scoped(history, 'tournament').find(item => item.skillId === 'tournament.icm')?.evidenceCount, 1);
});
