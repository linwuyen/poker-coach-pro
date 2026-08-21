import { canonicalBoard, canonicalHoleCombo, canonicalPostflopContext } from './context';
import { PostflopAction, PostflopTruthNode, PostflopTruthPackV3 } from './types';

const ACTIONS: PostflopAction[] = ['check', 'bet', 'call', 'raise', 'fold', 'allIn'];

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function stablePostflopNodeHash(node: PostflopTruthNode): string {
  const canonical = stableStringify({
    schemaVersion: node.schemaVersion,
    id: node.id,
    version: node.version,
    context: canonicalPostflopContext(node.context),
    source: node.source,
    strategyByCombo: node.strategyByCombo,
    evByCombo: node.evByCombo,
    actionSizesPot: node.actionSizesPot,
  });
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function validateActionMap(nodeId: string, combo: string, map: Record<string, unknown>, label: string): void {
  Object.entries(map).forEach(([action, value]) => {
    if (!ACTIONS.includes(action as PostflopAction)) throw new Error(`${nodeId}:${combo} unknown ${label} action ${action}.`);
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${nodeId}:${combo}:${action} ${label} must be finite.`);
  });
}

export function validatePostflopTruthNode(input: PostflopTruthNode): PostflopTruthNode {
  if (!input || input.schemaVersion !== 3) throw new Error('Postflop truth node schemaVersion must be 3.');
  if (!input.id || !input.version || !input.name) throw new Error('Postflop truth node requires id, version and name.');
  if (input.source?.trustTier !== 'verified-solver' || input.source?.type !== 'solver') throw new Error(`${input.id}: v3 automatic truth requires verified solver provenance.`);
  if (!input.source.reference || !input.source.solverName || !input.source.generatedAt) throw new Error(`${input.id}: solver reference/name/generatedAt are required.`);
  if (!Number.isFinite(Date.parse(input.source.generatedAt))) throw new Error(`${input.id}: invalid source generatedAt.`);
  const context = canonicalPostflopContext(input.context);
  if (context.playersInHand !== 2) throw new Error(`${input.id}: v3 exact auto-grading is heads-up only.`);
  if (![3,4,5].includes(context.board.length)) throw new Error(`${input.id}: invalid board length.`);
  const expectedBoard = context.street === 'Flop' ? 3 : context.street === 'Turn' ? 4 : 5;
  if (context.board.length !== expectedBoard) throw new Error(`${input.id}: board length does not match street.`);
  for (const value of [context.effectiveStackBB, context.potBB, context.spr, context.toCallBB]) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${input.id}: invalid numeric postflop context.`);
  }
  const strategy: PostflopTruthNode['strategyByCombo'] = {};
  Object.entries(input.strategyByCombo || {}).forEach(([rawCombo, frequencies]) => {
    const cards = rawCombo.match(/([2-9TJQKA][shdc])/gi);
    if (!cards || cards.length !== 2) throw new Error(`${input.id}: invalid exact combo ${rawCombo}.`);
    const combo = canonicalHoleCombo(cards);
    if (combo !== rawCombo) throw new Error(`${input.id}: combo ${rawCombo} must use canonical key ${combo}.`);
    validateActionMap(input.id, combo, frequencies as Record<string, unknown>, 'frequency');
    const total = Object.values(frequencies).reduce((sum, value) => sum + (Number(value) || 0), 0);
    if (total <= 0 || total > 1.0001 || Object.values(frequencies).some(value => (value || 0) < 0)) throw new Error(`${input.id}:${combo} frequencies must be in [0,1] and sum to <= 1.`);
    strategy[combo] = { ...frequencies };
  });
  if (!Object.keys(strategy).length) throw new Error(`${input.id}: verified postflop node requires strategy frequencies.`);
  Object.entries(input.evByCombo || {}).forEach(([combo, ev]) => {
    if (!strategy[combo]) throw new Error(`${input.id}: EV combo ${combo} has no strategy row.`);
    validateActionMap(input.id, combo, ev as Record<string, unknown>, 'EV');
  });
  Object.entries(input.actionSizesPot || {}).forEach(([action, sizes]) => {
    if (!['bet','raise','allIn'].includes(action)) throw new Error(`${input.id}: invalid action size key ${action}.`);
    if (!Array.isArray(sizes) || sizes.some(value => !Number.isFinite(value) || value < 0)) throw new Error(`${input.id}:${action} sizes must be finite non-negative pot fractions.`);
  });
  const node: PostflopTruthNode = { ...input, context, strategyByCombo: strategy, immutable: true };
  node.contentHash = stablePostflopNodeHash(node);
  return node;
}

export function importPostflopTruthPack(raw: string | PostflopTruthPackV3, existing: PostflopTruthNode[] = []): { nodes: PostflopTruthNode[]; skipped: string[] } {
  const pack = typeof raw === 'string' ? JSON.parse(raw) as PostflopTruthPackV3 : raw;
  if (!pack || pack.schemaVersion !== 3 || !pack.packId || !pack.version || !pack.sourceReference || !Array.isArray(pack.nodes)) throw new Error('Invalid postflop truth pack v3.');
  if (!Number.isFinite(Date.parse(pack.exportedAt))) throw new Error('Postflop truth pack exportedAt is invalid.');
  const known = new Map(existing.map(node => [`${node.id}@${node.version}`, node]));
  const imported: PostflopTruthNode[] = [];
  const skipped: string[] = [];
  for (const candidate of pack.nodes) {
    const node = validatePostflopTruthNode(candidate);
    const key = `${node.id}@${node.version}`;
    const previous = known.get(key);
    if (previous) {
      const previousHash = previous.contentHash || stablePostflopNodeHash(previous);
      if (previousHash !== node.contentHash) throw new Error(`${key} is immutable; publish a new version.`);
      skipped.push(key);
      continue;
    }
    known.set(key, node);
    imported.push(node);
  }
  return { nodes: imported, skipped };
}

export function mergeImmutablePostflopNodes(existing: PostflopTruthNode[], incoming: PostflopTruthNode[]): PostflopTruthNode[] {
  const result = [...existing];
  const known = new Map(existing.map(node => [`${node.id}@${node.version}`, node]));
  for (const candidate of incoming) {
    const node = validatePostflopTruthNode(candidate);
    const key = `${node.id}@${node.version}`;
    const previous = known.get(key);
    if (previous && (previous.contentHash || stablePostflopNodeHash(previous)) !== node.contentHash) throw new Error(`${key} cannot be mutated.`);
    if (!previous) { known.set(key, node); result.push(node); }
  }
  return result;
}
