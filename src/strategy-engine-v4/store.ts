import { canonicalHoleCombo } from '../strategy-engine-v3/context';
import { canonicalMultiwayContext, multiwayContextKey } from './context';
import { multiwayNodeHash, validateMultiwayTruthNode } from './importer';
import { MultiwayTruthContext, MultiwayTruthNodeV4, MultiwayTruthPackV4, MultiwayTruthQuery } from './types';

export interface MultiwayTruthPackManifest { key:string;packId:string;version:string;importedAt:string;sourceReference:string;nodeCount:number;skippedCount:number;contentBytes:number; }
export interface MultiwayTruthDiagnostics { backend:'indexeddb'|'memory';nodes:number;contexts:number;packs:number;approximateBytes:number; }
export interface MultiwayTruthStore {
  readonly backend:'indexeddb'|'memory';
  putPack(pack:MultiwayTruthPackV4):Promise<{imported:number;skipped:number}>;
  putNodes(nodes:MultiwayTruthNodeV4[],manifest?:Omit<MultiwayTruthPackManifest,'nodeCount'|'skippedCount'|'contentBytes'>):Promise<{imported:number;skipped:number}>;
  findExact(query:MultiwayTruthQuery):Promise<MultiwayTruthNodeV4|undefined>;
  getNode(key:string):Promise<MultiwayTruthNodeV4|undefined>;
  listNodes(limit?:number):Promise<MultiwayTruthNodeV4[]>;
  listManifests():Promise<MultiwayTruthPackManifest[]>;
  iterateNodes():AsyncGenerator<MultiwayTruthNodeV4>;
  diagnostics():Promise<MultiwayTruthDiagnostics>;
  clear():Promise<void>;
}

interface StoredNode { key:string; contextKey:string; node:MultiwayTruthNodeV4; bytes:number; }
const bytesOf=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
const nodeKey=(node:MultiwayTruthNodeV4)=>`${node.id}@${node.version}`;
function completeContext(query:MultiwayTruthQuery):MultiwayTruthContext|undefined{const required:Array<keyof MultiwayTruthContext>=['format','tableSize','street','heroPosition','heroRemainingStackBB','opponents','playersInHand','potBB','spr','toCallBB','board','preflopLine','streetLine'];if(required.some(k=>query[k]===undefined))return undefined;try{return canonicalMultiwayContext(query as MultiwayTruthContext);}catch{return undefined;}}
function comboExists(node:MultiwayTruthNodeV4,query:MultiwayTruthQuery){if(!query.heroCards)return false;try{return Boolean(node.strategyByCombo[canonicalHoleCombo(query.heroCards)]);}catch{return false;}}

