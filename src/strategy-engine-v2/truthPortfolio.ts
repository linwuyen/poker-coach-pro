import { PostflopTruthStore, postflopContextKey } from '../strategy-engine-v3';
import { MultiwayTruthStore, multiwayContextKey } from '../strategy-engine-v4';
import { buildTruthCoverageReport, strategyContextCoverageKey } from './coverage';
import { StrategyAction, StrategyProfile } from './types';

export type TruthEngineId = 'v2-preflop' | 'v3-heads-up' | 'v4-multiway';
export interface TruthCoverageTarget {
  id:string;
  engine:TruthEngineId;
  label:string;
  contextKey:string;
  weight:number;
  minimumUniqueCombos:number;
  minimumFullEvCombos:number;
}
export interface TruthCoverageTargetEnvelope { schemaVersion:1;id:string;version:string;generatedAt:string;reference:string;targets:TruthCoverageTarget[]; }
export interface TruthCoverageCell {
  engine:TruthEngineId;
  contextKey:string;
  nodes:number;
  uniqueCombos:number;
  fullEvCombos:number;
  ambiguousCombos:number;
  sourceReferences:string[];
}
export interface TruthCoverageTargetResult extends TruthCoverageTarget { satisfied:boolean; cell?:TruthCoverageCell; }
export interface UnifiedTruthCoverageReport {
  generatedAt:string;
  cells:TruthCoverageCell[];
  totals:{ verifiedNodes:number;uniqueContexts:number;uniqueCombos:number;fullEvCombos:number;ambiguousCombos:number;storedBytes:number;packManifests:number };
  byEngine:Record<TruthEngineId,{nodes:number;contexts:number;uniqueCombos:number;fullEvCombos:number;ambiguousCombos:number}>;
  targetResults:TruthCoverageTargetResult[];
  weightedTargetCoverage?:number;
  caveats:string[];
}

const ACTIONS:StrategyAction[]=['raise','call','limp','fold','allIn'];
interface MutableCell {engine:TruthEngineId;contextKey:string;nodes:number;sources:Set<string>;owners:Map<string,number>;fullEvOwners:Map<string,number>;}
function ensure(map:Map<string,MutableCell>,engine:TruthEngineId,contextKey:string){const key=`${engine}|${contextKey}`;let cell=map.get(key);if(!cell){cell={engine,contextKey,nodes:0,sources:new Set(),owners:new Map(),fullEvOwners:new Map()};map.set(key,cell);}return cell;}
function mark(cell:MutableCell,combo:string,fullEv:boolean){cell.owners.set(combo,(cell.owners.get(combo)||0)+1);if(fullEv)cell.fullEvOwners.set(combo,(cell.fullEvOwners.get(combo)||0)+1);}
function finalize(cell:MutableCell):TruthCoverageCell{let uniqueCombos=0,fullEvCombos=0,ambiguousCombos=0;for(const[combo,owners]of cell.owners){if(owners===1){uniqueCombos++;if(cell.fullEvOwners.get(combo)===1)fullEvCombos++;}else ambiguousCombos++;}return{engine:cell.engine,contextKey:cell.contextKey,nodes:cell.nodes,uniqueCombos,fullEvCombos,ambiguousCombos,sourceReferences:[...cell.sources].sort()};}

export function validateTruthCoverageTargets(raw:TruthCoverageTargetEnvelope):TruthCoverageTargetEnvelope{
 if(!raw||raw.schemaVersion!==1||!raw.id||!raw.version||!raw.reference||!Number.isFinite(Date.parse(raw.generatedAt))||!Array.isArray(raw.targets))throw new Error('Invalid truth coverage target envelope.');
 const ids=new Set<string>();raw.targets.forEach(target=>{if(!target.id||ids.has(target.id)||!['v2-preflop','v3-heads-up','v4-multiway'].includes(target.engine)||!target.label||!target.contextKey||!Number.isFinite(target.weight)||target.weight<=0||!Number.isInteger(target.minimumUniqueCombos)||target.minimumUniqueCombos<1||!Number.isInteger(target.minimumFullEvCombos)||target.minimumFullEvCombos<0)throw new Error(`Invalid truth coverage target ${target.id||'(missing id)'}.`);ids.add(target.id);});return JSON.parse(JSON.stringify(raw)) as TruthCoverageTargetEnvelope;
}

