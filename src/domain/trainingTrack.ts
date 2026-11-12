import type { HistoryItem, PlayerProfile, Scenario, UtilityModel, UtilityUnit } from '../types';
import { POKERBENCH_FILES, POKERBENCH_SOURCE, type PokerBenchRow } from '../solver-data/pokerbench';
import { historyFormat } from '../learning-engine/contextIdentity';
import { DEFAULT_PLAYER_PROFILE, getStackBand } from './playerProfile';
import { isHiddenBenchmarkScenario } from '../learning-engine/benchmark';

export type TrainingTrack = 'cash' | 'tournament';
export const TRAINING_TRACK_KEY = 'poker_training_track_v1';
type TrackStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function loadTrainingTrack(profile = DEFAULT_PLAYER_PROFILE, storage: TrackStorage = localStorage): TrainingTrack {
  try {
    const saved = storage.getItem(TRAINING_TRACK_KEY);
    if ((saved === 'cash' || saved === 'tournament') && profile.formats.includes(saved)) return saved;
  } catch { /* An unavailable browser store does not prevent practice. */ }
  return profile.formats.includes('cash') ? 'cash' : 'tournament';
}

export function saveTrainingTrack(track: TrainingTrack, storage: TrackStorage = localStorage): TrainingTrack {
  try { storage.setItem(TRAINING_TRACK_KEY, track); } catch { /* Keep the current in-memory selection. */ }
  return track;
}

export function trainingTrackLabel(track: TrainingTrack): string { return track === 'cash' ? '現金桌 Cash' : '錦標賽 MTT'; }

export function scenarioMatchesTrainingTrack(scenario: Scenario, track: TrainingTrack, profile: PlayerProfile): boolean {
  if (!profile.formats.includes(track) || (scenario.type === 'Tournament' ? 'tournament' : 'cash') !== track) return false;
  if (!scenario.tableSize || !profile.tableSizes.includes(scenario.tableSize)) return false;
  if (!Number.isFinite(scenario.userBB) || !profile.stackBands.includes(getStackBand(scenario.userBB))) return false;
  const text = `${scenario.title} ${(scenario.category || []).join(' ')} ${scenario.steps.flatMap(step => step.conceptIds || []).join(' ')}`;
  return scenario.steps.length > 0 && scenario.steps.every(step => profile.focusAreas.some(focus => focus === 'mixed'
    || (focus === 'preflop' && step.street === 'Preflop')
    || (focus === 'postflop' && step.street !== 'Preflop')
    || (focus === 'short-stack' && scenario.userBB <= 25)
    || (focus === 'math' && /math|odds|equity|SPR|數學|賠率|ICM|PKO|satellite/i.test(text))
    || (focus === 'bluff-catching' && /抓詐唬|bluff.?catch/i.test(text))));
}

export function isAssessmentScenario(scenario: Scenario): boolean {
  return scenario.steps.length > 0 && scenario.steps.every(step => step.options.length > 0 && step.options.every(action => {
    const confidence = step.feedbacks[action]?.evidence?.sourceConfidence;
    return confidence === 'exact-math' || confidence === 'verified-solver';
  }));
}

export function trainingTrackCoverageCatalog(bank: Scenario[], assessments: Scenario[], track: TrainingTrack, profile: PlayerProfile): Scenario[] {
  const scoped = [...bank, ...assessments].filter(scenario => scenarioMatchesTrainingTrack(scenario, track, profile)
    && (!isHiddenBenchmarkScenario(scenario) || isAssessmentScenario(scenario)));
  return [...new Map(scoped.map(scenario => [scenario.id, scenario])).values()];
}

/** Starting 100BB is not a remaining effective-stack measurement: only unrestricted depths can include this corpus. */
export function pokerBenchMatchesTrainingTrack(row: PokerBenchRow, track: TrainingTrack, profile: PlayerProfile): boolean {
  if (track !== 'cash' || !profile.formats.includes('cash') || !profile.tableSizes.includes('6max')
    || !DEFAULT_PLAYER_PROFILE.stackBands.every(band => profile.stackBands.includes(band))) return false;
  return profile.focusAreas.some(focus => focus === 'mixed'
    || (focus === 'preflop' && row.split === 'preflop')
    || (focus === 'postflop' && row.split === 'postflop'));
}

/** Stable provenance survives visible-context corrections, curriculum changes and missing legacy format tags. */
export function pokerBenchExposureIdentity(item: Pick<HistoryItem, 'datasetRowId' | 'datasetSplit' | 'truthSourceId' | 'scenarioId'>): string | undefined {
  if (!item.datasetRowId || (item.truthSourceId && item.truthSourceId !== POKERBENCH_SOURCE.id)) return undefined;
  const legacySplit = /^(?:exam-solver:(preflop|postflop):|(?:daily-solver|pokerbench|contrastive|semantic):(preflop_1k_test|postflop_10k_test):)/.exec(item.scenarioId || '');
  const split = item.datasetSplit || (legacySplit?.[1] ? POKERBENCH_FILES[legacySplit[1] as 'preflop' | 'postflop'].split : legacySplit?.[2]);
  if (!Object.values(POKERBENCH_FILES).some(file => file.split === split)) return undefined;
  return `solver:${POKERBENCH_SOURCE.id}:${split}:${item.datasetRowId}`;
}

export function historyForTrainingTrack(history: HistoryItem[], track: TrainingTrack): HistoryItem[] {
  const format = track === 'cash' ? 'Cash' : 'MTT';
  return history.filter(item => (historyFormat(item) || (pokerBenchExposureIdentity(item) ? 'Cash' : undefined)) === format);
}

export function tournamentEvaluationGroups(history: HistoryItem[]): Array<{ model: UtilityModel; unit: UtilityUnit; samples: number; averageLoss: number }> {
  const groups = new Map<string, { model: UtilityModel; unit: UtilityUnit; samples: number; total: number }>();
  for (const item of historyForTrainingTrack(history, 'tournament')) {
    if (!item.examMode || !item.examCompletedAt || !item.utilityModel || !item.utilityUnit || item.utilityModel === 'cash-chip-ev'
      || (item.truthTier !== 'exact-math' && item.truthTier !== 'verified-solver') || typeof item.utilityLoss !== 'number' || !Number.isFinite(item.utilityLoss)) continue;
    const key = `${item.utilityModel}:${item.utilityUnit}`;
    const group = groups.get(key) || { model: item.utilityModel, unit: item.utilityUnit, samples: 0, total: 0 };
    group.samples += 1;
    group.total += Math.max(0, item.utilityLoss);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ model, unit, samples, total }) => ({ model, unit, samples, averageLoss: total / samples }));
}
