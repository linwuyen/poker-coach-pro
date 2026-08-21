import { canonicalHoleCombo, postflopContextKey } from './context';
import { stablePostflopNodeHash, validatePostflopTruthNode } from './importer';
import { PostflopTruthContext, PostflopTruthNode, PostflopTruthPackV3, PostflopTruthQuery } from './types';

export interface TruthPackManifest {
  key: string;
  packId: string;
  version: string;
  importedAt: string;
  sourceReference: string;
  nodeCount: number;
  skippedCount: number;
  contentBytes: number;
}

export interface TruthStoreDiagnostics {
  backend: 'indexeddb' | 'memory';
  nodes: number;
  contexts: number;
  packs: number;
  approximateBytes: number;
}

export interface PostflopTruthStore {
  readonly backend: 'indexeddb' | 'memory';
  putPack(pack: PostflopTruthPackV3): Promise<{ imported: number; skipped: number }>;
  putNodes(nodes: PostflopTruthNode[], manifest?: Omit<TruthPackManifest, 'nodeCount' | 'skippedCount' | 'contentBytes'>): Promise<{ imported: number; skipped: number }>;
  findExact(query: PostflopTruthQuery): Promise<PostflopTruthNode | undefined>;
  getNode(key: string): Promise<PostflopTruthNode | undefined>;
  listNodes(limit?: number): Promise<PostflopTruthNode[]>;
  listManifests(): Promise<TruthPackManifest[]>;
  diagnostics(): Promise<TruthStoreDiagnostics>;
  clear(): Promise<void>;
}

interface StoredNode {
  key: string;
  contextKey: string;
  node: PostflopTruthNode;
  bytes: number;
}

function nodeKey(node: PostflopTruthNode): string { return `${node.id}@${node.version}`; }

function queryContextKey(query: PostflopTruthQuery): string | undefined {
  const required: Array<keyof PostflopTruthContext> = [
    'format','tableSize','street','heroPosition','villainPosition','playersInHand','effectiveStackBB','potBB','spr','toCallBB','board','preflopLine','streetLine',
  ];
  if (required.some(key => query[key] === undefined)) return undefined;
  try { return postflopContextKey(query as PostflopTruthContext); } catch { return undefined; }
}

function exactComboExists(node: PostflopTruthNode, query: PostflopTruthQuery): boolean {
  if (!query.heroCards) return false;
  try { return Boolean(node.strategyByCombo[canonicalHoleCombo(query.heroCards)]); } catch { return false; }
}

