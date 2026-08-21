import { MIN_POPULATION_SAMPLE } from './population';

export interface PopulationMetric {
  id: string;
  label: string;
  numerator: number;
  denominator: number;
  rate: number;
}

export interface PopulationCohort {
  schemaVersion: 1;
  id: string;
  version: string;
  site: string;
  stake: string;
  game: string;
  tableSize?: string;
  population: string;
  observedFrom: string;
  observedTo: string;
  generatedAt: string;
  sampleSize: number;
  reference: string;
  methodology: string;
  metrics: PopulationMetric[];
  exploitProfileKeys?: string[];
}

export interface PopulationRegistryEnvelope {
  schemaVersion: 1;
  exportedAt: string;
  cohorts: PopulationCohort[];
  exporter?: string;
}

export interface PopulationRegistryReport {
  cohorts: number;
  totalSampleSize: number;
  sites: string[];
  stakes: string[];
  metricRows: number;
  linkedExploitProfiles: number;
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function validatePopulationCohort(input: PopulationCohort): PopulationCohort {
  if (!input || input.schemaVersion !== 1) throw new Error('Population cohort schemaVersion must be 1.');
  if (!input.id || !input.version || !input.site || !input.stake || !input.game || !input.population) {
    throw new Error('Population cohort requires id, version, site, stake, game and population.');
  }
  if (!input.reference || !input.methodology || !input.generatedAt || !input.observedFrom || !input.observedTo) {
    throw new Error(`${input.id}: population cohort requires provenance and observation window.`);
  }
  if (!Number.isFinite(input.sampleSize) || input.sampleSize < MIN_POPULATION_SAMPLE) {
    throw new Error(`${input.id}: population sampleSize must be at least ${MIN_POPULATION_SAMPLE}.`);
  }
  const from = Date.parse(input.observedFrom);
  const to = Date.parse(input.observedTo);
  const generated = Date.parse(input.generatedAt);
  if (![from, to, generated].every(Number.isFinite) || from > to || generated < to) {
    throw new Error(`${input.id}: invalid population observation/generated dates.`);
  }
  if (!Array.isArray(input.metrics) || !input.metrics.length) throw new Error(`${input.id}: at least one measured metric is required.`);
  const ids = new Set<string>();
  input.metrics.forEach(metric => {
    if (!metric.id || !metric.label || ids.has(metric.id)) throw new Error(`${input.id}: population metric ids must be unique and non-empty.`);
    ids.add(metric.id);
    if (!finiteNonNegative(metric.numerator) || !Number.isFinite(metric.denominator) || metric.denominator <= 0) {
      throw new Error(`${input.id}:${metric.id} numerator/denominator must be finite counts.`);
    }
    if (metric.numerator > metric.denominator) throw new Error(`${input.id}:${metric.id} numerator cannot exceed denominator.`);
    if (!Number.isFinite(metric.rate) || metric.rate < 0 || metric.rate > 1) throw new Error(`${input.id}:${metric.id} rate must be in [0,1].`);
    const observed = metric.numerator / metric.denominator;
    if (Math.abs(observed - metric.rate) > 0.0005) throw new Error(`${input.id}:${metric.id} rate must agree with numerator/denominator.`);
  });
  return JSON.parse(JSON.stringify(input)) as PopulationCohort;
}

export function importPopulationRegistry(
  raw: string | PopulationRegistryEnvelope,
  existing: PopulationCohort[] = [],
): { cohorts: PopulationCohort[]; warnings: string[] } {
  const envelope = typeof raw === 'string' ? JSON.parse(raw) as PopulationRegistryEnvelope : raw;
  if (!envelope || envelope.schemaVersion !== 1 || !Array.isArray(envelope.cohorts)) throw new Error('Invalid population registry envelope.');
  const byKey = new Map(existing.map(cohort => [`${cohort.id}@${cohort.version}`, cohort]));
  const imported: PopulationCohort[] = [];
  const warnings: string[] = [];
  envelope.cohorts.forEach(candidate => {
    const cohort = validatePopulationCohort(candidate);
    const key = `${cohort.id}@${cohort.version}`;
    const previous = byKey.get(key);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(cohort)) throw new Error(`${key} is immutable; publish a new version.`);
      warnings.push(`${key} already exists and was skipped.`);
      return;
    }
    byKey.set(key, cohort);
    imported.push(cohort);
  });
  return { cohorts: imported, warnings };
}

export function populationRegistryReport(cohorts: PopulationCohort[]): PopulationRegistryReport {
  const valid = cohorts.map(validatePopulationCohort);
  return {
    cohorts: valid.length,
    totalSampleSize: valid.reduce((sum, cohort) => sum + cohort.sampleSize, 0),
    sites: [...new Set(valid.map(cohort => cohort.site))].sort(),
    stakes: [...new Set(valid.map(cohort => cohort.stake))].sort(),
    metricRows: valid.reduce((sum, cohort) => sum + cohort.metrics.length, 0),
    linkedExploitProfiles: new Set(valid.flatMap(cohort => cohort.exploitProfileKeys || [])).size,
  };
}

export function findPopulationCohorts(
  cohorts: PopulationCohort[],
  query: Partial<Pick<PopulationCohort, 'site' | 'stake' | 'game' | 'tableSize' | 'population'>>,
): PopulationCohort[] {
  return cohorts.filter(cohort => Object.entries(query).every(([key, value]) => value === undefined || cohort[key as keyof PopulationCohort] === value));
}
