import { CausalPrescriptionEvidence, CausallyAnnotatedPrescription } from './causalPrescription';
import { TrainingPrescription } from './longitudinal';

export interface InterventionEffectCell {
  decisionFamilyId:string;
  metric:CausalPrescriptionEvidence['metric'];
  intervention:string;
  experiments:number;
  meanAbsoluteDifference:number;
  confidence:number;
  score:number;
  experimentKeys:string[];
}
export interface PersonalInterventionRecommendation {
  decisionFamilyId:string;
  metric:CausalPrescriptionEvidence['metric'];
  intervention:string;
  experiments:number;
  meanAbsoluteDifference:number;
  confidence:number;
  claim:string;
}
export interface PersonalInterventionModel { generatedAt:string;cells:InterventionEffectCell[];recommendations:PersonalInterventionRecommendation[];caveats:string[]; }
export interface PersonallyOptimizedPrescription extends CausallyAnnotatedPrescription { learnedIntervention?:PersonalInterventionRecommendation; }

/** Repeated preregistered randomized results are aggregated only within the same family + primary metric + intervention. */
export function buildPersonalInterventionModel(evidence:CausalPrescriptionEvidence[],minimumExperiments=2):PersonalInterventionModel{
 if(!Number.isInteger(minimumExperiments)||minimumExperiments<2)throw new Error('Personal intervention learning requires at least two independent experiments.');
 const seen=new Set<string>(),groups=new Map<string,CausalPrescriptionEvidence[]>();
 for(const item of evidence){if(!item.targetDecisionFamilyId||!item.experimentKey||!item.recommendedIntervention||!item.metric)throw new Error('Causal prescription evidence is missing identity or intervention.');if(typeof item.absoluteDifference!=='number'||!Number.isFinite(item.absoluteDifference)||item.absoluteDifference<0)continue;const dedupe=`${item.targetDecisionFamilyId}|${item.metric}|${item.experimentKey}`;if(seen.has(dedupe))continue;seen.add(dedupe);const key=`${item.targetDecisionFamilyId}|${item.metric}|${item.recommendedIntervention}`;const list=groups.get(key)||[];list.push(item);groups.set(key,list);}
 const cells:InterventionEffectCell[]=[...groups.entries()].map(([key,items])=>{const[decisionFamilyId,metric,...rest]=key.split('|'),intervention=rest.join('|'),experiments=items.length,meanAbsoluteDifference=items.reduce((sum,item)=>sum+(item.absoluteDifference||0),0)/experiments,confidence=experiments/(experiments+2);return{decisionFamilyId,metric:metric as CausalPrescriptionEvidence['metric'],intervention,experiments,meanAbsoluteDifference,confidence,score:meanAbsoluteDifference*confidence,experimentKeys:items.map(item=>item.experimentKey).sort()};}).sort((a,b)=>a.decisionFamilyId.localeCompare(b.decisionFamilyId)||String(a.metric).localeCompare(String(b.metric))||b.score-a.score);
 const byFamilyMetric=new Map<string,InterventionEffectCell[]>();for(const cell of cells){const key=`${cell.decisionFamilyId}|${cell.metric}`,list=byFamilyMetric.get(key)||[];list.push(cell);byFamilyMetric.set(key,list);}
 const recommendations:PersonalInterventionRecommendation[]=[];for(const rows of byFamilyMetric.values()){const eligible=rows.filter(row=>row.experiments>=minimumExperiments).sort((a,b)=>b.score-a.score);if(!eligible.length)continue;const best=eligible[0];recommendations.push({decisionFamilyId:best.decisionFamilyId,metric:best.metric,intervention:best.intervention,experiments:best.experiments,meanAbsoluteDifference:best.meanAbsoluteDifference,confidence:best.confidence,claim:`Across ${best.experiments} preregistered randomized N-of-1 experiments for ${best.decisionFamilyId} using ${best.metric}, “${best.intervention}” has the strongest repeated personal effect signal (mean absolute arm difference ${best.meanAbsoluteDifference.toFixed(3)}). This is personal intervention evidence, not solver truth or a population claim.`});}
 return{generatedAt:new Date().toISOString(),cells,recommendations,caveats:['Effects are aggregated only across preregistered randomized N-of-1 evidence with the same decision family and primary metric.','Different metrics are never pooled into one numeric effect.','The model learns intervention choice only; it does not alter solver strategy, real-game regret, or population claims.']};
}

export function annotatePrescriptionsWithPersonalInterventionModel(prescriptions:TrainingPrescription[],model:PersonalInterventionModel):PersonallyOptimizedPrescription[]{
 const byFamily=new Map<string,PersonalInterventionRecommendation[]>();for(const recommendation of model.recommendations){const list=byFamily.get(recommendation.decisionFamilyId)||[];list.push(recommendation);byFamily.set(recommendation.decisionFamilyId,list);}
 return prescriptions.map(prescription=>{const matches=byFamily.get(prescription.decisionFamilyId)||[];return{...prescription,learnedIntervention:matches.length===1?matches[0]:undefined};});
}
