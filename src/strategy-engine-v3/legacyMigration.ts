import { POSTFLOP_TRUTH_STORAGE_KEY } from './storage';
import { PostflopTruthNode } from './types';
import { PostflopTruthStore } from './indexedStore';

const MIGRATION_KEY='poker_postflop_truth_v3_indexed_migration_v1';
export async function migrateLegacyPostflopTruthStorage(store:PostflopTruthStore):Promise<{migrated:number;skipped:number;alreadyDone:boolean}>{
 if(typeof localStorage==='undefined')return{migrated:0,skipped:0,alreadyDone:true};
 if(localStorage.getItem(MIGRATION_KEY)==='done')return{migrated:0,skipped:0,alreadyDone:true};
 let nodes:PostflopTruthNode[]=[];try{const parsed=JSON.parse(localStorage.getItem(POSTFLOP_TRUTH_STORAGE_KEY)||'[]');if(Array.isArray(parsed))nodes=parsed;}catch{/* malformed legacy data stays unavailable */}
 const result=nodes.length?await store.putNodes(nodes,{key:'legacy-localstorage@1',packId:'legacy-localstorage',version:'1',importedAt:new Date().toISOString(),sourceReference:'browser-localStorage:migration'}):{imported:0,skipped:0};
 localStorage.setItem(MIGRATION_KEY,'done');
 return{migrated:result.imported,skipped:result.skipped,alreadyDone:false};
}
