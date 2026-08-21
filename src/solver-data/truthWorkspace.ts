import { PostflopTruthNode, PostflopTruthStore, TruthPackManifest } from '../strategy-engine-v3';
import { validatePostflopTruthNode } from '../strategy-engine-v3/importer';
import { MultiwayTruthNodeV4, MultiwayTruthPackManifest, MultiwayTruthStore } from '../strategy-engine-v4';
import { validateMultiwayTruthNode } from '../strategy-engine-v4/importer';

export interface TruthWorkspaceHeader { kind:'workspace-header';schemaVersion:1;workspaceId:string;generatedAt:string; }
export interface TruthWorkspaceFooter { kind:'workspace-footer';v3Nodes:number;v4Nodes:number;v3Manifests:number;v4Manifests:number; }
type WorkspaceRecord = TruthWorkspaceHeader
 | {kind:'v3-manifest';manifest:TruthPackManifest}
 | {kind:'v4-manifest';manifest:MultiwayTruthPackManifest}
 | {kind:'v3-node';node:PostflopTruthNode}
 | {kind:'v4-node';node:MultiwayTruthNodeV4}
 | TruthWorkspaceFooter;

export interface TruthWorkspaceImportResult { workspaceId:string;validated:boolean;imported:boolean;v3Nodes:number;v4Nodes:number;v3Manifests:number;v4Manifests:number;skippedV3:number;skippedV4:number; }

function encode(record:WorkspaceRecord){return JSON.stringify(record);}
function parse(line:string):WorkspaceRecord{let value:unknown;try{value=JSON.parse(line);}catch{throw new Error('Truth workspace contains invalid JSON.');}if(!value||typeof value!=='object'||!('kind'in value))throw new Error('Truth workspace record is missing kind.');return value as WorkspaceRecord;}
function validateManifest(manifest:TruthPackManifest|MultiwayTruthPackManifest,label:string){if(!manifest?.key||!manifest.packId||!manifest.version||!manifest.sourceReference||!Number.isFinite(Date.parse(manifest.importedAt))||!Number.isInteger(manifest.nodeCount)||manifest.nodeCount<0||!Number.isInteger(manifest.skippedCount)||manifest.skippedCount<0||!Number.isFinite(manifest.contentBytes)||manifest.contentBytes<0)throw new Error(`Invalid ${label} manifest.`);}

/** Streaming export: no full v3/v4 node array is materialized in memory. */
export async function* exportTruthWorkspaceLines(v3:PostflopTruthStore,v4:MultiwayTruthStore,workspaceId=`truth-workspace-${Date.now()}`):AsyncGenerator<string>{
 const header:TruthWorkspaceHeader={kind:'workspace-header',schemaVersion:1,workspaceId,generatedAt:new Date().toISOString()};yield encode(header);
 const [m3,m4]=await Promise.all([v3.listManifests(),v4.listManifests()]);for(const manifest of m3)yield encode({kind:'v3-manifest',manifest});for(const manifest of m4)yield encode({kind:'v4-manifest',manifest});
 let v3Nodes=0,v4Nodes=0;for await(const node of v3.iterateNodes()){yield encode({kind:'v3-node',node});v3Nodes++;}for await(const node of v4.iterateNodes()){yield encode({kind:'v4-node',node});v4Nodes++;}
 yield encode({kind:'workspace-footer',v3Nodes,v4Nodes,v3Manifests:m3.length,v4Manifests:m4.length});
}

/** Writes UTF-8 NDJSON to a caller-owned stream (File System Access API, test sink, etc.). */
export async function streamTruthWorkspaceToWritable(v3:PostflopTruthStore,v4:MultiwayTruthStore,writable:WritableStream<Uint8Array>,workspaceId?:string):Promise<void>{
 const writer=writable.getWriter(),encoder=new TextEncoder();try{for await(const line of exportTruthWorkspaceLines(v3,v4,workspaceId))await writer.write(encoder.encode(`${line}\n`));}finally{await writer.close();}
}

/**
 * Validate-only should be run first for user-supplied files. Import is additive/immutable: it never clears existing truth.
 * A corrupted footer can therefore leave at most additional already-validated immutable nodes, never overwrite truth.
 */
export async function importTruthWorkspaceLines(lines:AsyncIterable<string>,v3:PostflopTruthStore,v4:MultiwayTruthStore,options:{validateOnly?:boolean}={}):Promise<TruthWorkspaceImportResult>{
 let header:TruthWorkspaceHeader|undefined,footer:TruthWorkspaceFooter|undefined,v3Nodes=0,v4Nodes=0,v3Manifests=0,v4Manifests=0,skippedV3=0,skippedV4=0;const manifests3:TruthPackManifest[]=[],manifests4:MultiwayTruthPackManifest[]=[];
 for await(const raw of lines){const line=raw.trim();if(!line||line.startsWith('#'))continue;const record=parse(line);
  if(record.kind==='workspace-header'){if(header)throw new Error('Truth workspace contains multiple headers.');if(record.schemaVersion!==1||!record.workspaceId||!Number.isFinite(Date.parse(record.generatedAt)))throw new Error('Invalid truth workspace header.');header=record;continue;}
  if(!header)throw new Error('Truth workspace header must be first.');
  if(record.kind==='workspace-footer'){if(footer)throw new Error('Truth workspace contains multiple footers.');footer=record;continue;}
  if(footer)throw new Error('No truth workspace records are allowed after the footer.');
  if(record.kind==='v3-manifest'){validateManifest(record.manifest,'v3');manifests3.push(record.manifest);v3Manifests++;continue;}
  if(record.kind==='v4-manifest'){validateManifest(record.manifest,'v4');manifests4.push(record.manifest);v4Manifests++;continue;}
  if(record.kind==='v3-node'){const node=validatePostflopTruthNode(record.node);v3Nodes++;if(!options.validateOnly){const result=await v3.putNodes([node]);skippedV3+=result.skipped;}continue;}
  if(record.kind==='v4-node'){const node=validateMultiwayTruthNode(record.node);v4Nodes++;if(!options.validateOnly){const result=await v4.putNodes([node]);skippedV4+=result.skipped;}continue;}
  throw new Error('Unsupported truth workspace record kind.');
 }
 if(!header||!footer)throw new Error('Truth workspace requires header and footer.');
 if(footer.v3Nodes!==v3Nodes||footer.v4Nodes!==v4Nodes||footer.v3Manifests!==v3Manifests||footer.v4Manifests!==v4Manifests)throw new Error('Truth workspace footer counts do not match streamed records.');
 if(!options.validateOnly){for(const manifest of manifests3)await v3.putManifest(manifest);for(const manifest of manifests4)await v4.putManifest(manifest);}
 return{workspaceId:header.workspaceId,validated:true,imported:!options.validateOnly,v3Nodes,v4Nodes,v3Manifests,v4Manifests,skippedV3,skippedV4};
}

export async function* blobLines(blob:Blob):AsyncGenerator<string>{const reader=blob.stream().pipeThrough(new TextDecoderStream()).getReader();let pending='';try{while(true){const{value,done}=await reader.read();if(done)break;pending+=value;const parts=pending.split(/\r?\n/);pending=parts.pop()||'';for(const line of parts)yield line;}if(pending)yield pending;}finally{reader.releaseLock();}}
