import { HistoryItem, PlayerProfile, Scenario, UtilityUnit } from '../../types';
import { filterRelevantScenarios } from '../../domain/playerProfile';
import { getWeaknessInsights, isDue, latestByMasteryKey } from '../../learning-engine';
import { getTrainingScenarios } from '../../learning-engine/benchmark';
import { canonicalDecisionFamilyId, historyDecisionFamilyId, scenarioDecisionFamilyId } from '../../learning-engine/contextIdentity';
import { EvGainEvidence, SpotFrequencySource, UtilityMode, rankByExpectedLearningValue } from '../../learning-engine/trainingValue';
import { recommendIntervention, TrainingIntervention } from '../../learning-engine/interventionRouter';

export type TrainingReason = 'due-review' | 'weak-area' | 'recent-mistake' | 'new' | 'benchmark' | 'mixed';
export interface PlannedScenario {
  scenario: Scenario;
  reason: TrainingReason;
  learningValue?: number;
  expectedEvGainPer100Hands?: number;
  expectedUtilityGainPer100Hands?: number;
  utilityUnit?: UtilityUnit;
  evGainEvidence: EvGainEvidence;
  spotFrequencySource: SpotFrequencySource;
  utilityMode: UtilityMode;
  intervention: TrainingIntervention;
}
export interface DailyTrainingPlan { items: PlannedScenario[]; counts: Record<TrainingReason, number>; weakCategories: string[]; }
export interface DailyPlanOptions {
  /** Injected in tests; production intentionally samples a fresh high-value plan. */
  random?: () => number;
  /** The previously presented first question/family. Avoid it when an equally-valid alternative exists. */
  avoidFirstScenarioId?: string;
  /** How many recent unique decision families receive a repeat penalty. */
  recentWindow?: number;
  /** Disable browser persistence for deterministic tests or server-side callers. */
  persistFirstScenario?: boolean;
}

const EMPTY_COUNTS: Record<TrainingReason, number> = { 'due-review': 0, 'weak-area': 0, 'recent-mistake': 0, new: 0, benchmark: 0, mixed: 0 };
const DAY_MS = 86400000;
const LAST_DAILY_FIRST_KEY = 'poker_last_daily_first_v2';

type RankedScenario = ReturnType<typeof rankByExpectedLearningValue>[number];

function weightedSampleWithoutReplacement(
  source: RankedScenario[],
  count: number,
  random: () => number,
  weightOf: (entry: RankedScenario) => number,
): RankedScenario[] {
  const remaining = [...source];
  const selected: RankedScenario[] = [];
  while (remaining.length && selected.length < count) {
    const weights = remaining.map(entry => Math.max(0.000001, weightOf(entry)));
    const total = weights.reduce((sum, value) => sum + value, 0);
    let target = Math.min(0.999999999999, Math.max(0, random())) * total;
    let index = 0;
    for (; index < remaining.length - 1; index += 1) {
      target -= weights[index];
      if (target <= 0) break;
    }
    selected.push(remaining.splice(index, 1)[0]);
  }
  return selected;
}

function uniqueFamilies(ranked: RankedScenario[]): RankedScenario[] {
  const seen = new Set<string>();
  return ranked.filter(entry => {
    const family = scenarioDecisionFamilyId(entry.scenario);
    if (seen.has(family)) return false;
    seen.add(family);
    return true;
  });
}

function recentScenarioIds(history: HistoryItem[], windowSize: number): Set<string> {
  const ids: string[] = [];
  const seen = new Set<string>();
  [...history]
    .sort((a, b) => b.timestamp - a.timestamp)
    .forEach(item => {
      const family = historyDecisionFamilyId(item);
      if (!family || seen.has(family) || ids.length >= windowSize) return;
      seen.add(family);
      ids.push(family);
    });
  return new Set(ids);
}

function latestScenarioTimestamp(history: HistoryItem[]): Map<string, number> {
  const latest = new Map<string, number>();
  history.forEach(item => {
    const family = historyDecisionFamilyId(item);
    const current = latest.get(family) || 0;
    if (item.timestamp > current) latest.set(family, item.timestamp);
  });
  return latest;
}

function candidateWeight(
  entry: RankedScenario,
  recentIds: Set<string>,
  latestTimestamp: Map<string, number>,
  now: number,
): number {
  const base = Math.max(0.05, entry.value.total);
  const family = scenarioDecisionFamilyId(entry.scenario);
  if (entry.value.due) {
    const latest = latestTimestamp.get(family);
    const overdueDays = latest ? Math.max(0, (now - latest) / DAY_MS) : 0;
    return base * (2.5 + Math.min(3, overdueDays / 3));
  }

  let repeatPenalty = 1;
  if (recentIds.has(family)) repeatPenalty *= 0.15;
  const latest = latestTimestamp.get(family);
  if (latest && now - latest < DAY_MS) repeatPenalty *= 0.2;

  // Preserve the ELV ordering signal while allowing close alternatives to rotate.
  return Math.pow(base, 1.35) * repeatPenalty;
}

function browserLastFirst(): string | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    return localStorage.getItem(LAST_DAILY_FIRST_KEY) || undefined;
  } catch {
    return undefined;
  }
}

function persistBrowserLastFirst(id?: string): void {
  if (!id) return;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LAST_DAILY_FIRST_KEY, id);
  } catch {
    // Persistence is a UX optimization; never fail planning because storage is unavailable.
  }
}

