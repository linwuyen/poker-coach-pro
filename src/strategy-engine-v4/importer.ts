import { canonicalHoleCombo } from '../strategy-engine-v3/context';
import { PostflopAction } from '../strategy-engine-v3/types';
import { canonicalMultiwayContext, multiwayContextKey } from './context';
import { MultiwayTruthNodeV4, MultiwayTruthPackV4 } from './types';

const ACTIONS:PostflopAction[]=['check','bet','call','raise','fold','allIn'];
function stable(value:unknown):string{if(Array.isArray(value))return`[${value.map(stable).join(',')}]`;if(value&&typeof value==='object'){const o=value as Record<string,unknown>;return`{${Object.keys(o).sort().map(k=>`${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`;}return JSON.stringify(value);}
export function multiwayNodeHash(node:MultiwayTruthNodeV4):string{const text=stable({schemaVersion:node.schemaVersion,id:node.id,version:node.version,context:canonicalMultiwayContext(node.context),source:node.source,strategyByCombo:node.strategyByCombo,evByCombo:node.evByCombo});let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return`fnv1a-${(h>>>0).toString(16).padStart(8,'0')}`;}
function validateActionMap(id:string,combo:string,map:Record<string,unknown>,label:string){for(const [action,value] of Object.entries(map)){if(!ACTIONS.includes(action as PostflopAction))throw new Error(`${id}:${combo} unknown ${label} action ${action}.`);if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`${id}:${combo}:${action} ${label} must be finite.`);}}

export function validateMultiwayTruthNode(input:MultiwayTruthNodeV4):MultiwayTruthNodeV4{
  if(!input||input.schemaVersion!==4||!input.id||!input.version||!input.name)throw new Error('Multiway truth node requires schemaVersion 4, id, version and name.');
  if(input.source?.type!=='solver'||input.source?.trustTier!=='verified-solver'||!input.source.reference||!input.source.solverName||!input.source.generatedAt)throw new Error(`${input.id}: verified solver provenance is required.`);
  if(!Number.isFinite(Date.parse(input.source.generatedAt)))throw new Error(`${input.id}: invalid generatedAt.`);
  const context=canonicalMultiwayContext(input.context);
  if(!Number.isInteger(context.playersInHand)||context.playersInHand<3)throw new Error(`${input.id}: multiway v4 requires playersInHand >= 3.`);
  if(context.opponents.length!==context.playersInHand-1)throw new Error(`${input.id}: opponents must enumerate every non-Hero active player.`);
  const positions=new Set([context.heroPosition,...context.opponents.map(item=>item.position)]);if(positions.size!==context.playersInHand)throw new Error(`${input.id}: active positions must be unique.`);
  if(context.opponents.some(item=>!Number.isFinite(item.remainingStackBB)||item.remainingStackBB<0))throw new Error(`${input.id}: opponent stacks are invalid.`);
  if([context.heroRemainingStackBB,context.potBB,context.spr,context.toCallBB].some(value=>!Number.isFinite(value)||value<0))throw new Error(`${input.id}: numeric context is invalid.`);
  const expected=context.street==='Flop'?3:context.street==='Turn'?4:5;if(context.board.length!==expected)throw new Error(`${input.id}: board length does not match street.`);
  const strategy:MultiwayTruthNodeV4['strategyByCombo']={};
  for(const [rawCombo,frequencies] of Object.entries(input.strategyByCombo||{})){const cards=rawCombo.match(/([2-9TJQKA][shdc])/gi);if(!cards||cards.length!==2)throw new Error(`${input.id}: invalid combo ${rawCombo}.`);const combo=canonicalHoleCombo(cards);if(combo!==rawCombo)throw new Error(`${input.id}: combo ${rawCombo} must use canonical ${combo}.`);validateActionMap(input.id,combo,frequencies as Record<string,unknown>,'frequency');const values=Object.values(frequencies);const total=values.reduce((sum,value)=>sum+(value||0),0);if(total<=0||total>1.0001||values.some(value=>(value||0)<0))throw new Error(`${input.id}:${combo} invalid frequencies.`);strategy[combo]={...frequencies};}
  if(!Object.keys(strategy).length)throw new Error(`${input.id}: strategy rows are required.`);
  for(const [combo,ev] of Object.entries(input.evByCombo||{})){if(!strategy[combo])throw new Error(`${input.id}: EV combo ${combo} has no strategy row.`);validateActionMap(input.id,combo,ev as Record<string,unknown>,'EV');}
  const node:MultiwayTruthNodeV4={...input,context,strategyByCombo:strategy,immutable:true};node.contentHash=multiwayNodeHash(node);return node;
}

export function importMultiwayTruthPack(raw:string|MultiwayTruthPackV4,existing:MultiwayTruthNodeV4[]=[]):{nodes:MultiwayTruthNodeV4[];skipped:string[]}{
  const pack=typeof raw==='string'?JSON.parse(raw) as MultiwayTruthPackV4:raw;if(!pack||pack.schemaVersion!==4||!pack.packId||!pack.version||!pack.sourceReference||!Array.isArray(pack.nodes)||!Number.isFinite(Date.parse(pack.exportedAt)))throw new Error('Invalid multiway truth pack v4.');
  const known=new Map(existing.map(node=>[`${node.id}@${node.version}`,node]));const nodes:MultiwayTruthNodeV4[]=[];const skipped:string[]=[];
  for(const candidate of pack.nodes){const node=validateMultiwayTruthNode(candidate);const key=`${node.id}@${node.version}`;const previous=known.get(key);if(previous){if((previous.contentHash||multiwayNodeHash(previous))!==node.contentHash)throw new Error(`${key} is immutable; publish a new version.`);skipped.push(key);continue;}known.set(key,node);nodes.push(node);}return{nodes,skipped};
}

export function multiwayCoverage(nodes:MultiwayTruthNodeV4[]){const verified=nodes.filter(node=>node.source.trustTier==='verified-solver');const contexts=new Set(verified.map(node=>multiwayContextKey(node.context)));return{nodes:verified.length,contexts:contexts.size,comboRows:verified.reduce((sum,node)=>sum+Object.keys(node.strategyByCombo).length,0),evRows:verified.reduce((sum,node)=>sum+Object.keys(node.evByCombo||{}).length,0),streets:{Flop:verified.filter(n=>n.context.street==='Flop').length,Turn:verified.filter(n=>n.context.street==='Turn').length,River:verified.filter(n=>n.context.street==='River').length}};}
