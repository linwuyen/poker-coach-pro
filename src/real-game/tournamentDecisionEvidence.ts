import { WeightedRangeHand, calculateEquity, parseCardToken } from '../poker/equityEngine';
import { FgsActionTree, FgsNode } from '../tournament/icm';
import { TournamentHandContext } from './tournamentContext';

export interface TournamentRangeEvidence {
  schemaVersion:1;
  id:string;
  version:string;
  handId:string;
  heroCards:string[];
  board:string[];
  villainRange:WeightedRangeHand[];
  reference:string;
  generatedAt:string;
  methodology:string;
  exactStateLimit?:number;
  iterations?:number;
  seed?:number;
}
export interface TournamentRangeEvaluation {
  evidenceKey:string;
  handId:string;
  status:'exact-eligible'|'simulation-only';
  equity:number;
  equityFraction:number;
  method:'exact'|'monte-carlo';
  samples:number;
  villainCombos:number;
  estimatedStates:number;
  reference:string;
}

export interface FgsProbabilityEdgeEvidence { parentId:string;childId:string;probability:number; }
export interface FgsProbabilityEvidence {
  schemaVersion:1;
  id:string;
  version:string;
  handId:string;
  reference:string;
  generatedAt:string;
  methodology:string;
  edges:FgsProbabilityEdgeEvidence[];
}
export interface AppliedFgsProbabilityEvidence { actionTrees:FgsActionTree[];evidenceKey:string;reference:string;methodology:string; }

function validTimestamp(value:string){return Boolean(value)&&Number.isFinite(Date.parse(value));}
function uniqueCards(cards:string[],label:string){const normalized=cards.map(card=>{parseCardToken(card);return card[0].toUpperCase()+card[1].toLowerCase();});if(new Set(normalized).size!==normalized.length)throw new Error(`${label} contains duplicate cards.`);return normalized;}

export function validateTournamentRangeEvidence(input:TournamentRangeEvidence):TournamentRangeEvidence{
 if(!input||input.schemaVersion!==1||!input.id||!input.version||!input.handId||!input.reference||!input.methodology||!validTimestamp(input.generatedAt))throw new Error('Tournament range evidence requires identity, handId and provenance.');
 if(!Array.isArray(input.heroCards)||input.heroCards.length!==2)throw new Error(`${input.id}: exactly two Hero cards are required.`);if(!Array.isArray(input.board)||input.board.length>5)throw new Error(`${input.id}: board must contain 0-5 cards.`);
 const hero=uniqueCards(input.heroCards,'Hero cards'),board=uniqueCards(input.board,'Board');if(new Set([...hero,...board]).size!==hero.length+board.length)throw new Error(`${input.id}: Hero/board cards overlap.`);
 if(!Array.isArray(input.villainRange)||!input.villainRange.length||input.villainRange.some(row=>!row.hand||row.weight!==undefined&&(!Number.isFinite(row.weight)||row.weight<0||row.weight>1)))throw new Error(`${input.id}: villainRange requires valid weighted rows.`);
 if(input.exactStateLimit!==undefined&&(!Number.isFinite(input.exactStateLimit)||input.exactStateLimit<1))throw new Error(`${input.id}: exactStateLimit must be positive.`);if(input.iterations!==undefined&&(!Number.isFinite(input.iterations)||input.iterations<1000))throw new Error(`${input.id}: iterations must be >=1000.`);
 return JSON.parse(JSON.stringify(input)) as TournamentRangeEvidence;
}

/** Seeded simulation is reproducible but only exact enumeration can upgrade an ICM/PKO draft to exact-math utility. */
export function evaluateTournamentRangeEvidence(raw:TournamentRangeEvidence):TournamentRangeEvaluation{
 const input=validateTournamentRangeEvidence(raw);const result=calculateEquity({hero:input.heroCards.map(parseCardToken),board:input.board.map(parseCardToken),villainRange:input.villainRange,exactStateLimit:input.exactStateLimit,iterations:input.iterations,seed:input.seed});return{evidenceKey:`${input.id}@${input.version}`,handId:input.handId,status:result.method==='exact'?'exact-eligible':'simulation-only',equity:result.equity,equityFraction:result.equity/100,method:result.method,samples:result.samples,villainCombos:result.villainCombos,estimatedStates:result.estimatedStates,reference:input.reference};
}

