import { mergeImmutableProfiles, validateStrategyProfile } from './importer';
import { HandActionEv, PartialActionFrequency, StrategyContext, StrategyProfile } from './types';

export const MIN_POPULATION_SAMPLE = 1000;

export interface PopulationExploitSource {
  label: string;
  reference: string;
  generatedAt: string;
  sampleSize: number;
  methodology: string;
  population: string;
  reviewedBy?: string[];
}

export interface PopulationExploitProfile {
  schemaVersion: 1;
  id: string;
  version: string;
  name: string;
  description: string;
  context: StrategyContext;
  source: PopulationExploitSource;
  exploitRanges: Record<string, PartialActionFrequency>;
  /** Optional modeled EV is accepted only when the source declares its EV methodology. */
  evByHand?: Record<string, HandActionEv>;
  evMethodology?: string;
  tags?: string[];
}

export interface PopulationExploitEnvelope {
  schemaVersion: 1;
  exportedAt: string;
  profiles: PopulationExploitProfile[];
  exporter?: string;
}

export function populationContextKey(context: StrategyContext): string {
  return [context.format, context.tableSize, context.spot, context.position, context.villainPosition || '-', context.stackDepthBB, context.anteBB, context.openSizeBB ?? '-'].join('|');
}

export function populationProfileToStrategyProfile(input: PopulationExploitProfile): StrategyProfile {
  if (!input || input.schemaVersion !== 1) throw new Error('Population exploit profile schemaVersion must be 1.');
  if (!input.id || !input.version || !input.name) throw new Error('Population exploit profile requires id, version and name.');
  if (!input.source?.reference || !input.source?.methodology || !input.source?.population || !input.source?.generatedAt) {
    throw new Error(`${input.id}: population exploit requires reference, methodology, population and generatedAt.`);
  }
  if (!Number.isFinite(input.source.sampleSize) || input.source.sampleSize < MIN_POPULATION_SAMPLE) {
    throw new Error(`${input.id}: population sampleSize must be at least ${MIN_POPULATION_SAMPLE}.`);
  }
  if (!input.exploitRanges || !Object.keys(input.exploitRanges).length) throw new Error(`${input.id}: exploitRanges cannot be empty.`);
  if (input.evByHand && !input.evMethodology) throw new Error(`${input.id}: EV data requires evMethodology.`);
  const profile: StrategyProfile = {
    schemaVersion: 2,
    id: `population:${input.id}`,
    version: input.version,
    name: input.name,
    description: input.description,
    context: input.context,
    source: {
      type: 'population',
      trustTier: 'population-exploit',
      label: input.source.label,
      reference: input.source.reference,
      generatedAt: input.source.generatedAt,
      authoredBy: input.source.population,
      reviewedBy: input.source.reviewedBy,
      sampleSize: input.source.sampleSize,
      disclaimer: `Population exploit supplied by external evidence. Methodology: ${input.source.methodology}${input.evMethodology ? ` EV: ${input.evMethodology}` : ''}`,
    },
    ranges: input.exploitRanges,
    evByHand: input.evByHand,
    tags: [...(input.tags || []), 'population-exploit', `population:${input.source.population}`],
    mode: 'exploit',
  };
  return validateStrategyProfile(profile).profile;
}

export function importPopulationExploitEnvelope(
  raw: string | PopulationExploitEnvelope,
  existingProfiles: StrategyProfile[] = [],
): { profiles: StrategyProfile[]; warnings: string[] } {
  const envelope = typeof raw === 'string' ? JSON.parse(raw) as PopulationExploitEnvelope : raw;
  if (!envelope || envelope.schemaVersion !== 1 || !Array.isArray(envelope.profiles)) throw new Error('Invalid population exploit envelope.');
  const converted = envelope.profiles.map(populationProfileToStrategyProfile);
  const merged = mergeImmutableProfiles(existingProfiles, converted);
  const existingKeys = new Set(existingProfiles.map(profile => `${profile.id}@${profile.version}`));
  const profiles = merged.filter(profile => !existingKeys.has(`${profile.id}@${profile.version}`));
  return { profiles, warnings: [] };
}

export function isEvidenceBackedPopulationProfile(profile: StrategyProfile): boolean {
  return profile.source.type === 'population'
    && profile.source.trustTier === 'population-exploit'
    && Boolean(profile.source.reference)
    && typeof profile.source.sampleSize === 'number'
    && profile.source.sampleSize >= MIN_POPULATION_SAMPLE;
}
