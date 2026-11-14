import assert from 'node:assert/strict';
import test from 'node:test';
import { scenarios } from '../src/teaching/scenarioCatalog';
import { DEFAULT_PLAYER_PROFILE } from '../src/domain/playerProfile';
import { isAssessmentScenario } from '../src/domain/trainingTrack';
import { getTrainingScenarios } from '../src/learning-engine/benchmark';
import { filterFreshEvaluationItems, isExamCandidateExposed, trackExamCandidates, uniqueExamFamilies } from '../src/features/training/ExamMode';
import { heldOutTurnAssessments } from '../src/teaching/heldOutTurnAssessments';

test('strict Cash table/depth profiles and every MTT Turn depth have held-out card-range assessments', () => {
  for (const track of ['cash', 'tournament'] as const) for (const table of ['6max', '9max'] as const)
    for (const band of ['10-20', '20-40', '40-100', '100+'] as const) {
      const profile = { ...DEFAULT_PLAYER_PROFILE, formats: [track], tableSizes: [table], stackBands: [band], focusAreas: ['postflop'] as const };
      const bank = trackExamCandidates(scenarios, [], track, { ...profile, focusAreas: [...profile.focusAreas] })
        .filter(c => c.kind === 'scenario' && c.scenario.id.startsWith('heldout-turn-'));
      assert.ok(bank.length >= 2, `${track}/${table}/${band} lacks two Turn range assessments`);
      assert.deepEqual(new Set(bank.flatMap(c => c.kind === 'scenario' ? [c.scenario.steps[0].feedbacks.Call?.bestAction] : [])), new Set(['Call','Fold']));
    }
});

test('exact card truth includes all legal rivers, ties and audited terminal call EV', () => {
  // 7h6h on QhJh2c3d versus AA: exactly the nine unseen hearts win.
  // Neither AA combo contains a heart; no straight can complete in one card.
  const pair = heldOutTurnAssessments.filter(s => s.id.startsWith('heldout-turn-cash-6max-18-'));
  assert.equal(pair.length, 2);
  for (const s of pair) {
    const step = s.steps[0];
    const ev = 9/44 * (step.potSize + 18) - 18;
    assert.ok(Math.abs(step.feedbacks.Call!.evidence!.actionEvBB! - ev) < 1e-10);
    assert.match(step.feedbacks.Call!.why, /88/);
  }
  for (const s of heldOutTurnAssessments) {
    const step = s.steps[0];
    assert.equal(step.potAccounting!.contributionsBB.reduce((a,b)=>a+b), step.potSize);
    assert.equal(step.potAccounting!.callCostBB,s.userBB);
    assert.doesNotMatch(step.description,/\d+(?:\.\d+)?%|門檻|Call EV|Fold EV/);
    for (const action of ['Fold','Call'] as const) {
      const feedback = step.feedbacks[action]!;
      assert.equal(feedback.score, action === feedback.bestAction ? 10 : 2);
      assert.ok(feedback.evidence!.utilityLoss! >= 0);
      assert.equal(feedback.evidence!.sourceConfidence,'exact-math');
      if(s.type === 'Tournament') assert.equal(feedback.evidence!.evLossBB,undefined);
    }
  }
});

test('table aliases do not create extra unseen evidence or bypass completion exposure guard', () => {
  const a = heldOutTurnAssessments[0];
  const alias = heldOutTurnAssessments.find(s=>s.id!==a.id&&s.decisionFamilyId===a.decisionFamilyId)!;
  assert.ok(alias);
  const candidates = [a,alias].map(s=>({kind:'scenario' as const,id:s.id,scenario:s,stepIndex:0}));
  assert.equal(uniqueExamFamilies(candidates).length,1);
  const history = {scenarioId:a.id,decisionFamilyId:a.decisionFamilyId,stepId:a.steps[0].id,category:[],score:10,judgment:'正確',timestamp:1};
  const pending = {...history,scenarioId:alias.id,attemptId:'new',isUnseen:true};
  assert.deepEqual(filterFreshEvaluationItems([history],[pending]),[]);
  assert.equal(isExamCandidateExposed(candidates[1],[history]),true);
});

test('held-out decisions stay out of practice and reject prior family exposure', () => {
  const bank = scenarios.filter(s => s.id.startsWith('heldout-turn-'));
  assert.ok(bank.length > 0);
  const practice = getTrainingScenarios(scenarios);
  for (const s of bank) {
    assert.equal(isAssessmentScenario(s), true);
    assert.equal(practice.some(p => p.decisionFamilyId === s.decisionFamilyId), false);
    assert.equal(s.steps[0].communityCards.length, 4);
    assert.doesNotMatch(s.title, /Call|Fold|跟注|棄牌|門檻|equity/i);
    const candidate = {kind:'scenario' as const, id:s.id, scenario:s, stepIndex:0};
    assert.equal(isExamCandidateExposed(candidate, [{scenarioId:'old-variant', decisionFamilyId:s.decisionFamilyId, category:[], score:10, judgment:'正確', timestamp:1}]), true);
  }
});

test('identical terminal Chip-EV math cannot become unseen by switching Cash to MTT or table size', () => {
  const cash = heldOutTurnAssessments.find(s=>s.id==='heldout-turn-cash-6max-18-a')!;
  const history = {scenarioId:cash.id,decisionFamilyId:cash.decisionFamilyId,stepId:cash.steps[0].id,category:[],score:10,judgment:'正確',timestamp:1};
  for(const table of ['6max','9max']) {
    const mtt = heldOutTurnAssessments.find(s=>s.id===`heldout-turn-tournament-${table}-18-a`)!;
    assert.equal(mtt.decisionFamilyId,cash.decisionFamilyId);
    const candidate={kind:'scenario' as const,id:mtt.id,scenario:mtt,stepIndex:0};
    assert.equal(isExamCandidateExposed(candidate,[history]),true);
    assert.deepEqual(filterFreshEvaluationItems([history],[{...history,scenarioId:mtt.id,decisionFamilyId:mtt.decisionFamilyId,attemptId:`mtt-${table}`,isUnseen:true}]),[]);
  }
  assert.equal(new Set(heldOutTurnAssessments.map(s=>s.decisionFamilyId)).size,8);
});