class MemoryStore implements MultiwayTruthStore{
  readonly backend='memory' as const;private nodes=new Map<string,StoredNode>();private contexts=new Map<string,Set<string>>();private manifests=new Map<string,MultiwayTruthPackManifest>();
  async putPack(pack:MultiwayTruthPackV4){if(!pack||pack.schemaVersion!==4||!pack.packId||!pack.version||!pack.sourceReference||!Array.isArray(pack.nodes))throw new Error('Invalid multiway truth pack v4.');return this.putNodes(pack.nodes,{key:`${pack.packId}@${pack.version}`,packId:pack.packId,version:pack.version,importedAt:new Date().toISOString(),sourceReference:pack.sourceReference});}
  async putNodes(nodes:MultiwayTruthNodeV4[],manifest?:Omit<MultiwayTruthPackManifest,'nodeCount'|'skippedCount'|'contentBytes'>){let imported=0,skipped=0,contentBytes=0;for(const candidate of nodes){const node=validateMultiwayTruthNode(candidate),key=nodeKey(node),old=this.nodes.get(key);if(old){if((old.node.contentHash||multiwayNodeHash(old.node))!==node.contentHash)throw new Error(`${key} is immutable.`);skipped++;continue;}const contextKey=multiwayContextKey(node.context),bytes=bytesOf(node);this.nodes.set(key,{key,contextKey,node,bytes});const set=this.contexts.get(contextKey)||new Set<string>();set.add(key);this.contexts.set(contextKey,set);imported++;contentBytes+=bytes;}if(manifest)this.manifests.set(manifest.key,{...manifest,nodeCount:imported,skippedCount:skipped,contentBytes});return{imported,skipped};}
  async findExact(query:MultiwayTruthQuery){const context=completeContext(query);if(!context)return undefined;const keys=[...(this.contexts.get(multiwayContextKey(context))||[])];const matches=keys.map(k=>this.nodes.get(k)?.node).filter((node):node is MultiwayTruthNodeV4=>Boolean(node&&node.source.trustTier==='verified-solver'&&comboExists(node,query)));return matches.length===1?matches[0]:undefined;}
  async getNode(key:string){return this.nodes.get(key)?.node;}
  async listNodes(limit=1000){return[...this.nodes.values()].slice(0,limit).map(record=>record.node);}
  async listManifests(){return[...this.manifests.values()].sort((a,b)=>b.importedAt.localeCompare(a.importedAt));}
  async *iterateNodes(){for(const record of this.nodes.values())yield record.node;}
  async diagnostics(){return{backend:this.backend,nodes:this.nodes.size,contexts:this.contexts.size,packs:this.manifests.size,approximateBytes:[...this.nodes.values()].reduce((sum,record)=>sum+record.bytes,0)};}
  async clear(){this.nodes.clear();this.contexts.clear();this.manifests.clear();}
}