function bytesOf(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

class MemoryTruthStore implements PostflopTruthStore {
  readonly backend = 'memory' as const;
  private nodes = new Map<string, StoredNode>();
  private contexts = new Map<string, Set<string>>();
  private manifests = new Map<string, TruthPackManifest>();

  async putPack(pack: PostflopTruthPackV3) {
    if (!pack || pack.schemaVersion !== 3 || !pack.packId || !pack.version || !pack.sourceReference || !Array.isArray(pack.nodes)) throw new Error('Invalid postflop truth pack v3.');
    const result = await this.putNodes(pack.nodes, { key: `${pack.packId}@${pack.version}`, packId: pack.packId, version: pack.version, importedAt: new Date().toISOString(), sourceReference: pack.sourceReference });
    return result;
  }

  async putNodes(nodes: PostflopTruthNode[], manifest?: Omit<TruthPackManifest, 'nodeCount' | 'skippedCount' | 'contentBytes'>) {
    let imported = 0; let skipped = 0; let contentBytes = 0;
    for (const candidate of nodes) {
      const node = validatePostflopTruthNode(candidate);
      const key = nodeKey(node); const existing = this.nodes.get(key);
      if (existing) {
        const previousHash = existing.node.contentHash || stablePostflopNodeHash(existing.node);
        if (previousHash !== node.contentHash) throw new Error(`${key} is immutable; publish a new version.`);
        skipped += 1; continue;
      }
      const contextKey = postflopContextKey(node.context); const bytes = bytesOf(node);
      this.nodes.set(key, { key, contextKey, node, bytes });
      const keys = this.contexts.get(contextKey) || new Set<string>(); keys.add(key); this.contexts.set(contextKey, keys);
      contentBytes += bytes; imported += 1;
    }
    if (manifest) this.manifests.set(manifest.key, { ...manifest, nodeCount: imported, skippedCount: skipped, contentBytes });
    return { imported, skipped };
  }

  async findExact(query: PostflopTruthQuery) {
    const contextKey = queryContextKey(query); if (!contextKey) return undefined;
    const keys = [...(this.contexts.get(contextKey) || [])];
    const candidates = keys.map(key => this.nodes.get(key)?.node).filter((node): node is PostflopTruthNode => Boolean(node && node.source.trustTier === 'verified-solver' && exactComboExists(node, query)));
    return candidates.length === 1 ? candidates[0] : undefined;
  }
  async getNode(key: string) { return this.nodes.get(key)?.node; }
  async listNodes(limit = Number.MAX_SAFE_INTEGER) { return [...this.nodes.values()].slice(0, limit).map(item => item.node); }
  async listManifests() { return [...this.manifests.values()].sort((a,b) => b.importedAt.localeCompare(a.importedAt)); }
  async diagnostics() { return { backend: this.backend, nodes: this.nodes.size, contexts: this.contexts.size, packs: this.manifests.size, approximateBytes: [...this.nodes.values()].reduce((sum,item)=>sum+item.bytes,0) }; }
  async clear() { this.nodes.clear(); this.contexts.clear(); this.manifests.clear(); }
}

const DB_NAME = 'poker-coach-truth-v3';
const DB_VERSION = 1;
const NODE_STORE = 'nodes';
const PACK_STORE = 'packs';
const CONTEXT_INDEX = 'contextKey';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(NODE_STORE)) {
        const store = db.createObjectStore(NODE_STORE, { keyPath: 'key' });
        store.createIndex(CONTEXT_INDEX, 'contextKey', { unique: false });
      }
      if (!db.objectStoreNames.contains(PACK_STORE)) db.createObjectStore(PACK_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted.')); });
}

