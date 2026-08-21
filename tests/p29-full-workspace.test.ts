import assert from 'node:assert/strict';
import test from 'node:test';
import { collectPortableLocalState, exportFullWorkspaceLines, extractTruthWorkspaceLines, resolveWorkspaceSync, restorePortableLocalState, validateFullWorkspaceLines } from '../src/solver-data/fullWorkspace';
import { importTruthWorkspaceLines } from '../src/solver-data/truthWorkspace';
import { createPostflopTruthStore } from '../src/strategy-engine-v3';
import { createMultiwayTruthStore } from '../src/strategy-engine-v4';

class MemoryStorage {private map=new Map<string,string>();get length(){return this.map.size;}key(index:number){return[...this.map.keys()][index]??null;}getItem(key:string){return this.map.get(key)??null;}setItem(key:string,value:string){this.map.set(key,value);}}
async function* asLines(lines:string[]){for(const line of lines)yield line;}

test('P29 full workspace streams portable local state plus P23 truth and excludes credential-like keys',async()=>{
 const sourceStorage=new MemoryStorage();sourceStorage.setItem('poker_training_history_v6','[{"id":1}]');sourceStorage.setItem('poker_tournament_metadata_v1','[]');sourceStorage.setItem('poker_api_key','do-not-export');sourceStorage.setItem('unrelated','ignore');
 assert.deepEqual(collectPortableLocalState(sourceStorage).map(row=>row.key),['poker_tournament_metadata_v1','poker_training_history_v6']);
 const v3=createPostflopTruthStore(true),v4=createMultiwayTruthStore(true),lines:string[]=[];for await(const line of exportFullWorkspaceLines(sourceStorage,v3,v4,'full-test'))lines.push(line);
 const validation=await validateFullWorkspaceLines(asLines(lines));assert.equal(validation.valid,true);assert.equal(validation.localRecords,2);assert.ok(validation.truthLines>=2);
 const targetStorage=new MemoryStorage();const restored=await restorePortableLocalState(asLines(lines),targetStorage);assert.equal(restored.imported,2);assert.equal(targetStorage.getItem('poker_training_history_v6'),'[{"id":1}]');assert.equal(targetStorage.getItem('poker_api_key'),null);
 const targetV3=createPostflopTruthStore(true),targetV4=createMultiwayTruthStore(true);const truth=await importTruthWorkspaceLines(extractTruthWorkspaceLines(asLines(lines)),targetV3,targetV4,{validateOnly:true});assert.equal(truth.validated,true);
});

test('P29 restore is conflict-safe by default and requires explicit overwrite for differing local state',async()=>{
 const source=new MemoryStorage();source.setItem('poker_training_history_v6','new');const v3=createPostflopTruthStore(true),v4=createMultiwayTruthStore(true),lines:string[]=[];for await(const line of exportFullWorkspaceLines(source,v3,v4,'conflict-test'))lines.push(line);const target=new MemoryStorage();target.setItem('poker_training_history_v6','old');const result=await restorePortableLocalState(asLines(lines),target);assert.deepEqual(result.conflicts,['poker_training_history_v6']);assert.equal(target.getItem('poker_training_history_v6'),'old');const overwritten=await restorePortableLocalState(asLines(lines),target,{overwrite:true});assert.equal(overwritten.imported,1);assert.equal(target.getItem('poker_training_history_v6'),'new');
});

test('P29 cross-device revisions fast-forward only with direct ancestry and reject divergent last-write-wins',()=>{
 const base={schemaVersion:1 as const,workspaceId:'w',deviceId:'a',generatedAt:'2026-08-21T00:00:00Z',revision:'r1',contentHash:'h1'};const remote={...base,deviceId:'b',revision:'r2',parentRevision:'r1',contentHash:'h2'};assert.equal(resolveWorkspaceSync(base,remote).status,'accept-remote');const divergent={...base,deviceId:'c',revision:'r3',parentRevision:'r0',contentHash:'h3'};assert.equal(resolveWorkspaceSync(remote,divergent).status,'conflict');
});
