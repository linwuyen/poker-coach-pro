import assert from 'node:assert/strict';
import test from 'node:test';
import { PostflopTruthNode, createPostflopTruthStore, solverCsvToPostflopPack } from '../src/strategy-engine-v3';

function node(version = '1'): PostflopTruthNode {
  return {
    schemaVersion:3,id:'solver-v3:cash-btn-bb-a84r',version,name:'BTN vs BB A84r',description:'fixture',
    context:{format:'cash',tableSize:'6max',street:'Flop',heroPosition:'btn',villainPosition:'bb',playersInHand:2,effectiveStackBB:97.5,potBB:5.5,spr:17.727,toCallBB:0,board:['Ah','8c','4d'],preflopLine:[{actor:'btn',action:'raise',toBB:2.5},{actor:'bb',action:'call'}],streetLine:[{actor:'bb',action:'check'}],lastAggressorPosition:'btn',rakePercent:5,rakeCapBB:2},
    source:{type:'solver',trustTier:'verified-solver',label:'fixture',reference:'fixture://postflop',solverName:'FixtureSolver',solverVersion:version,generatedAt:'2026-08-21T00:00:00Z',disclaimer:'Synthetic test fixture only.'},
    strategyByCombo:{AsKd:{check:0.35,bet:0.65}},evByCombo:{AsKd:{check:1.12,bet:1.31}},tags:['test'],
  };
}

const query = {heroCards:['Kd','As'],format:'cash' as const,tableSize:'6max' as const,street:'Flop' as const,heroPosition:'btn' as const,villainPosition:'bb' as const,playersInHand:2 as const,effectiveStackBB:97.5,potBB:5.5,spr:17.727,toCallBB:0,board:['8c','Ah','4d'],preflopLine:[{actor:'btn' as const,action:'raise' as const,toBB:2.5},{actor:'bb' as const,action:'call' as const}],streetLine:[{actor:'bb' as const,action:'check' as const}],lastAggressorPosition:'btn' as const,rakePercent:5,rakeCapBB:2};

test('P13 indexed truth store resolves by context and refuses version ambiguity', async () => {
  const store = createPostflopTruthStore(true);
  assert.deepEqual(await store.putNodes([node()]), { imported:1, skipped:0 });
  assert.equal((await store.findExact(query))?.id, node().id);
  await store.putNodes([node('2')]);
  assert.equal(await store.findExact(query), undefined);
  const diagnostics = await store.diagnostics();
  assert.equal(diagnostics.backend,'memory'); assert.equal(diagnostics.nodes,2); assert.equal(diagnostics.contexts,1);
});

test('P13 configurable solver CSV adapter preserves provenance, frequency and EV', () => {
  const csv = [
    'node_id,node_name,format,table_size,street,hero_position,villain_position,effective_stack_bb,pot_bb,spr,to_call_bb,board,preflop_line_json,street_line_json,last_aggressor_position,rake_percent,rake_cap_bb,hero_cards,action,frequency,ev_bb,solver_name,solver_version,source_reference,generated_at',
    'n1,A84r,cash,6max,Flop,btn,bb,97.5,5.5,17.727,0,"Ah 8c 4d","[{""actor"":""btn"",""action"":""raise"",""toBB"":2.5},{""actor"":""bb"",""action"":""call""}]","[{""actor"":""bb"",""action"":""check""}]",btn,5,2,"As Kd",check,0.35,1.12,FixtureSolver,1,fixture://csv,2026-08-21T00:00:00Z',
    'n1,A84r,cash,6max,Flop,btn,bb,97.5,5.5,17.727,0,"Ah 8c 4d","[{""actor"":""btn"",""action"":""raise"",""toBB"":2.5},{""actor"":""bb"",""action"":""call""}]","[{""actor"":""bb"",""action"":""check""}]",btn,5,2,"As Kd",bet,0.65,1.31,FixtureSolver,1,fixture://csv,2026-08-21T00:00:00Z',
  ].join('\n');
  const pack = solverCsvToPostflopPack(csv, undefined, { packId:'csv-pack', version:'1' });
  assert.equal(pack.nodes.length,1); assert.equal(pack.nodes[0].strategyByCombo.AsKd.bet,0.65); assert.equal(pack.nodes[0].evByCombo?.AsKd.bet,1.31); assert.equal(pack.nodes[0].source.reference,'fixture://csv');
});
