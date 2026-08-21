import { ExploitHoldoutEvidence, ExploitValidationResult, evaluatePairedUtilityHoldout, validateExploitHoldoutEvidence } from './exploitValidation';
import { PopulationDeviationResult } from './populationInference';
import { populationContextKey } from '../strategy-engine-v2/population';
import { ActionFrequency, HandActionEv, StrategyAction, StrategyProfile } from '../strategy-engine-v2/types';
import { validateStrategyProfile } from '../strategy-engine-v2/importer';

const ACTIONS:StrategyAction[]=['raise','call','limp','fold','allIn'];
export interface PopulationResponseModel {
  schemaVersion:1;
  id:string;
  version:string;
  strategyContextKey:string;
  population:string;
  sampleSize:number;
  reference:string;
  generatedAt:string;
  methodology:string;
  actionUtilityByHand:Record<string,HandActionEv>;
}
export interface ExploitSearchConstraints { maxFrequencyShiftPerHand?:number;minimumModeledAdvantageBB?:number;allowedActions?:StrategyAction[]; }
export interface ExploitCandidateProposal {
  schemaVersion:1;
  id:string;
  version:string;
  baselineProfileKey:string;
  populationDeviationId:string;
  strategyContextKey:string;
  responseModelKey:string;
  responseModelReference:string;
  population:string;
  modelSampleSize:number;
  generatedAt:string;
  candidateProfile:StrategyProfile;
  changedHands:number;
  modeledGainBB:number;
  claim:string;
}
export interface DiscoveredExploitValidation { result:ExploitValidationResult;promotedProfile?:StrategyProfile; }

function validateResponseModel(raw:PopulationResponseModel):PopulationResponseModel{
 if(!raw||raw.schemaVersion!==1||!raw.id||!raw.version||!raw.strategyContextKey||!raw.population||!raw.reference||!raw.methodology||!Number.isFinite(Date.parse(raw.generatedAt))||!Number.isFinite(raw.sampleSize)||raw.sampleSize<1000||!raw.actionUtilityByHand||!Object.keys(raw.actionUtilityByHand).length)throw new Error('Population response model requires identity, context, provenance, >=1000 observations and modeled action utility.');
 for(const[hand,ev]of Object.entries(raw.actionUtilityByHand)){if(!hand||!ev||Object.values(ev).some(value=>value!==undefined&&!Number.isFinite(value)))throw new Error(`${raw.id}: invalid modeled action utility for ${hand}.`);}
 return JSON.parse(JSON.stringify(raw)) as PopulationResponseModel;
}
function complete(freq:StrategyProfile['ranges'][string]):ActionFrequency{const out:ActionFrequency={raise:0,call:0,limp:0,fold:0,allIn:0};for(const action of ACTIONS){const value=freq?.[action];if(typeof value==='number'&&Number.isFinite(value)&&value>=0)out[action]=value;}let total=ACTIONS.reduce((sum,action)=>sum+out[action],0);if(total<1)out.fold+=1-total;else if(total>1){for(const action of ACTIONS)out[action]/=total;}return out;}
function expectedUtility(freq:ActionFrequency,ev:HandActionEv):number|undefined{let total=0;for(const action of ACTIONS){if(freq[action]<=1e-9)continue;const value=ev[action];if(typeof value!=='number'||!Number.isFinite(value))return undefined;total+=freq[action]*value;}return total;}

/**
 * P27 searches only inside an explicit bounded frequency neighborhood of a verified baseline.
 * The output remains derived-interpolation; it is not population-exploit until an independent paired holdout passes.
 */
