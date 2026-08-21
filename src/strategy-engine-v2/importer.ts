import { getAllStartingHands, normalizeFrequencies, normalizeHand } from './engine';
import { SolverImportEnvelope, StrategyAction, StrategyProfile } from './types';

export interface ProfileValidationResult {
  profile: StrategyProfile;
  warnings: string[];
}

export interface StrategySurfaceCapabilities {
  frequencyHands: number;
  evHands: number;
  mixedHands: number;
  hasFrequencies: boolean;
  hasPerActionEv: boolean;
  hasMixedStrategy: boolean;
}

const STRATEGY_ACTIONS: StrategyAction[] = ['raise', 'call', 'limp', 'fold', 'allIn'];

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

function validateActionMap(profileId: string, hand: string, values: Record<string, unknown>, label: string): void {
  Object.entries(values).forEach(([action, value]) => {
    if (!STRATEGY_ACTIONS.includes(action as StrategyAction)) throw new Error(`${profileId}:${hand} unknown ${label} action ${action}.`);
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${profileId}:${hand}:${action} ${label} must be finite.`);
  });
}

export function strategySurfaceCapabilities(profile: StrategyProfile): StrategySurfaceCapabilities {
  const entries = Object.entries(profile.ranges || {});
  const evEntries = Object.entries(profile.evByHand || {});
  const mixedHands = entries.filter(([, frequency]) => {
    const normalized = normalizeFrequencies(frequency);
    return STRATEGY_ACTIONS.filter(action => normalized[action] > 0.0001).length >= 2;
  }).length;
  return {
    frequencyHands: entries.length,
    evHands: evEntries.length,
    mixedHands,
    hasFrequencies: entries.length > 0,
    hasPerActionEv: evEntries.some(([, values]) => Object.keys(values || {}).length >= 2),
    hasMixedStrategy: mixedHands > 0,
  };
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
    validateActionMap(input.id, hand, frequency as Record<string, unknown>, 'frequency');
    Object.values(frequency).forEach(value => {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${input.id}:${hand} frequency must be finite and non-negative.`);
    });
    const normalized = normalizeFrequencies(frequency);
    const suppliedTotal = Object.values(frequency).reduce((sum, value) => sum + (Number(value) || 0), 0);
    if (suppliedTotal > 1.0001) warnings.push(`${input.id}:${hand} frequencies normalized from ${suppliedTotal.toFixed(3)}.`);
    if (Object.values(normalized).some(value => value < 0 || value > 1)) throw new Error(`${input.id}:${hand} frequency out of bounds.`);
  });
  Object.entries(input.evByHand || {}).forEach(([hand, actionEv]) => {
    const normalizedHand = normalizeHand(hand);
    if (normalizedHand !== hand || !validHands.has(hand)) throw new Error(`${input.id}: invalid canonical EV hand ${hand}.`);
    validateActionMap(input.id, hand, actionEv as Record<string, unknown>, 'EV');
  });
  Object.entries(input.actionSizesBB || {}).forEach(([action, sizes]) => {
    if (!STRATEGY_ACTIONS.includes(action as StrategyAction)) throw new Error(`${input.id}: unknown action size action ${action}.`);
    if (!Array.isArray(sizes) || sizes.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      throw new Error(`${input.id}:${action} actionSizesBB must contain finite non-negative values.`);
    }
  });

  const capabilities = strategySurfaceCapabilities(input);
  if (input.source.trustTier === 'verified-solver' && !capabilities.hasFrequencies) throw new Error(`${input.id}: verified solver surface requires frequency data.`);
  if (capabilities.hasPerActionEv && !input.source.reference) throw new Error(`${input.id}: per-action EV data requires a provenance reference.`);
  if (input.source.type === 'solver' && !input.source.solverVersion) warnings.push(`${input.id}: solverVersion is recommended for reproducibility.`);

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
