import assert from 'node:assert/strict';
import test from 'node:test';
import { appendReliabilityEvent, buildReliabilityReport, loadReliabilityEvents, sanitizeReliabilityEvent } from '../src/observability/reliability';

class MemoryStorage {private map=new Map<string,string>();getItem(key:string){return this.map.get(key)??null;}setItem(key:string,value:string){this.map.set(key,value);}}
const now=Date.UTC(2026,7,21,5,0,0);

test('P30 telemetry stores only bounded machine labels and rejects raw card/user text',()=>{
 assert.throws(()=>sanitizeReliabilityEvent({schemaVersion:1,timestamp:now,operation:'generator-pool',outcome:'error',reasonCode:'Hero As Kd failed'} as any),/machine label/);
 const storage=new MemoryStorage();appendReliabilityEvent(storage,{schemaVersion:1,timestamp:now,operation:'generator-pool',outcome:'error',reasonCode:'truth-gate-empty',dimension:'postflop'});const rows=loadReliabilityEvents(storage);assert.equal(rows.length,1);assert.deepEqual(Object.keys(rows[0]).sort(),['dimension','durationMs','operation','outcome','reasonCode','schemaVersion','timestamp','value'].sort());
});

test('P30 report exposes generator/truth/load/quota priorities without weakening truth rules',()=>{
 const events=[] as any[];
 for(let i=0;i<100;i++)events.push({schemaVersion:1,timestamp:now-i*1000,operation:'generator-pool',outcome:i<95?'success':'error',reasonCode:i<95?undefined:'truth-gate-empty',durationMs:5});
 for(let i=0;i<100;i++)events.push({schemaVersion:1,timestamp:now-i*1000,operation:'truth-lookup',outcome:i<60?'success':'unknown',reasonCode:i<60?undefined:'missing-context',durationMs:i===99?180:20});
 for(let i=0;i<20;i++)events.push({schemaVersion:1,timestamp:now-i*1000,operation:'pokerbench-load',outcome:i<18?'success':'error',reasonCode:i<18?undefined:'network'});
 events.push({schemaVersion:1,timestamp:now,operation:'storage-quota',outcome:'success',value:.85});
 const report=buildReliabilityReport(events,now,30);
 assert.equal(report.byOperation.find(row=>row.operation==='generator-pool')?.successRate,.95);
 assert.equal(report.byOperation.find(row=>row.operation==='truth-lookup')?.unknown,40);
 assert.equal(report.latestStorageQuotaRatio,.85);
 assert.ok(report.recommendations.some(item=>item.includes('Infinite pool')));
 assert.ok(report.recommendations.some(item=>item.includes('verified truth')));
 assert.ok(report.recommendations.some(item=>item.includes('quota')));
});

test('P30 bounded storage keeps the newest events only',()=>{const storage=new MemoryStorage();for(let i=0;i<120;i++)appendReliabilityEvent(storage,{schemaVersion:1,timestamp:now+i,operation:'experiment',outcome:'success'},100);const rows=loadReliabilityEvents(storage);assert.equal(rows.length,100);assert.equal(rows[0].timestamp,now+20);});
