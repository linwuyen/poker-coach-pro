import { ObservedPopulationCohort } from './populationObservation';
import { TournamentMetadataV1, validateTournamentMetadata } from './tournamentReconstruction';

export const OBSERVED_POPULATION_STORAGE_KEY = 'poker_observed_population_cohorts_v1';
export const TOURNAMENT_METADATA_STORAGE_KEY = 'poker_tournament_metadata_v1';

export function loadObservedPopulationCohorts(): ObservedPopulationCohort[] {
  try {
    const raw = JSON.parse(localStorage.getItem(OBSERVED_POPULATION_STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(item => item?.schemaVersion === 1 && item?.trust === 'measured-local-cohort') : [];
  } catch { return []; }
}

export function saveObservedPopulationCohort(cohort: ObservedPopulationCohort): void {
  const existing = loadObservedPopulationCohorts();
  const byId = new Map(existing.map(item => [`${item.id}@${item.version}`, item]));
  byId.set(`${cohort.id}@${cohort.version}`, cohort);
  localStorage.setItem(OBSERVED_POPULATION_STORAGE_KEY, JSON.stringify([...byId.values()].slice(-200)));
}

export function loadTournamentMetadata(): TournamentMetadataV1[] {
  try {
    const raw = JSON.parse(localStorage.getItem(TOURNAMENT_METADATA_STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    const valid: TournamentMetadataV1[] = [];
    for (const item of raw) {
      try { valid.push(validateTournamentMetadata(item)); } catch { /* invalid persisted metadata stays unavailable */ }
    }
    return valid;
  } catch { return []; }
}

export function saveTournamentMetadata(items: TournamentMetadataV1[]): void {
  const valid = items.map(validateTournamentMetadata);
  localStorage.setItem(TOURNAMENT_METADATA_STORAGE_KEY, JSON.stringify(valid));
}
