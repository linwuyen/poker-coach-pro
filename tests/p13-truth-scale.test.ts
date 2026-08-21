import assert from 'node:assert/strict';
import test from 'node:test';
import { PostflopTruthNode, createPostflopTruthStore, solverCsvToPostflopPack } from '../src/strategy-engine-v3';
import { auditHandHistoryForExactGrading } from '../src/real-game/handHistoryIntegrity';
import { parseHandHistoryText } from '../src/real-game/handHistory';

function node(version = '1'): PostflopTruthNode {
  return {
    schemaVersion:3,id:'solver-v3:cash-btn-bb-a84r',version,name:'BTN vs BB A84r',description:'fixture',
    context:{format:'cash',tableSize:'6max',street:'Flop',heroPosition:'btn',villainPosition:'bb',playersInHand:2,effectiveStackBB:97.5,potBB:5.5,spr:17.727,toCallBB:0,board:['Ah','8c','4d'],preflopLine:[{actor:'btn',action:'raise',toBB:2.5},{actor:'bb',action:'call'}],streetLine:[{actor:'bb',action:'check'}],lastAggressorPosition:'btn',rakePercent:5,rakeCapBB:2},
    source:{type:'solver',trustTier:'verified-solver',label:'fixture',reference:'fixture://postflop',solverName:'FixtureSolver',solverVersion:version,generatedAt:'2026-08-21T00:00:00Z'},
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

test('P13 HH integrity fails closed on straddles and multi-board runouts', () => {
  const text = `PokerStars Hand #9001: Hold'em No Limit ($0.50/$1.00 USD) - 2026/08/21 01:00:00 ET\nTable 'Audit' 6-max Seat #1 is the button\nSeat 1: Hero ($100 in chips)\nSeat 2: V1 ($100 in chips)\nSeat 3: V2 ($100 in chips)\nSeat 4: V3 ($100 in chips)\nSeat 5: V4 ($100 in chips)\nSeat 6: V5 ($100 in chips)\nV1: posts small blind $0.50\nV2: posts big blind $1\nV3: straddles $2\n*** HOLE CARDS ***\nDealt to Hero [As Kd]\nHero: raises $4 to $6\nV1: folds\nV2: calls $5\n*** FLOP *** [Ah 8c 4d]\nV2: checks\nHero: bets $4\nV2: calls $4\n*** FIRST TURN *** [Ah 8c 4d] [7s]\n*** SECOND TURN *** [Ah 8c 4d] [2s]`;
  const hand = parseHandHistoryText(text)[0];
  const report = auditHandHistoryForExactGrading(hand);
  assert.equal(report.gradeablePreflop,false); assert.equal(report.gradeablePostflop,false);
  assert.ok(report.issues.some(item=>item.code==='straddle-or-dead-blind'));
  assert.ok(report.issues.some(item=>item.code==='run-it-twice-or-multiple-board'));
});
