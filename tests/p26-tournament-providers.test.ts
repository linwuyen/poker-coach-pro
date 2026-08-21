import assert from 'node:assert/strict';
import test from 'node:test';
import { TournamentEvidenceProvider, resolveTournamentFgsProbabilityEvidence, resolveTournamentRangeEvidence } from '../src/real-game/tournamentEvidenceProviders';

function provider(id:string):TournamentEvidenceProvider{return{descriptor:{id,version:'1',kind:'verified-solver',reference:`fixture://${id}`,generatedAt:'2026-08-21T05:00:00Z',methodology:'Synthetic provider fixture.',capabilities:['range','fgs-probabilities']},provideRange:req=>({schemaVersion:1,id:`${id}-range`,version:'1',handId:req.handId,heroCards:req.heroCards,board:req.board,villainRange:[{hand:'QQ',weight:1}],reference:`fixture://${id}/range`,generatedAt:'2026-08-21T05:00:00Z',methodology:'Fixture explicit range.'}),provideFgsProbabilities:req=>({schemaVersion:1,id:`${id}-fgs`,version:'1',handId:req.handId,reference:`fixture://${id}/fgs`,generatedAt:'2026-08-21T05:00:00Z',methodology:'Fixture explicit branch model.',edges:req.edgeKeys.map((key,index)=>{const[parentId,childId]=key.split('->');return{parentId,childId,probability:index===0?0.4:0.6};})})};}

test('P26 resolves exactly one explicit tournament range provider and preserves its evidence provenance',async()=>{
 const result=await resolveTournamentRangeEvidence([provider('solver-a')],{handId:'h1',heroCards:['As','Kd'],board:['Ah','8c','4d'],contextKey:'ctx'});
 assert.equal(result.status,'resolved');assert.equal(result.providerKey,'solver-a@1');assert.equal(result.evidence?.reference,'fixture://solver-a/range');
});

test('P26 refuses to silently prioritize conflicting provider responses but supports explicit provider selection',async()=>{
 const request={handId:'h1',heroCards:['As','Kd'],board:['Ah','8c','4d'],contextKey:'ctx'};
 const ambiguous=await resolveTournamentRangeEvidence([provider('solver-a'),provider('solver-b')],request);
 assert.equal(ambiguous.status,'ambiguous');assert.equal(ambiguous.evidence,undefined);
 const selected=await resolveTournamentRangeEvidence([provider('solver-a'),provider('solver-b')],request,'solver-b');
 assert.equal(selected.status,'resolved');assert.equal(selected.providerKey,'solver-b@1');
});

test('P26 FGS provider must return exactly the requested tree edge set',async()=>{
 const result=await resolveTournamentFgsProbabilityEvidence([provider('solver-a')],{handId:'h2',contextKey:'ctx',edgeKeys:['root->a','root->b']});
 assert.equal(result.status,'resolved');assert.equal(result.evidence?.edges.length,2);
 await assert.rejects(()=>resolveTournamentFgsProbabilityEvidence([{...provider('bad'),provideFgsProbabilities:req=>({schemaVersion:1,id:'bad',version:'1',handId:req.handId,reference:'fixture://bad',generatedAt:'2026-08-21T05:00:00Z',methodology:'bad',edges:[{parentId:'root',childId:'x',probability:1}]})}],{handId:'h2',contextKey:'ctx',edgeKeys:['root->a','root->b']}));
});
