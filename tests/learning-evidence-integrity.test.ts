import assert from 'node:assert/strict';
import test from 'node:test';
import * as learning from '../src/learning-engine';
import { transferBenchmarkReport } from '../src/learning-engine/transferBenchmark';
import { candidateLearningSignal } from '../src/learning-engine/closedLoop';
import { buildInfiniteCandidatePool } from '../src/learning-engine/infiniteHandGenerator';
import { scenarios } from '../src/data';
import type { HistoryItem } from '../src/types';
import { calculateSkillMastery } from '../src/learning-engine/skillGraph';
import { buildSituationCoverage } from '../src/learning-engine/coverageMatrix';
import { classifyHistoryError, learningOutcomeSummary } from '../src/learning-engine/errorModel';
import { effectivenessWindowMetrics } from '../src/learning-engine/effectiveness';

const now = 1_800_000_000_000;
const attempt = (values: Partial<HistoryItem> = {}): HistoryItem => ({ scenarioId: 'a', decisionFamilyId: 'a', stepId: '1', category: ['Pot Odds'], trainingType: 'scenario', score: 10, correct: true, judgment: '正確', timestamp: now - 1000, ...values });

test('successful latest review supersedes all expired attempts for that decision', () => {
  const history = [attempt({timestamp:now-3000,nextReviewAt:now-2000}),attempt({timestamp:now-2000,nextReviewAt:now-1000}),attempt({timestamp:now-1000,nextReviewAt:now+86400000})];
  assert.equal(typeof learning.currentDueReviews, 'function');
  assert.equal(learning.currentDueReviews(history,now).length,0);
  assert.equal(learning.currentDueReviews(history,now+86400001).length,1);
});

test('candidate due pressure uses only the current schedule', () => {
  const candidate = buildInfiniteCandidatePool(scenarios,[],[])[0];
  const history = [attempt({scenarioId:candidate.kind==='scenario'?candidate.scenario.id:'a',decisionFamilyId:candidate.familyId,timestamp:now-3000,nextReviewAt:now-2000}),attempt({scenarioId:candidate.kind==='scenario'?candidate.scenario.id:'a',decisionFamilyId:candidate.familyId,timestamp:now-1000,nextReviewAt:now+86400000})];
  assert.equal(candidateLearningSignal(candidate,history,now).duePressure,0);
});

test('legacy solver practice and repeated evaluations cannot count as structural transfer', () => {
  const practice=attempt({trainingType:'solver-corpus',isTransferTest:true,transferLevel:'structural',isUnseen:true});
  const repeat=attempt({scenarioId:'b',trainingType:'solver-benchmark',isTransferTest:true,transferLevel:'structural',isReview:true,isUnseen:false});
  const report=transferBenchmarkReport([practice,repeat]);
  assert.equal(report.structural.attempts,0);
  assert.equal(learning.getLearningMetrics([practice,repeat]).transferScore,0);
  assert.equal(calculateSkillMastery([practice,repeat]).reduce((sum,s)=>sum+s.transferAttempts,0),0);
});

test('transfer counts first exposure once and never substitutes ordinary category accuracy', () => {
  const first=attempt({scenarioId:'heldout',trainingType:'solver-benchmark',isTransferTest:true,transferLevel:'structural',isUnseen:true});
  const duplicate={...first,timestamp:now+1000};
  assert.equal(transferBenchmarkReport([first,duplicate]).structural.attempts,1);
  assert.equal(learning.getLearningMetrics([attempt(),attempt({scenarioId:'b',decisionFamilyId:'b'})]).transferSamples,0);
  assert.equal(learning.getLearningMetrics([attempt(),attempt({scenarioId:'b',decisionFamilyId:'b'})]).transferScore,0);
});

test('unverified authored alternatives do not claim an EV-sized major mistake', () => {
  assert.equal(learning.resolveFeedbackQuality({score:0,judgment:'錯誤',bestAction:'Call',why:'authored',remember:'',conceptualError:'',nextStepId:'next_hand'}),'label-mismatch');
  assert.equal(classifyHistoryError(attempt({correct:false,confidence:4,feedbackQuality:'label-mismatch'})),'label-mismatch');
  assert.equal(classifyHistoryError(attempt({correct:false,confidence:4,datasetRowId:'postflop-5',feedbackQuality:'major-error'})),'label-mismatch');
});

test('all dataset assessment types reject legacy future-card evidence', () => {
  for (const trainingType of ['solver-benchmark', 'contrastive', 'counterfactual'] as const) {
    const legacy=attempt({trainingType,datasetRowId:'postflop-5',isTransferTest:true,transferLevel:'structural',isUnseen:true});
    assert.equal(transferBenchmarkReport([legacy]).structural.attempts,0,trainingType);
    assert.equal(transferBenchmarkReport([{...legacy,decisionContextVersion:trainingType==='contrastive'?3:2}]).structural.attempts,1);
  }
});

test('all reports exclude legacy practice exposure and repeated dataset assessments', () => {
  const prior=attempt({trainingType:'solver-corpus',datasetRowId:'postflop-5',datasetSplit:'postflop_10k_test',truthSourceId:'pokerbench-aaai2025',timestamp:now-3000,situationIds:['street.flop']});
  const exam=attempt({trainingType:'solver-benchmark',datasetRowId:'postflop-5',datasetSplit:'postflop_10k_test',truthSourceId:'pokerbench-aaai2025',gameFormat:'Cash',decisionContextVersion:2,stepId:undefined,isTransferTest:true,transferLevel:'structural',isUnseen:true,situationIds:['street.flop']});
  const history=[prior,exam,{...exam,timestamp:now+1000}];
  assert.equal(transferBenchmarkReport(history).structural.attempts,0);
  assert.equal(learningOutcomeSummary(history).transferSamples,0);
  const coverage=buildSituationCoverage([],history).find(row=>row.situationId==='street.flop')!;
  assert.equal(coverage.transferAttempts,0);
  const window=effectivenessWindowMetrics(history,{id:'followup',label:'after exposure',start:now-2000,end:now+2000});
  assert.equal(window.transferAttempts,0);
  assert.equal(window.holdoutAttempts,0);
});
