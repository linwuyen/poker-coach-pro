import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPersonalInterventionModel, annotatePrescriptionsWithPersonalInterventionModel } from '../src/learning-engine/personalInterventionModel';
import { CausalPrescriptionEvidence } from '../src/learning-engine/causalPrescription';

function evidence(experimentKey:string,intervention:string,diff:number,metric:CausalPrescriptionEvidence['metric']='holdout-accuracy'):CausalPrescriptionEvidence{return{targetDecisionFamilyId:'river.bluff-catch',experimentKey,targetKey:`target:${experimentKey}`,metric,bestArmId:'a',recommendedIntervention:intervention,absoluteDifference:diff,claim:'fixture'};}

test('P28 learns an intervention only from repeated independent randomized experiments within one family and metric',()=>{
 const model=buildPersonalInterventionModel([evidence('exp1@1','contrastive',.12),evidence('exp2@1','contrastive',.10),evidence('exp3@1','delayed-recall',.08),evidence('exp4@1','delayed-recall',.05)]);
 assert.equal(model.recommendations.length,1);assert.equal(model.recommendations[0].intervention,'contrastive');assert.equal(model.recommendations[0].experiments,2);
 const annotated=annotatePrescriptionsWithPersonalInterventionModel([{decisionFamilyId:'river.bluff-catch',observations:12,averageEvLossBB:.2,recentTrainingAttempts:5,priority:2,reason:'fixture'}],model);assert.equal(annotated[0].learnedIntervention?.intervention,'contrastive');assert.equal(annotated[0].priority,2);
});

test('P28 does not learn from a one-off experiment or pool incomparable primary metrics',()=>{
 const one=buildPersonalInterventionModel([evidence('exp1@1','contrastive',.2)]);assert.equal(one.recommendations.length,0);
 const mixed=buildPersonalInterventionModel([evidence('exp1@1','contrastive',.2,'holdout-accuracy'),evidence('exp2@1','contrastive',.2,'delayed-retention')]);assert.equal(mixed.recommendations.length,0);
});

test('P28 deduplicates the same experiment key so repeated ingestion cannot inflate confidence',()=>{
 const duplicate=evidence('exp1@1','contrastive',.2);const model=buildPersonalInterventionModel([duplicate,duplicate,evidence('exp2@1','contrastive',.1)]);assert.equal(model.recommendations[0].experiments,2);assert.deepEqual(model.cells[0].experimentKeys,['exp1@1','exp2@1']);
});