export function attachExactTournamentRangeEquity(
 draft:Omit<TournamentHandContext,'showdownEquity'> & {showdownEquity?:number},
 raw:TournamentRangeEvidence,
):{status:'attached'|'simulation-only';evaluation:TournamentRangeEvaluation;context?:TournamentHandContext}{
 const evidence=validateTournamentRangeEvidence(raw);if(draft.handId!==evidence.handId)throw new Error('Tournament context and range evidence handId must match.');if(draft.model!=='icm'&&draft.model!=='pko')throw new Error('Range-derived showdown equity applies only to ICM/PKO contexts.');const evaluation=evaluateTournamentRangeEvidence(evidence);if(evaluation.status!=='exact-eligible')return{status:'simulation-only',evaluation};
 const context={...draft,showdownEquity:evaluation.equityFraction,reference:`${draft.reference}; showdown-equity:${evidence.reference}`,methodology:`${draft.methodology}; P20 exact range enumeration ${evidence.id}@${evidence.version}: ${evidence.methodology}`} as TournamentHandContext;return{status:'attached',evaluation,context};
}

export function validateFgsProbabilityEvidence(raw:FgsProbabilityEvidence):FgsProbabilityEvidence{
 if(!raw||raw.schemaVersion!==1||!raw.id||!raw.version||!raw.handId||!raw.reference||!raw.methodology||!validTimestamp(raw.generatedAt)||!Array.isArray(raw.edges)||!raw.edges.length)throw new Error('FGS probability evidence requires identity, handId, provenance and explicit edges.');
 const keys=new Set<string>();raw.edges.forEach(edge=>{const key=`${edge.parentId}->${edge.childId}`;if(!edge.parentId||!edge.childId||keys.has(key)||!Number.isFinite(edge.probability)||edge.probability<0||edge.probability>1)throw new Error(`Invalid/duplicate FGS probability edge ${key}.`);keys.add(key);});return JSON.parse(JSON.stringify(raw)) as FgsProbabilityEvidence;
}

function cloneNode(node:FgsNode):FgsNode{return{id:node.id,probability:node.probability,players:node.players?.map(player=>({...player})),note:node.note,children:node.children?.map(cloneNode)};}
function collectEdges(node:FgsNode,edges:Array<[FgsNode,FgsNode]>){for(const child of node.children||[]){edges.push([node,child]);collectEdges(child,edges);}}

/** Applies probabilities from an explicit referenced model; it never estimates missing branches from HH. */
export function applyFgsProbabilityEvidence(actionTrees:FgsActionTree[],raw:FgsProbabilityEvidence):AppliedFgsProbabilityEvidence{
 const evidence=validateFgsProbabilityEvidence(raw),trees=actionTrees.map(tree=>({action:tree.action,root:cloneNode(tree.root)}));const evidenceMap=new Map(evidence.edges.map(edge=>[`${edge.parentId}->${edge.childId}`,edge.probability]));const used=new Set<string>();
 for(const tree of trees){const edges:Array<[FgsNode,FgsNode]>=[];collectEdges(tree.root,edges);for(const[parent,child]of edges){const key=`${parent.id}->${child.id}`,value=evidenceMap.get(key);if(value===undefined)throw new Error(`FGS probability evidence is missing ${key}.`);child.probability=value;used.add(key);}const parents=new Map<string,FgsNode>();edges.forEach(([parent])=>parents.set(parent.id,parent));for(const parent of parents.values()){const total=(parent.children||[]).reduce((sum,child)=>sum+(child.probability||0),0);if(Math.abs(total-1)>1e-6)throw new Error(`FGS probabilities for ${parent.id} must sum to 1.`);}}
 const extras=[...evidenceMap.keys()].filter(key=>!used.has(key));if(extras.length)throw new Error(`FGS probability evidence contains edges absent from the supplied trees: ${extras.join(', ')}.`);return{actionTrees:trees,evidenceKey:`${evidence.id}@${evidence.version}`,reference:evidence.reference,methodology:evidence.methodology};
}
