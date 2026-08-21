import { StrategyProfile } from '../strategy-engine-v2/types';
import { isEvidenceBackedPopulationProfile, populationContextKey } from '../strategy-engine-v2/population';

export interface BinomialEvidence { numerator:number; denominator:number; }
export interface PopulationDeviationInput {
  id:string;
  metric:string;
  strategyContextKey:string;
  solverBaselineRate:number;
  solverReference:string;
  populationReference:string;
  methodology:string;
  training:BinomialEvidence;
  holdout:BinomialEvidence;
  minimumPracticalDelta?:number;
}
export interface WilsonInterval { rate:number; low:number; high:number; }
export interface PopulationDeviationResult {
  id:string;
  strategyContextKey:string;
  status:'insufficient'|'not-replicated'|'validated-deviation';
  direction?:'higher-than-solver'|'lower-than-solver';
  training:WilsonInterval;
  holdout:WilsonInterval;
  solverBaselineRate:number;
  trainingDelta:number;
  holdoutDelta:number;
  exploitEligible:boolean;
  linkedExploitProfileKey?:string;
  reasons:string[];
}

export const MIN_POPULATION_TRAINING_SAMPLE=1000;
export const MIN_POPULATION_HOLDOUT_SAMPLE=500;

function validBinomial(e:BinomialEvidence,label:string){if(!Number.isInteger(e.numerator)||!Number.isInteger(e.denominator)||e.denominator<=0||e.numerator<0||e.numerator>e.denominator)throw new Error(`${label} numerator/denominator are invalid.`);}
export function wilson95(e:BinomialEvidence):WilsonInterval{validBinomial(e,'binomial');const z=1.959963984540054,p=e.numerator/e.denominator,n=e.denominator,den=1+z*z/n,center=(p+z*z/(2*n))/den,half=z*Math.sqrt((p*(1-p)+z*z/(4*n))/n)/den;return{rate:p,low:Math.max(0,center-half),high:Math.min(1,center+half)};}
function excludes(interval:WilsonInterval,baseline:number,direction:'higher-than-solver'|'lower-than-solver'){return direction==='higher-than-solver'?interval.low>baseline:interval.high<baseline;}

/**
 * A population tendency becomes a validated deviation only when a predeclared metric replicates in
 * an independent holdout split. It does not synthesize an exploit strategy from the deviation.
 */
export function evaluatePopulationDeviation(input:PopulationDeviationInput,linkedExploitProfile?:StrategyProfile):PopulationDeviationResult{
 if(!input.id||!input.metric||!input.strategyContextKey||!input.solverReference||!input.populationReference||!input.methodology)throw new Error('Population deviation requires identity, context and provenance.');
 if(!Number.isFinite(input.solverBaselineRate)||input.solverBaselineRate<0||input.solverBaselineRate>1)throw new Error('solverBaselineRate must be in [0,1].');
 validBinomial(input.training,'training');validBinomial(input.holdout,'holdout');
 const training=wilson95(input.training),holdout=wilson95(input.holdout),trainingDelta=training.rate-input.solverBaselineRate,holdoutDelta=holdout.rate-input.solverBaselineRate,minDelta=input.minimumPracticalDelta??0.03,reasons:string[]=[];
 let status:PopulationDeviationResult['status']='validated-deviation';let direction:'higher-than-solver'|'lower-than-solver'|undefined;
 if(input.training.denominator<MIN_POPULATION_TRAINING_SAMPLE||input.holdout.denominator<MIN_POPULATION_HOLDOUT_SAMPLE){status='insufficient';reasons.push(`Requires >=${MIN_POPULATION_TRAINING_SAMPLE} training and >=${MIN_POPULATION_HOLDOUT_SAMPLE} holdout observations.`);}
 else if(Math.sign(trainingDelta)===0||Math.sign(trainingDelta)!==Math.sign(holdoutDelta)){status='not-replicated';reasons.push('Training and holdout deviations do not point in the same direction.');}
 else{direction=trainingDelta>0?'higher-than-solver':'lower-than-solver';if(Math.abs(trainingDelta)<minDelta||Math.abs(holdoutDelta)<minDelta||!excludes(training,input.solverBaselineRate,direction)||!excludes(holdout,input.solverBaselineRate,direction)){status='not-replicated';reasons.push('The deviation does not clear practical-delta and 95% interval gates in both splits.');}}
 let exploitEligible=false,linkedExploitProfileKey:string|undefined;
 if(status==='validated-deviation'&&linkedExploitProfile){const contextMatches=populationContextKey(linkedExploitProfile.context)===input.strategyContextKey;if(isEvidenceBackedPopulationProfile(linkedExploitProfile)&&contextMatches){exploitEligible=true;linkedExploitProfileKey=`${linkedExploitProfile.id}@${linkedExploitProfile.version}`;}else reasons.push('Linked exploit profile is missing population provenance/sample gate or does not match the strategy context.');}
 if(status==='validated-deviation'&&!linkedExploitProfile)reasons.push('Deviation is validated, but no evidence-backed exploit strategy profile is linked; no exploit action is synthesized.');
 return{id:input.id,strategyContextKey:input.strategyContextKey,status,direction:status==='validated-deviation'?direction:undefined,training,holdout,solverBaselineRate:input.solverBaselineRate,trainingDelta,holdoutDelta,exploitEligible,linkedExploitProfileKey,reasons};
}