function avoidRepeatedFirst(items: RankedScenario[], avoidId?: string): RankedScenario[] {
  const avoidFamily = avoidId ? canonicalDecisionFamilyId(avoidId) : undefined;
  if (!avoidFamily || items.length < 2 || scenarioDecisionFamilyId(items[0].scenario) !== avoidFamily) return items;
  const firstIsDue = items[0].value.due;
  const swapIndex = items.findIndex((entry, index) => index > 0 && (!firstIsDue || entry.value.due));
  if (swapIndex < 0) return items;
  const reordered = [...items];
  [reordered[0], reordered[swapIndex]] = [reordered[swapIndex], reordered[0]];
  return reordered;
}

export function buildDailyTrainingPlan(
  scenarios: Scenario[],
  history: HistoryItem[],
  size = 12,
  now = Date.now(),
  profile?: PlayerProfile,
  options: DailyPlanOptions = {},
): DailyTrainingPlan {
  const trainingScenarios = getTrainingScenarios(scenarios);
  const relevant = profile ? filterRelevantScenarios(trainingScenarios, profile) : trainingScenarios;
  const pool = relevant.length >= Math.min(size, trainingScenarios.length) ? relevant : trainingScenarios;
  // P3-C: one knowledge family gets one slot. Cosmetic suit variants can still be
  // used as instances elsewhere, but they must not crowd out distinct concepts.
  const ranked = uniqueFamilies(rankByExpectedLearningValue(pool, history, now, profile));
  const requested = Math.min(size, ranked.length);
  const random = options.random || Math.random;
  const recentIds = recentScenarioIds(history, options.recentWindow ?? 10);
  const latestTimestamp = latestScenarioTimestamp(history);

  // Spaced review is an override: due items are never discarded merely to increase novelty.
  const due = ranked.filter(entry => entry.value.due);
  const dueSelected = due.length <= requested
    ? weightedSampleWithoutReplacement(due, due.length, random, entry => candidateWeight(entry, recentIds, latestTimestamp, now))
    : weightedSampleWithoutReplacement(due, requested, random, entry => candidateWeight(entry, recentIds, latestTimestamp, now));

  const selectedFamilies = new Set(dueSelected.map(entry => scenarioDecisionFamilyId(entry.scenario)));
  const remainingSlots = requested - dueSelected.length;
  const candidateWindowSize = Math.min(ranked.length, Math.max(24, requested * 3));
  const highValueCandidates = ranked
    .filter(entry => !selectedFamilies.has(scenarioDecisionFamilyId(entry.scenario)))
    .slice(0, candidateWindowSize);
  const exploratoryCandidates = ranked.filter(entry => !selectedFamilies.has(scenarioDecisionFamilyId(entry.scenario)) && !highValueCandidates.some(candidate => scenarioDecisionFamilyId(candidate.scenario) === scenarioDecisionFamilyId(entry.scenario)));

  let sampled = weightedSampleWithoutReplacement(
    highValueCandidates,
    remainingSlots,
    random,
    entry => candidateWeight(entry, recentIds, latestTimestamp, now),
  );
  if (sampled.length < remainingSlots) {
    sampled = [
      ...sampled,
      ...weightedSampleWithoutReplacement(
        exploratoryCandidates.filter(entry => !sampled.some(selected => scenarioDecisionFamilyId(selected.scenario) === scenarioDecisionFamilyId(entry.scenario))),
        remainingSlots - sampled.length,
        random,
        entry => candidateWeight(entry, recentIds, latestTimestamp, now),
      ),
    ];
  }

  const avoidFirst = options.avoidFirstScenarioId ?? browserLastFirst();
  const chosen = avoidRepeatedFirst([...dueSelected, ...sampled], avoidFirst);
  if (options.persistFirstScenario !== false) persistBrowserLastFirst(chosen[0] ? scenarioDecisionFamilyId(chosen[0].scenario) : undefined);

  const counts = { ...EMPTY_COUNTS };
  const weakCategories = getWeaknessInsights(history, now).filter(item => item.total >= 3 && item.mastery < 80).slice(0, 4).map(item => item.key);
  let benchmarkAssigned = false;
  const items = chosen.map(({ scenario, value }) => {
    let reason = value.reason;
    if (reason === 'benchmark') {
      if (benchmarkAssigned) reason = 'new';
      else benchmarkAssigned = true;
    }
    counts[reason] += 1;
    return {
      scenario,
      reason,
      learningValue: Math.round(value.total * 100) / 100,
      expectedEvGainPer100Hands: value.reportableExpectedEvGainPer100Hands === undefined
        ? undefined
        : Math.round(value.reportableExpectedEvGainPer100Hands * 1000) / 1000,
      expectedUtilityGainPer100Hands: value.reportableExpectedUtilityGainPer100Hands === undefined
        ? undefined
        : Math.round(value.reportableExpectedUtilityGainPer100Hands * 1000) / 1000,
      utilityUnit: value.utilityUnit,
      evGainEvidence: value.evGainEvidence,
      spotFrequencySource: value.spotFrequencySource,
      utilityMode: value.utilityMode,
      intervention: recommendIntervention(scenario, history, now),
    };
  });
  return { items, counts, weakCategories };
}

export function getDueScenarioIds(history: HistoryItem[], now = Date.now()): string[] {
  const due = [...latestByMasteryKey(history).values()]
    .filter(item => item.trainingType !== 'benchmark' && item.trainingType !== 'solver-benchmark')
    .filter(item => isDue(item, now))
    .sort((a, b) => (a.nextReviewAt || Infinity) - (b.nextReviewAt || Infinity));
  return [...new Set(due.map(historyDecisionFamilyId))];
}