/** Coverage counts only unique verified truth that automatic grading could actually use. */
export async function buildUnifiedTruthCoverage(
 profiles:StrategyProfile[],v3:PostflopTruthStore,v4:MultiwayTruthStore,targetEnvelope?:TruthCoverageTargetEnvelope,
):Promise<UnifiedTruthCoverageReport>{
 const cells=new Map<string,MutableCell>();let verifiedNodes=0;
 for(const profile of profiles.filter(profile=>profile.source.trustTier==='verified-solver')){verifiedNodes++;const cell=ensure(cells,'v2-preflop',strategyContextCoverageKey(profile));cell.nodes++;if(profile.source.reference)cell.sources.add(profile.source.reference);for(const combo of Object.keys(profile.ranges||{})){const ev=profile.evByHand?.[combo]||{},full=ACTIONS.filter(action=>typeof ev[action]==='number'&&Number.isFinite(ev[action])).length>=2;mark(cell,combo,full);}}
 for await(const node of v3.iterateNodes()){if(node.source.trustTier!=='verified-solver')continue;verifiedNodes++;const cell=ensure(cells,'v3-heads-up',postflopContextKey(node.context));cell.nodes++;if(node.source.reference)cell.sources.add(node.source.reference);for(const combo of Object.keys(node.strategyByCombo||{})){const ev=node.evByCombo?.[combo]||{},full=Object.values(ev).filter(value=>typeof value==='number'&&Number.isFinite(value)).length>=2;mark(cell,combo,full);}}
 for await(const node of v4.iterateNodes()){if(node.source.trustTier!=='verified-solver')continue;verifiedNodes++;const cell=ensure(cells,'v4-multiway',multiwayContextKey(node.context));cell.nodes++;if(node.source.reference)cell.sources.add(node.source.reference);for(const combo of Object.keys(node.strategyByCombo||{})){const ev=node.evByCombo?.[combo]||{},full=Object.values(ev).filter(value=>typeof value==='number'&&Number.isFinite(value)).length>=2;mark(cell,combo,full);}}
 const finalized=[...cells.values()].map(finalize).sort((a,b)=>a.engine.localeCompare(b.engine)||a.contextKey.localeCompare(b.contextKey));const engines:TruthEngineId[]=['v2-preflop','v3-heads-up','v4-multiway'];
 const byEngine=Object.fromEntries(engines.map(engine=>{const rows=finalized.filter(row=>row.engine===engine);return[engine,{nodes:rows.reduce((sum,row)=>sum+row.nodes,0),contexts:rows.length,uniqueCombos:rows.reduce((sum,row)=>sum+row.uniqueCombos,0),fullEvCombos:rows.reduce((sum,row)=>sum+row.fullEvCombos,0),ambiguousCombos:rows.reduce((sum,row)=>sum+row.ambiguousCombos,0)}];})) as UnifiedTruthCoverageReport['byEngine'];
 const targets=targetEnvelope?validateTruthCoverageTargets(targetEnvelope).targets:[];const lookup=new Map(finalized.map(cell=>[`${cell.engine}|${cell.contextKey}`,cell]));const targetResults=targets.map(target=>{const cell=lookup.get(`${target.engine}|${target.contextKey}`);return{...target,cell,satisfied:Boolean(cell&&cell.uniqueCombos>=target.minimumUniqueCombos&&cell.fullEvCombos>=target.minimumFullEvCombos)};});const weight=targetResults.reduce((sum,row)=>sum+row.weight,0),weightedTargetCoverage=weight?targetResults.reduce((sum,row)=>sum+(row.satisfied?row.weight:0),0)/weight:undefined;
 const [v3d,v4d]=await Promise.all([v3.diagnostics(),v4.diagnostics()]);const v2=buildTruthCoverageReport(profiles);
 return{generatedAt:new Date().toISOString(),cells:finalized,totals:{verifiedNodes,uniqueContexts:finalized.length,uniqueCombos:finalized.reduce((sum,row)=>sum+row.uniqueCombos,0),fullEvCombos:finalized.reduce((sum,row)=>sum+row.fullEvCombos,0),ambiguousCombos:finalized.reduce((sum,row)=>sum+row.ambiguousCombos,0),storedBytes:v3d.approximateBytes+v4d.approximateBytes,packManifests:v3d.packs+v4d.packs},byEngine,targetResults,weightedTargetCoverage,caveats:[`Bundled v2 report currently sees ${v2.verifiedSolverProfiles} verified solver profile(s); coverage never implies ownership of missing solver data.`,'A combo covered by multiple exact truth nodes/versions is counted as ambiguous, not usable automatic-grading coverage.','Target coverage is reported only against an explicit versioned target envelope; no synthetic target universe is invented.']};
}
