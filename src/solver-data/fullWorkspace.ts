import { PostflopTruthStore } from '../strategy-engine-v3';
import { MultiwayTruthStore } from '../strategy-engine-v4';
import { exportTruthWorkspaceLines } from './truthWorkspace';

export interface StorageLike { readonly length:number;key(index:number):string|null;getItem(key:string):string|null;setItem(key:string,value:string):void; }
export interface PortableLocalStateRecord { key:string;value:string; }
export interface FullWorkspaceHeader { kind:'full-workspace-header';schemaVersion:1;workspaceId:string;generatedAt:string; }
export interface FullWorkspaceFooter { kind:'full-workspace-footer';localRecords:number;truthLines:number;contentHash:string; }
type FullWorkspaceRecord=FullWorkspaceHeader|{kind:'local-state';key:string;value:string}|{kind:'truth-line';line:string}|FullWorkspaceFooter;
export interface FullWorkspaceValidation { workspaceId:string;localRecords:number;truthLines:number;contentHash:string;valid:true; }
export interface LocalStateRestoreResult { imported:number;skippedSame:number;conflicts:string[]; }
export interface WorkspaceSyncRevision { schemaVersion:1;revision:string;parentRevision?:string;deviceId:string;workspaceId:string;contentHash:string;generatedAt:string; }
export interface WorkspaceSyncResolution { status:'same'|'accept-remote'|'keep-local'|'conflict';reason:string; }

const SECRET_KEY=/(?:api.?key|token|secret|password|credential|authorization|auth[_-]?key)/i;
function encode(record:FullWorkspaceRecord){return JSON.stringify(record);}
function parse(line:string):FullWorkspaceRecord{let value:unknown;try{value=JSON.parse(line);}catch{throw new Error('Full workspace contains invalid JSON.');}if(!value||typeof value!=='object'||!('kind'in value))throw new Error('Full workspace record is missing kind.');return value as FullWorkspaceRecord;}
function fnvUpdate(hash:number,text:string){let h=hash>>>0;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function hashText(hash:number,line:string){return fnvUpdate(fnvUpdate(hash,line),'\n');}
function hashLabel(hash:number){return`fnv1a32:${(hash>>>0).toString(16).padStart(8,'0')}`;}

export function collectPortableLocalState(storage:StorageLike):PortableLocalStateRecord[]{
 const records:PortableLocalStateRecord[]=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key||!key.startsWith('poker_')||SECRET_KEY.test(key))continue;const value=storage.getItem(key);if(value!==null)records.push({key,value});}return records.sort((a,b)=>a.key.localeCompare(b.key));
}

/** Full P29 export streams truth through the P23 iterator and never combines v3/v4 nodes in memory. */
export async function* exportFullWorkspaceLines(storage:StorageLike,v3:PostflopTruthStore,v4:MultiwayTruthStore,workspaceId=`poker-workspace-${Date.now()}`):AsyncGenerator<string>{
 const header:FullWorkspaceHeader={kind:'full-workspace-header',schemaVersion:1,workspaceId,generatedAt:new Date().toISOString()};let hash=2166136261,localRecords=0,truthLines=0;const headerLine=encode(header);yield headerLine;hash=hashText(hash,headerLine);
 for(const state of collectPortableLocalState(storage)){const line=encode({kind:'local-state',...state});yield line;hash=hashText(hash,line);localRecords++;}
 for await(const truthLine of exportTruthWorkspaceLines(v3,v4,`${workspaceId}:truth`)){const line=encode({kind:'truth-line',line:truthLine});yield line;hash=hashText(hash,line);truthLines++;}
 yield encode({kind:'full-workspace-footer',localRecords,truthLines,contentHash:hashLabel(hash)});
}

export async function streamFullWorkspaceToWritable(storage:StorageLike,v3:PostflopTruthStore,v4:MultiwayTruthStore,writable:WritableStream<Uint8Array>,workspaceId?:string):Promise<void>{const writer=writable.getWriter(),encoder=new TextEncoder();try{for await(const line of exportFullWorkspaceLines(storage,v3,v4,workspaceId))await writer.write(encoder.encode(`${line}\n`));}finally{await writer.close();}}

