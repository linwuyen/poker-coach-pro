import { canonicalBoard, canonicalHoleCombo, canonicalLine } from '../strategy-engine-v3/context';
import { PostflopAction } from '../strategy-engine-v3/types';
import { MultiwayTruthContext, MultiwayTruthNodeV4, MultiwayTruthQuery, MultiwayVerifiedRegret } from './types';

const POSITION_ORDER = ['utg','utg1','utg2','mp','hj','co','btn','sb','bb'];
const round = (value:number,digits=3) => Math.round(value*10**digits)/10**digits;

export function canonicalMultiwayContext(input: MultiwayTruthContext): MultiwayTruthContext {
  return {
    ...input,
    heroRemainingStackBB:round(input.heroRemainingStackBB), potBB:round(input.potBB), spr:round(input.spr), toCallBB:round(input.toCallBB),
    board:canonicalBoard(input.board), preflopLine:canonicalLine(input.preflopLine), streetLine:canonicalLine(input.streetLine),
    opponents:[...(input.opponents||[])].map(item=>({position:item.position,remainingStackBB:round(item.remainingStackBB)})).sort((a,b)=>POSITION_ORDER.indexOf(a.position)-POSITION_ORDER.indexOf(b.position)),
  };
}

export function multiwayContextKey(input: MultiwayTruthContext): string {
  const c = canonicalMultiwayContext(input);
  return JSON.stringify([c.format,c.tableSize,c.street,c.heroPosition,c.heroRemainingStackBB,c.opponents,c.playersInHand,c.potBB,c.spr,c.toCallBB,c.board,c.preflopLine,c.streetLine,c.lastAggressorPosition||'-',c.rakePercent??'-',c.rakeCapBB??'-']);
}

function completeQuery(query: MultiwayTruthQuery): MultiwayTruthContext | undefined {
  const required: Array<keyof MultiwayTruthContext> = ['format','tableSize','street','heroPosition','heroRemainingStackBB','opponents','playersInHand','potBB','spr','toCallBB','board','preflopLine','streetLine'];
  if (required.some(key=>query[key]===undefined)) return undefined;
  try { return canonicalMultiwayContext(query as MultiwayTruthContext); } catch { return undefined; }
}

export function findExactVerifiedMultiwayNode(nodes: MultiwayTruthNodeV4[], query: MultiwayTruthQuery): MultiwayTruthNodeV4 | undefined {
  if (!query.heroCards) return undefined;
  const context = completeQuery(query); if (!context || context.playersInHand < 3) return undefined;
  let combo:string; try { combo=canonicalHoleCombo(query.heroCards); } catch { return undefined; }
  const key=multiwayContextKey(context);
  const matches=nodes.filter(node=>node.source.trustTier==='verified-solver' && multiwayContextKey(node.context)===key && Boolean(node.strategyByCombo[combo]));
  return matches.length===1?matches[0]:undefined;
}

export function verifiedMultiwayRegret(node: MultiwayTruthNodeV4, heroCards:string[]|undefined, chosenAction:PostflopAction): MultiwayVerifiedRegret|undefined {
  if (!heroCards || node.source.trustTier!=='verified-solver' || !node.source.reference) return undefined;
  let combo:string; try { combo=canonicalHoleCombo(heroCards); } catch { return undefined; }
  const ev=node.evByCombo?.[combo]; const chosen=ev?.[chosenAction]; if (chosen===undefined || !Number.isFinite(chosen)) return undefined;
  const candidates=Object.entries(ev||{}).filter((entry):entry is [PostflopAction,number]=>typeof entry[1]==='number'&&Number.isFinite(entry[1]));
  if (candidates.length<2) return undefined;
  candidates.sort((a,b)=>b[1]-a[1]); const [bestAction,bestEvBB]=candidates[0];
  return {combo,chosenAction,bestAction,chosenEvBB:chosen,bestEvBB,evLossBB:Math.max(0,bestEvBB-chosen)};
}
