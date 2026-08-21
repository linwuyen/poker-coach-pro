import { canonicalHoleCombo } from '../strategy-engine-v3/context';
import { canonicalMultiwayContext, multiwayContextKey } from './context';
import { multiwayNodeHash, validateMultiwayTruthNode } from './importer';
import { MultiwayTruthContext, MultiwayTruthNodeV4, MultiwayTruthPackV4, MultiwayTruthQuery } from './types';

export interface MultiwayTruthStore {
  readonly backend:'indexeddb'|'memory';
  putPack(pack:MultiwayTruthPackV4):Promise<{imported:number;skipped:number}>;
  findExact(query:MultiwayTruthQuery):Promise<MultiwayTruthNodeV4|undefined>;
  listNodes(limit?:number):Promise<MultiwayTruthNodeV4[]>;
  diagnostics():Promise<{backend:'indexeddb'|'memory';nodes:number;contexts:number}>;
  clear():Promise<void>;
}

function completeContext(query:MultiwayTruthQuery):MultiwayTruthContext|undefined{const required:Array<keyof MultiwayTruthContext>=['format','tableSize','street','heroPosition','heroRemainingStackBB','opponents','playersInHand','potBB','spr','toCallBB','board','preflopLine','streetLine'];if(required.some(k=>query[k]===undefined))return undefined;try{return canonicalMultiwayContext(query as MultiwayTruthContext);}catch{return undefined;}}
function comboExists(node:MultiwayTruthNodeV4,query:MultiwayTruthQuery){if(!query.heroCards)return false;try{return Boolean(node.strategyByCombo[canonicalHoleCombo(query.heroCards)]);}catch{return false;}}

class MemoryStore implements MultiwayTruthStore{
  readonly backend='memory' as const;private nodes=new Map<string,MultiwayTruthNodeV4>();private contexts=new Map<string,Set<string>>();
  async putPack(pack:MultiwayTruthPackV4){if(!pack||pack.schemaVersion!==4||!Array.isArray(pack.nodes))throw new Error('Invalid multiway truth pack v4.');let imported=0,skipped=0;for(const candidate of pack.nodes){const node=validateMultiwayTruthNode(candidate),key=`${node.id}@${node.version}`,old=this.nodes.get(key);if(old){if((old.contentHash||multiwayNodeHash(old))!==node.contentHash)throw new Error(`${key} is immutable.`);skipped++;continue;}this.nodes.set(key,node);const ck=multiwayContextKey(node.context),set=this.contexts.get(ck)||new Set<string>();set.add(key);this.contexts.set(ck,set);imported++;}return{imported,skipped};}
  async findExact(query:MultiwayTruthQuery){const context=completeContext(query);if(!context)return undefined;const keys=[...(this.contexts.get(multiwayContextKey(context))||[])];const matches=keys.map(k=>this.nodes.get(k)).filter((node):node is MultiwayTruthNodeV4=>Boolean(node&&node.source.trustTier==='verified-solver'&&comboExists(node,query)));return matches.length===1?matches[0]:undefined;}
  async listNodes(limit=1000){return[...this.nodes.values()].slice(0,limit);}async diagnostics(){return{backend:this.backend,nodes:this.nodes.size,contexts:this.contexts.size};}async clear(){this.nodes.clear();this.contexts.clear();}
}

const DB='poker-coach-truth-v4',DB_VERSION=2,STORE='nodes',CONTEXT_STORE='contexts',INDEX='contextKey';
function openDb():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;let nodeStore:IDBObjectStore;if(!db.objectStoreNames.contains(STORE))nodeStore=db.createObjectStore(STORE,{keyPath:'key'});else nodeStore=r.transaction!.objectStore(STORE);if(!nodeStore.indexNames.contains(INDEX))nodeStore.createIndex(INDEX,'contextKey',{unique:false});if(!db.objectStoreNames.contains(CONTEXT_STORE))db.createObjectStore(CONTEXT_STORE,{keyPath:'contextKey'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function req<T>(r:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}function done(tx:IDBTransaction):Promise<void>{return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted.'));});}
class IndexedStore implements MultiwayTruthStore{
  readonly backend='indexeddb' as const;
  async putPack(pack:MultiwayTruthPackV4){if(!pack||pack.schemaVersion!==4||!Array.isArray(pack.nodes))throw new Error('Invalid multiway truth pack v4.');const db=await openDb();let imported=0,skipped=0;try{for(const candidate of pack.nodes){const node=validateMultiwayTruthNode(candidate),key=`${node.id}@${node.version}`;const existing=await req(db.transaction(STORE,'readonly').objectStore(STORE).get(key) as IDBRequest<{key:string;contextKey:string;node:MultiwayTruthNodeV4}|undefined>);if(existing){if((existing.node.contentHash||multiwayNodeHash(existing.node))!==node.contentHash)throw new Error(`${key} is immutable.`);skipped++;continue;}const contextKey=multiwayContextKey(node.context);const tx=db.transaction([STORE,CONTEXT_STORE],'readwrite');tx.objectStore(STORE).add({key,contextKey,node});tx.objectStore(CONTEXT_STORE).put({contextKey});await done(tx);imported++;}return{imported,skipped};}finally{db.close();}}
  async findExact(query:MultiwayTruthQuery){const context=completeContext(query);if(!context)return undefined;const db=await openDb();try{const records=await req(db.transaction(STORE,'readonly').objectStore(STORE).index(INDEX).getAll(multiwayContextKey(context)) as IDBRequest<Array<{key:string;contextKey:string;node:MultiwayTruthNodeV4}>>);const matches=records.map(r=>r.node).filter(node=>node.source.trustTier==='verified-solver'&&comboExists(node,query));return matches.length===1?matches[0]:undefined;}finally{db.close();}}
  async listNodes(limit=1000){const db=await openDb();try{return(await req(db.transaction(STORE,'readonly').objectStore(STORE).getAll(undefined,limit) as IDBRequest<Array<{node:MultiwayTruthNodeV4}>>)).map(r=>r.node);}finally{db.close();}}
  async diagnostics(){const db=await openDb();try{const tx=db.transaction([STORE,CONTEXT_STORE],'readonly');return{backend:this.backend,nodes:await req(tx.objectStore(STORE).count()),contexts:await req(tx.objectStore(CONTEXT_STORE).count())};}finally{db.close();}}
  async clear(){const db=await openDb();try{const tx=db.transaction([STORE,CONTEXT_STORE],'readwrite');tx.objectStore(STORE).clear();tx.objectStore(CONTEXT_STORE).clear();await done(tx);}finally{db.close();}}
}
let singleton:MultiwayTruthStore|undefined;export function createMultiwayTruthStore(forceMemory=false):MultiwayTruthStore{return forceMemory||typeof indexedDB==='undefined'?new MemoryStore():new IndexedStore();}export function getMultiwayTruthStore():MultiwayTruthStore{if(!singleton)singleton=createMultiwayTruthStore();return singleton;}