export async function validateFullWorkspaceLines(lines:AsyncIterable<string>):Promise<FullWorkspaceValidation>{
 let header:FullWorkspaceHeader|undefined,footer:FullWorkspaceFooter|undefined,localRecords=0,truthLines=0,hash=2166136261,seenTruthHeader=false,seenTruthFooter=false;
 for await(const raw of lines){const line=raw.trim();if(!line)continue;const record=parse(line);if(record.kind==='full-workspace-footer'){if(footer)throw new Error('Full workspace contains multiple footers.');footer=record;continue;}if(footer)throw new Error('No records are allowed after the full workspace footer.');hash=hashText(hash,line);
  if(record.kind==='full-workspace-header'){if(header)throw new Error('Full workspace contains multiple headers.');if(record.schemaVersion!==1||!record.workspaceId||!Number.isFinite(Date.parse(record.generatedAt)))throw new Error('Invalid full workspace header.');header=record;continue;}if(!header)throw new Error('Full workspace header must be first.');
  if(record.kind==='local-state'){if(seenTruthHeader)throw new Error('Local state must precede truth stream.');if(!record.key.startsWith('poker_')||SECRET_KEY.test(record.key)||typeof record.value!=='string')throw new Error(`Unsafe/invalid local-state key ${record.key}.`);localRecords++;continue;}
  if(record.kind==='truth-line'){truthLines++;let inner:unknown;try{inner=JSON.parse(record.line);}catch{throw new Error('Embedded truth workspace line is invalid JSON.');}const kind=(inner as{kind?:string})?.kind;if(kind==='workspace-header'){if(seenTruthHeader)throw new Error('Embedded truth workspace contains multiple headers.');seenTruthHeader=true;}else if(kind==='workspace-footer'){seenTruthFooter=true;}else if(!seenTruthHeader||seenTruthFooter)throw new Error('Embedded truth workspace ordering is invalid.');continue;}
  throw new Error('Unsupported full workspace record kind.');
 }
 if(!header||!footer)throw new Error('Full workspace requires header and footer.');if(!seenTruthHeader||!seenTruthFooter)throw new Error('Full workspace requires a complete embedded truth workspace.');if(footer.localRecords!==localRecords||footer.truthLines!==truthLines)throw new Error('Full workspace footer counts do not match streamed records.');const contentHash=hashLabel(hash);if(footer.contentHash!==contentHash)throw new Error('Full workspace content hash mismatch.');return{workspaceId:header.workspaceId,localRecords,truthLines,contentHash,valid:true};
}

/** Call after validateFullWorkspaceLines on a reopened stream. */
export async function restorePortableLocalState(lines:AsyncIterable<string>,storage:StorageLike,options:{overwrite?:boolean}={}):Promise<LocalStateRestoreResult>{
 let imported=0,skippedSame=0;const conflicts:string[]=[];for await(const raw of lines){const line=raw.trim();if(!line)continue;const record=parse(line);if(record.kind!=='local-state')continue;if(SECRET_KEY.test(record.key)||!record.key.startsWith('poker_'))throw new Error(`Unsafe local-state key ${record.key}.`);const existing=storage.getItem(record.key);if(existing===record.value){skippedSame++;continue;}if(existing!==null&&!options.overwrite){conflicts.push(record.key);continue;}storage.setItem(record.key,record.value);imported++;}return{imported,skippedSame,conflicts};
}

/** Extract the embedded P23 truth stream from a reopened full-workspace stream. */
export async function* extractTruthWorkspaceLines(lines:AsyncIterable<string>):AsyncGenerator<string>{for await(const raw of lines){const line=raw.trim();if(!line)continue;const record=parse(line);if(record.kind==='truth-line')yield record.line;}}

export function validateWorkspaceSyncRevision(raw:WorkspaceSyncRevision):WorkspaceSyncRevision{if(!raw||raw.schemaVersion!==1||!raw.revision||!raw.deviceId||!raw.workspaceId||!raw.contentHash||!Number.isFinite(Date.parse(raw.generatedAt)))throw new Error('Workspace sync revision requires identity, device, workspace, hash and timestamp.');if(raw.parentRevision===raw.revision)throw new Error('Workspace revision cannot parent itself.');return JSON.parse(JSON.stringify(raw)) as WorkspaceSyncRevision;}

/** Divergent revisions are conflicts by design; there is no silent last-write-wins. */
export function resolveWorkspaceSync(localRaw:WorkspaceSyncRevision,remoteRaw:WorkspaceSyncRevision):WorkspaceSyncResolution{
 const local=validateWorkspaceSyncRevision(localRaw),remote=validateWorkspaceSyncRevision(remoteRaw);if(local.workspaceId!==remote.workspaceId)return{status:'conflict',reason:'Workspace ids differ.'};if(local.revision===remote.revision&&local.contentHash===remote.contentHash)return{status:'same',reason:'Local and remote revisions are identical.'};if(remote.parentRevision===local.revision)return{status:'accept-remote',reason:'Remote is a direct descendant of local.'};if(local.parentRevision===remote.revision)return{status:'keep-local',reason:'Local is a direct descendant of remote.'};return{status:'conflict',reason:'Local and remote histories diverged or lack a direct ancestry proof; manual merge/export is required.'};
}
