import { LearningExperimentResult, LearningExperimentSpec, validateLearningExperiment } from './experiment';
import { TrainingPrescription } from './longitudinal';

export interface PreregisteredExperimentTarget {
  schemaVersion: 1;
  id: string;
  version: string;
  experimentId: string;
  experimentVersion: string;
  targetDecisionFamilyId: string;
  registeredAt: number;
  reference: string;
  hypothesis: string;
}

export interface CausalPrescriptionEvidence {
  targetDecisionFamilyId: string;
  experimentKey: string;
  targetKey: string;
  metric: LearningExperimentResult['metric'];
  bestArmId: string;
  recommendedIntervention: string;
  absoluteDifference?: number;
  claim: string;
}

export interface CausallyAnnotatedPrescription extends TrainingPrescription {
  randomizedEvidence?: CausalPrescriptionEvidence;
}

export function validateExperimentTarget(raw:PreregisteredExperimentTarget,spec:LearningExperimentSpec):PreregisteredExperimentTarget{
 const experiment=validateLearningExperiment(spec);
 if(!raw||raw.schemaVersion!==1||!raw.id||!raw.version||!raw.experimentId||!raw.experimentVersion||!raw.targetDecisionFamilyId||!raw.reference||!raw.hypothesis||!Number.isFinite(raw.registeredAt))throw new Error('Experiment target requires identity, target family, registration time and provenance.');
 if(raw.experimentId!==experiment.id||raw.experimentVersion!==experiment.version)throw new Error('Experiment target does not reference the supplied experiment version.');
 if(raw.registeredAt>experiment.preRegisteredAt)throw new Error('Decision-family target must be registered no later than experiment preregistration.');
 return JSON.parse(JSON.stringify(raw)) as PreregisteredExperimentTarget;
}

/** Only a sufficient P10 randomized result plus a preregistered family target can guide intervention choice. */
export function buildCausalPrescriptionEvidence(
 spec:LearningExperimentSpec,
 result:LearningExperimentResult,
 rawTarget:PreregisteredExperimentTarget,
):CausalPrescriptionEvidence|undefined{
 const target=validateExperimentTarget(rawTarget,spec);if(result.status!=='randomized-n-of-1'||!result.bestArmId||result.metric!==spec.metric)return undefined;
 const arm=spec.arms.find(candidate=>candidate.id===result.bestArmId);if(!arm)return undefined;
 return{targetDecisionFamilyId:target.targetDecisionFamilyId,experimentKey:`${spec.id}@${spec.version}`,targetKey:`${target.id}@${target.version}`,metric:result.metric,bestArmId:arm.id,recommendedIntervention:arm.intervention,absoluteDifference:result.absoluteDifference,claim:`For ${target.targetDecisionFamilyId}, preregistered randomized N-of-1 evidence favored “${arm.label}” for ${result.metric}. This selects an intervention for this player; it does not alter solver truth or imply population-wide causality.`};
}

export function annotatePrescriptionsWithRandomizedEvidence(
 prescriptions:TrainingPrescription[],
 evidence:CausalPrescriptionEvidence[],
):CausallyAnnotatedPrescription[]{
 const byFamily=new Map<string,CausalPrescriptionEvidence>();
 evidence.forEach(item=>{const existing=byFamily.get(item.targetDecisionFamilyId);if(!existing)byFamily.set(item.targetDecisionFamilyId,item);});
 return prescriptions.map(prescription=>({...prescription,randomizedEvidence:byFamily.get(prescription.decisionFamilyId)}));
}