const DB='poker-coach-truth-v4',DB_VERSION=3,STORE='nodes',CONTEXT_STORE='contexts',PACK_STORE='packs',INDEX='contextKey';
function openDb():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;let nodeStore:IDBObjectStore;if(!db.objectStoreNames.contains(STORE))nodeStore=db.createObjectStore(STORE,{keyPath:'key'});else nodeStore=r.transaction!.objectStore(STORE);if(!nodeStore.indexNames.contains(INDEX))nodeStore.createIndex(INDEX,'contextKey',{unique:false});if(!db.objectStoreNames.contains(CONTEXT_STORE))db.createObjectStore(CONTEXT_STORE,{keyPath:'contextKey'});if(!db.objectStoreNames.contains(PACK_STORE))db.createObjectStore(PACK_STORE,{keyPath:'key'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('IndexedDB open failed.'));});}
function req<T>(r:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}function done(tx:IDBTransaction):Promise<void>{return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted.'));});}
class IndexedStore implements MultiwayTruthStore{
  readonly backend='indexeddb' as const;
  async putPack(pack:MultiwayTruthPackV4){if(!pack||pack.schemaVersion!==4||!pack.packId||!pack.version||!pack.sourceReference||!Array.isArray(pack.nodes))throw new Error('Invalid multiway truth pack v4.');return this.putNodes(pack.nodes,{key:`${pack.packId}@${pack.version}`,packId:pack.packId,version:pack.version,importedAt:new Date().toISOString(),sourceReference:pack.sourceReference});}
  async putNodes(nodes:MultiwayTruthNodeV4[],manifest?:Omit<MultiwayTruthPackManifest,'nodeCount'|'skippedCount'|'contentBytes'>){const db=await openDb();let imported=0,skipped=0,contentBytes=0;try{for(const candidate of nodes){const node=validateMultiwayTruthNode(candidate),key=nodeKey(node);const existing=await req(db.transaction(STORE,'readonly').objectStore(STORE).get(key) as IDBRequest<StoredNode|undefined>);if(existing){if((existing.node.contentHash||multiwayNodeHash(existing.node))!==node.contentHash)throw new Error(`${key} is immutable.`);skipped++;continue;}const record:StoredNode={key,contextKey:multiwayContextKey(node.context),node,bytes:bytesOf(node)};const tx=db.transaction([STORE,CONTEXT_STORE],'readwrite');tx.objectStore(STORE).add(record);tx.objectStore(CONTEXT_STORE).put({contextKey:record.contextKey});await done(tx);imported++;contentBytes+=record.bytes;}if(manifest){const tx=db.transaction(PACK_STORE,'readwrite');tx.objectStore(PACK_STORE).put({...manifest,nodeCount:imported,skippedCount:skipped,contentBytes});await done(tx);}return{imported,skipped};}finally{db.close();}}
  async findExact(query:MultiwayTruthQuery){const context=completeContext(query);if(!context)return undefined;const db=await openDb();try{const records=await req(db.transaction(STORE,'readonly').objectStore(STORE).index(INDEX).getAll(multiwayContextKey(context)) as IDBRequest<StoredNode[]>);const matches=records.map(r=>r.node).filter(node=>node.source.trustTier==='verified-solver'&&comboExists(node,query));return matches.length===1?matches[0]:undefined;}finally{db.close();}}
  async getNode(key:string){const db=await openDb();try{return(await req(db.transaction(STORE,'readonly').objectStore(STORE).get(key) as IDBRequest<StoredNode|undefined>))?.node;}finally{db.close();}}
  async listNodes(limit=1000){const db=await openDb();try{return(await req(db.transaction(STORE,'readonly').objectStore(STORE).getAll(undefined,limit) as IDBRequest<StoredNode[]>)).map(record=>record.node);}finally{db.close();}}
  async listManifests(){const db=await openDb();try{return(await req(db.transaction(PACK_STORE,'readonly').objectStore(PACK_STORE).getAll() as IDBRequest<MultiwayTruthPackManifest[]>)).sort((a,b)=>b.importedAt.localeCompare(a.importedAt));}finally{db.close();}}
  async *iterateNodes(){const db=await openDb();try{let lower:IDBValidKey|undefined;while(true){const tx=db.transaction(STORE,'readonly'),store=tx.objectStore(STORE),range=lower===undefined?undefined:IDBKeyRange.lowerBound(lower,true);const batch=await req(store.getAll(range,500) as IDBRequest<StoredNode[]>);if(!batch.length)break;for(const record of batch){yield record.node;lower=record.key;}if(batch.length<500)break;}}finally{db.close();}}
  async diagnostics(){const db=await openDb();try{const tx=db.transaction([STORE,CONTEXT_STORE,PACK_STORE],'readonly'),nodes=await req(tx.objectStore(STORE).count()),contexts=await req(tx.objectStore(CONTEXT_STORE).count()),manifests=await req(tx.objectStore(PACK_STORE).getAll() as IDBRequest<MultiwayTruthPackManifest[]>);return{backend:this.backend,nodes,contexts,packs:manifests.length,approximateBytes:manifests.reduce((sum,m)=>sum+(m.contentBytes||0),0)};}finally{db.close();}}
  async clear(){const db=await openDb();try{const tx=db.transaction([STORE,CONTEXT_STORE,PACK_STORE],'readwrite');tx.objectStore(STORE).clear();tx.objectStore(CONTEXT_STORE).clear();tx.objectStore(PACK_STORE).clear();await done(tx);}finally{db.close();}}
}
let singleton:MultiwayTruthStore|undefined;export function createMultiwayTruthStore(forceMemory=false):MultiwayTruthStore{return forceMemory||typeof indexedDB==='undefined'?new MemoryStore():new IndexedStore();}export function getMultiwayTruthStore():MultiwayTruthStore{if(!singleton)singleton=createMultiwayTruthStore();return singleton;}
export async function importMultiwayTruthNdjson(lines:AsyncIterable<string>,store:MultiwayTruthStore,meta:{packId:string;version:string;sourceReference:string}){let imported=0,skipped=0;for await(const raw of lines){const line=raw.trim();if(!line||line.startsWith('#'))continue;const result=await store.putNodes([JSON.parse(line) as MultiwayTruthNodeV4]);imported+=result.imported;skipped+=result.skipped;}await store.putNodes([],{key:`${meta.packId}@${meta.version}`,packId:meta.packId,version:meta.version,importedAt:new Date().toISOString(),sourceReference:meta.sourceReference});return{imported,skipped};}
