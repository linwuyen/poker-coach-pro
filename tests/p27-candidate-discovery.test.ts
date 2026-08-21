import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverExploitCandidate, validateDiscoveredExploitCandidate } from '../src/learning-engine/candidateDiscovery';
import { evaluatePopulationDeviation } from '../src/learning-engine/populationInference';
import { isEvidenceBackedPopulationProfile, populationContextKey } from '../src/strategy-engine-v2/population';
import { StrategyProfile } from '../src/strategy-engine-v2/types';

const context={format:'cash' as const,tableSize:'6max' as const,spot:'bb-defense' as const,position:'bb' as const,villainPosition:'btn' as const,stackDepthBB:100,anteBB:0,openSizeBB:2.5};
const baseline:StrategyProfile={schemaVersion:2,id:'solver-base',version:'1',name:'Solver baseline',description:'fixture',context,source:{type:'solver',trustTier:'verified-solver',label:'fixture solver',reference:'fixture://solver',solverName:'FixtureSolver',solverVersion:'1',generatedAt:'2026-08-21T00:00:00Z',disclaimer:'Synthetic fixture.'},ranges:{AKo:{call:.5,fold:.5}},evByHand:{AKo:{call:0,fold:-.02,raise:.03}},tags:['test'],mode:'theory'};
const deviation=evaluatePopulationDeviation({id:'dev-27',metric:'overfold',strategyContextKey:populationContextKey(context),solverBaselineRate:.48,solverReference:'fixture://solver',populationReference:'fixture://pool-split',methodology:'Predeclared independent split.',training:{numerator:600,denominator:1000},holdout:{numerator:295,denominator:500}});
const model={schemaVersion:1 as const,id:'response-27',version:'1',strategyContextKey:populationContextKey(context),population:'NL50',sampleSize:5000,reference:'fixture://response-training',generatedAt:'2026-08-21T00:00:00Z',methodology:'Explicit action response utility model trained on population training data.',actionUtilityByHand:{AKo:{raise:.1,call:0,fold:-.02}}};

test('P27 discovers only a bounded derived proposal and does not label model search as population-exploit truth',()=>{
 const proposal=discoverExploitCandidate(baseline,model,deviation,{maxFrequencyShiftPerHand:.2,minimumModeledAdvantageBB:.01});
 assert.equal(proposal.changedHands,1);assert.ok(proposal.modeledGainBB>0);assert.equal(proposal.candidateProfile.source.trustTier,'derived-interpolation');assert.equal(proposal.candidateProfile.ranges.AKo.raise,.2);assert.equal(isEvidenceBackedPopulationProfile(proposal.candidateProfile),false);
});

test('P27 promotes the exact discovered proposal only after independent P21-style paired holdout clears statistical gates',()=>{
 const proposal=discoverExploitCandidate(baseline,model,deviation,{maxFrequencyShiftPerHand:.2});
 const evidence={schemaVersion:1 as const,id:'holdout-27',version:'1',populationDeviationId:'dev-27',strategyContextKey:populationContextKey(context),candidateProfileKey:`${proposal.candidateProfile.id}@${proposal.candidateProfile.version}`,pairedUtilityDeltaBB:Array.from({length:240},(_,i)=>.02+(i%4)*.001),reference:'fixture://independent-holdout',generatedAt:'2026-08-21T01:00:00Z',methodology:'Untouched paired candidate-minus-baseline holdout.',minimumPracticalImprovementBB:.01};
 const validated=validateDiscoveredExploitCandidate(proposal,evidence,deviation);assert.equal(validated.result.status,'validated-exploit');assert.ok(validated.promotedProfile);assert.equal(validated.promotedProfile?.source.trustTier,'population-exploit');assert.equal(isEvidenceBackedPopulationProfile(validated.promotedProfile!),true);
});

test('P27 refuses holdout that reuses the response-model training reference',()=>{
 const proposal=discoverExploitCandidate(baseline,model,deviation);const evidence={schemaVersion:1 as const,id:'leaky',version:'1',populationDeviationId:'dev-27',strategyContextKey:populationContextKey(context),candidateProfileKey:`${proposal.candidateProfile.id}@${proposal.candidateProfile.version}`,pairedUtilityDeltaBB:Array.from({length:240},()=>.03),reference:model.reference,generatedAt:'2026-08-21T01:00:00Z',methodology:'Not independent.'};const result=validateDiscoveredExploitCandidate(proposal,evidence,deviation);assert.notEqual(result.result.status,'validated-exploit');assert.equal(result.promotedProfile,undefined);
});