export function discoverExploitCandidate(baselineRaw:StrategyProfile,rawModel:PopulationResponseModel,deviation:PopulationDeviationResult,constraints:ExploitSearchConstraints={}):ExploitCandidateProposal{
 const baseline=validateStrategyProfile(baselineRaw).profile,model=validateResponseModel(rawModel);if(baseline.source.trustTier!=='verified-solver')throw new Error('Exploit discovery requires a verified-solver baseline.');
 const contextKey=populationContextKey(baseline.context);if(model.strategyContextKey!==contextKey||deviation.strategyContextKey!==contextKey)throw new Error('Baseline, response model and population deviation contexts must match exactly.');if(deviation.status!=='validated-deviation')throw new Error('Exploit discovery requires a P16 validated population deviation.');
 const maxShift=constraints.maxFrequencyShiftPerHand??0.2,minAdvantage=constraints.minimumModeledAdvantageBB??0.01,allowed=new Set(constraints.allowedActions||ACTIONS);if(!Number.isFinite(maxShift)||maxShift<=0||maxShift>0.5)throw new Error('maxFrequencyShiftPerHand must be in (0, 0.5].');if(!Number.isFinite(minAdvantage)||minAdvantage<0)throw new Error('minimumModeledAdvantageBB must be non-negative.');
 const ranges:StrategyProfile['ranges']={},evByHand:Record<string,HandActionEv>={};let changedHands=0,modeledGainBB=0;
 for(const[hand,rawFreq]of Object.entries(baseline.ranges)){const freq=complete(rawFreq),ev=model.actionUtilityByHand[hand];ranges[hand]={...freq};if(!ev)continue;const baselineEv=expectedUtility(freq,ev);if(baselineEv===undefined)continue;const ranked=ACTIONS.filter(action=>allowed.has(action)&&typeof ev[action]==='number'&&Number.isFinite(ev[action])).sort((a,b)=>(ev[b]??-Infinity)-(ev[a]??-Infinity));if(!ranked.length)continue;const best=ranked[0],bestEv=ev[best]!;const advantage=bestEv-baselineEv;if(advantage<minAdvantage||freq[best]>=1-1e-9)continue;const movable=Math.min(maxShift,1-freq[best]),otherMass=1-freq[best];if(movable<=0||otherMass<=0)continue;const next={...freq};next[best]+=movable;for(const action of ACTIONS){if(action===best)continue;next[action]=Math.max(0,freq[action]*(1-movable/otherMass));}ranges[hand]=next;evByHand[hand]={...ev};changedHands++;modeledGainBB+=movable*advantage;}
 const candidateProfile=validateStrategyProfile({schemaVersion:2,id:`discovered:${model.id}:${baseline.id}`,version:`${model.version}-${baseline.version}`,name:`Candidate exploit · ${baseline.name}`,description:`Bounded P27 candidate derived from ${model.id}@${model.version}; requires independent holdout before use as population exploit.`,context:baseline.context,source:{type:'derived',trustTier:'derived-interpolation',label:'P27 constrained candidate search',reference:model.reference,generatedAt:new Date().toISOString(),sampleSize:model.sampleSize,disclaimer:`Candidate only. Derived from explicit population response model ${model.id}@${model.version}; max per-hand frequency shift ${maxShift}. Not validated exploit truth.`},ranges,evByHand,tags:[...baseline.tags,'p27-candidate','requires-independent-holdout'],mode:'exploit',immutable:true}).profile;
 return{schemaVersion:1,id:`candidate:${model.id}:${baseline.id}`,version:`${model.version}-${baseline.version}`,baselineProfileKey:`${baseline.id}@${baseline.version}`,populationDeviationId:deviation.id,strategyContextKey:contextKey,responseModelKey:`${model.id}@${model.version}`,responseModelReference:model.reference,population:model.population,modelSampleSize:model.sampleSize,generatedAt:new Date().toISOString(),candidateProfile,changedHands,modeledGainBB,claim:'This is a bounded model-derived exploit candidate, not validated exploit truth. Independent paired holdout evidence is required before promotion.'};
}

/** P27->P21 bridge: successful independent paired holdout promotes only this exact proposal/context. */
export function validateDiscoveredExploitCandidate(proposal:ExploitCandidateProposal,rawEvidence:ExploitHoldoutEvidence,deviation:PopulationDeviationResult):DiscoveredExploitValidation{
 const evidence=validateExploitHoldoutEvidence(rawEvidence),profile=proposal.candidateProfile,key=`${profile.id}@${profile.version}`,practical=evidence.minimumPracticalImprovementBB??0.01,reasons:string[]=[];
 if(evidence.candidateProfileKey!==key)throw new Error('Holdout evidence does not reference this discovered candidate profile.');if(evidence.populationDeviationId!==proposal.populationDeviationId||deviation.id!==proposal.populationDeviationId)throw new Error('Discovered candidate, holdout evidence and deviation ids must match.');if(evidence.strategyContextKey!==proposal.strategyContextKey||deviation.strategyContextKey!==proposal.strategyContextKey)throw new Error('Discovered candidate, holdout evidence and deviation contexts must match.');
 if(deviation.status!=='validated-deviation')reasons.push('Population deviation is no longer validated.');if(evidence.reference===proposal.responseModelReference)reasons.push('Independent holdout evidence must use a reference distinct from the response-model training source.');
 const summary=evaluatePairedUtilityHoldout(evidence.pairedUtilityDeltaBB,practical);reasons.push(...summary.reasons);const evidenceKey=`${evidence.id}@${evidence.version}`;
 if(reasons.length||summary.status!=='validated-exploit')return{result:{evidenceKey,candidateProfileKey:key,status:summary.status==='insufficient'||reasons.some(reason=>reason.includes('Population deviation'))?'insufficient':'not-beneficial',samples:summary.samples,meanImprovementBB:summary.meanImprovementBB,ci95Low:summary.ci95Low,ci95High:summary.ci95High,minimumPracticalImprovementBB:practical,reasons,claim:'Discovered candidate did not clear independent promotion gates; it remains a derived proposal.'}};
 const promoted=validateStrategyProfile({...profile,id:`population:${proposal.id}`,version:`${proposal.version}-${evidence.version}`,source:{type:'population',trustTier:'population-exploit',label:'P27 discovered + independently validated exploit',reference:`${proposal.responseModelReference}; holdout:${evidence.reference}`,generatedAt:evidence.generatedAt,authoredBy:proposal.population,sampleSize:proposal.modelSampleSize,disclaimer:`Population exploit promoted only after P16 deviation replication plus independent P21/P27 paired holdout (${summary.samples} observations). Response model: ${proposal.responseModelKey}. Holdout: ${evidenceKey}.`},tags:[...profile.tags,'validated-exploit',`holdout:${evidenceKey}`],immutable:true}).profile;
 return{result:{evidenceKey,candidateProfileKey:key,status:'validated-exploit',samples:summary.samples,meanImprovementBB:summary.meanImprovementBB,ci95Low:summary.ci95Low,ci95High:summary.ci95High,minimumPracticalImprovementBB:practical,reasons:[],claim:`This bounded discovered candidate passed independent paired holdout by ${summary.meanImprovementBB!.toFixed(3)} BB/opportunity on average. Promotion is limited to ${proposal.population} and the exact declared strategy context.`},promotedProfile:promoted};
}
