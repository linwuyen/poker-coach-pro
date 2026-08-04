import { getAllStartingHands, normalizeFrequencies, normalizeHand } from './engine';
import { SolverImportEnvelope, StrategyProfile } from './types';

export interface ProfileValidationResult {
  profile: StrategyProfile;
  warnings: string[];
}

export function stableProfileHash(profile: StrategyProfile): string {
  const canonical = stableStringify({
    schemaVersion: profile.schemaVersion,
    id: profile.id,
    version: profile.version,
    context: profile.context,
    source: profile.source,
    ranges: profile.ranges,
    evByHand: profile.evByHand,
    actionSizesBB: profile.actionSizesBB,
  });
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function validateStrategyProfile(input: StrategyProfile): ProfileValidationResult {
  if (!input || input.schemaVersion !== 2) throw new Error('Strategy profile schemaVersion must be 2.');
  if (!input.id || !input.version || !input.name) throw new Error('Strategy profile requires id, version and name.');
  if (!input.context?.format || !input.context?.tableSize || !input.context?.spot || !input.context?.position) {
    throw new Error(`${input.id}: incomplete strategy context.`);
  }
  if (!Number.isFinite(input.context.stackDepthBB) || input.context.stackDepthBB <= 0) throw new Error(`${input.id}: invalid stackDepthBB.`);
  if (!input.source?.trustTier || !input.source?.generatedAt || !input.source?.disclaimer) throw new Error(`${input.id}: incomplete source metadata.`);
  if (input.source.type === 'solver' && input.source.trustTier !== 'verified-solver') {
    throw new Error(`${input.id}: solver source must use verified-solver trust tier.`);
  }
  if (input.source.trustTier === 'verified-solver' && (!input.source.solverName || !input.source.reference)) {
    throw new Error(`${input.id}: verified solver profile requires solverName and reference.`);
  }

  const warnings: string[] = [];
  const validHands = new Set(getAllStartingHands());
  Object.entries(input.ranges || {}).forEach(([hand, frequency]) => {
    const normalizedHand = normalizeHand(hand);
    if (normalizedHand !== hand || !validHands.has(hand)) throw new Error(`${input.id}: invalid canonical hand ${hand}.`);
    const normalized = normalizeFrequencies(frequency);
    const suppliedTotal = Object.values(frequency).reduce((sum, value) => sum + (Number(value) || 0), 0);
    if (suppliedTotal > 1.0001) warnings.push(`${input.id}:${hand} frequencies normalized from ${suppliedTotal.toFixed(3)}.`);
    if (Object.values(normalized).some(value => value < 0 || value > 1)) throw new Error(`${input.id}:${hand} frequency out of bounds.`);
  });
  Object.keys(input.evByHand || {}).forEach(hand => {
    if (!validHands.has(normalizeHand(hand))) throw new Error(`${input.id}: invalid EV hand ${hand}.`);
  });

  const profile = { ...input, immutable: true };
  profile.contentHash = stableProfileHash(profile);
  return { profile, warnings };
}

export function importSolverEnvelope(
  raw: string | SolverImportEnvelope,
  existingProfiles: StrategyProfile[] = [],
): { profiles: StrategyProfile[]; warnings: string[] } {
  const envelope = typeof raw === 'string' ? JSON.parse(raw) as SolverImportEnvelope : raw;
  if (!envelope || envelope.schemaVersion !== 2 || !Array.isArray(envelope.profiles)) throw new Error('Invalid solver import envelope.');
  const existing = new Map(existingProfiles.map(profile => [`${profile.id}@${profile.version}`, profile]));
  const imported: StrategyProfile[] = [];
  const warnings: string[] = [];

  envelope.profiles.forEach(candidate => {
    const validated = validateStrategyProfile(candidate);
    const key = `${validated.profile.id}@${validated.profile.version}`;
    const previous = existing.get(key);
    if (previous) {
      const previousHash = previous.contentHash || stableProfileHash(previous);
      if (previousHash !== validated.profile.contentHash) {
        throw new Error(`${key} is immutable; publish a new version instead of replacing its content.`);
      }
      warnings.push(`${key} already exists and was skipped.`);
      return;
    }
    existing.set(key, validated.profile);
    imported.push(validated.profile);
    warnings.push(...validated.warnings);
  });
  return { profiles: imported, warnings };
}

export function mergeImmutableProfiles(existing: StrategyProfile[], incoming: StrategyProfile[]): StrategyProfile[] {
  const result = [...existing];
  const byVersion = new Map(existing.map(profile => [`${profile.id}@${profile.version}`, profile]));
  incoming.forEach(candidate => {
    const validated = validateStrategyProfile(candidate).profile;
    const key = `${validated.id}@${validated.version}`;
    const previous = byVersion.get(key);
    if (previous && (previous.contentHash || stableProfileHash(previous)) !== validated.contentHash) {
      throw new Error(`${key} cannot be mutated.`);
    }
    if (!previous) {
      byVersion.set(key, validated);
      result.push(validated);
    }
  });
  return result;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