class IndexedDbTruthStore implements PostflopTruthStore {
  readonly backend = 'indexeddb' as const;
  async putPack(pack: PostflopTruthPackV3) {
    if (!pack || pack.schemaVersion !== 3 || !pack.packId || !pack.version || !pack.sourceReference || !Array.isArray(pack.nodes)) throw new Error('Invalid postflop truth pack v3.');
    return this.putNodes(pack.nodes, { key: `${pack.packId}@${pack.version}`, packId: pack.packId, version: pack.version, importedAt: new Date().toISOString(), sourceReference: pack.sourceReference });
  }
  async putNodes(nodes: PostflopTruthNode[], manifest?: Omit<TruthPackManifest, 'nodeCount' | 'skippedCount' | 'contentBytes'>) {
    const db = await openDb();
    let imported = 0; let skipped = 0; let contentBytes = 0;
    try {
      for (const candidate of nodes) {
        const node = validatePostflopTruthNode(candidate); const key = nodeKey(node);
        const readTx = db.transaction(NODE_STORE, 'readonly');
        const existing = await requestValue(readTx.objectStore(NODE_STORE).get(key) as IDBRequest<StoredNode | undefined>);
        if (existing) {
          const previousHash = existing.node.contentHash || stablePostflopNodeHash(existing.node);
          if (previousHash !== node.contentHash) throw new Error(`${key} is immutable; publish a new version.`);
          skipped += 1; continue;
        }
        const record: StoredNode = { key, contextKey: postflopContextKey(node.context), node, bytes: bytesOf(node) };
        const writeTx = db.transaction(NODE_STORE, 'readwrite'); writeTx.objectStore(NODE_STORE).add(record); await transactionDone(writeTx);
        imported += 1; contentBytes += record.bytes;
      }
      if (manifest) {
        const tx = db.transaction(PACK_STORE, 'readwrite'); tx.objectStore(PACK_STORE).put({ ...manifest, nodeCount: imported, skippedCount: skipped, contentBytes }); await transactionDone(tx);
      }
      return { imported, skipped };
    } finally { db.close(); }
  }
  async findExact(query: PostflopTruthQuery) {
    const contextKey = queryContextKey(query); if (!contextKey) return undefined;
    const db = await openDb();
    try {
      const tx = db.transaction(NODE_STORE, 'readonly');
      const records = await requestValue(tx.objectStore(NODE_STORE).index(CONTEXT_INDEX).getAll(contextKey) as IDBRequest<StoredNode[]>);
      const candidates = records.map(record => record.node).filter(node => node.source.trustTier === 'verified-solver' && exactComboExists(node, query));
      return candidates.length === 1 ? candidates[0] : undefined;
    } finally { db.close(); }
  }
  async getNode(key: string) { const db = await openDb(); try { return (await requestValue(db.transaction(NODE_STORE,'readonly').objectStore(NODE_STORE).get(key) as IDBRequest<StoredNode | undefined>))?.node; } finally { db.close(); } }
  async listNodes(limit = 1000) {
    const db = await openDb(); try {
      const all = await requestValue(db.transaction(NODE_STORE,'readonly').objectStore(NODE_STORE).getAll(undefined, limit) as IDBRequest<StoredNode[]>); return all.map(item => item.node);
    } finally { db.close(); }
  }
  async listManifests() { const db = await openDb(); try { return (await requestValue(db.transaction(PACK_STORE,'readonly').objectStore(PACK_STORE).getAll() as IDBRequest<TruthPackManifest[]>)).sort((a,b)=>b.importedAt.localeCompare(a.importedAt)); } finally { db.close(); } }
  async diagnostics() {
    const db = await openDb(); try {
      const tx = db.transaction([NODE_STORE, PACK_STORE], 'readonly'); const nodeStore = tx.objectStore(NODE_STORE);
      const nodes = await requestValue(nodeStore.count()); const packs = await requestValue(tx.objectStore(PACK_STORE).count());
      const records = await requestValue(nodeStore.getAll() as IDBRequest<StoredNode[]>); const contexts = new Set(records.map(item => item.contextKey)).size;
      return { backend: this.backend, nodes, contexts, packs, approximateBytes: records.reduce((sum,item)=>sum+item.bytes,0) };
    } finally { db.close(); }
  }
  async clear() { const db = await openDb(); try { const tx = db.transaction([NODE_STORE,PACK_STORE],'readwrite'); tx.objectStore(NODE_STORE).clear(); tx.objectStore(PACK_STORE).clear(); await transactionDone(tx); } finally { db.close(); } }
}

let singleton: PostflopTruthStore | undefined;
export function createPostflopTruthStore(forceMemory = false): PostflopTruthStore {
  if (forceMemory || typeof indexedDB === 'undefined') return new MemoryTruthStore();
  return new IndexedDbTruthStore();
}
export function getPostflopTruthStore(): PostflopTruthStore {
  if (!singleton) singleton = createPostflopTruthStore();
  return singleton;
}

export async function importPostflopTruthNdjson(lines: AsyncIterable<string>, store: PostflopTruthStore, meta: { packId: string; version: string; sourceReference: string }): Promise<{ imported: number; skipped: number }> {
  let imported = 0; let skipped = 0;
  for await (const raw of lines) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const result = await store.putNodes([JSON.parse(line) as PostflopTruthNode]); imported += result.imported; skipped += result.skipped;
  }
  const manifest: TruthPackManifest = { key: `${meta.packId}@${meta.version}`, packId: meta.packId, version: meta.version, importedAt: new Date().toISOString(), sourceReference: meta.sourceReference, nodeCount: imported, skippedCount: skipped, contentBytes: 0 };
  // Store a zero-node manifest without re-writing truth nodes.
  await store.putNodes([], manifest);
  return { imported, skipped };
}

export async function* textFileLines(file: Blob): AsyncGenerator<string> {
  const stream = file.stream().pipeThrough(new TextDecoderStream());
  const reader = stream.getReader(); let pending = '';
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      pending += value; const parts = pending.split(/\r?\n/); pending = parts.pop() || '';
      for (const line of parts) yield line;
    }
    if (pending) yield pending;
  } finally { reader.releaseLock(); }
}
