import { HistoryItem, PlayerProfile, Scenario } from '../../types';
import { filterRelevantScenarios } from '../../domain/playerProfile';
import { getWeaknessInsights, isDue, latestByMasteryKey } from '../../learning-engine';
import { getTrainingScenarios } from '../../learning-engine/benchmark';
import { rankByExpectedLearningValue } from '../../learning-engine/trainingValue';

export type TrainingReason = 'due-review' | 'weak-area' | 'recent-mistake' | 'new' | 'benchmark' | 'mixed';
export interface PlannedScenario { scenario: Scenario; reason: TrainingReason; learningValue?: number; }
export interface DailyTrainingPlan { items: PlannedScenario[]; counts: Record<TrainingReason, number>; weakCategories: string[]; }

const EMPTY_COUNTS: Record<TrainingReason, number> = { 'due-review': 0, 'weak-area': 0, 'recent-mistake': 0, new: 0, benchmark: 0, mixed: 0 };

export function buildDailyTrainingPlan(scenarios: Scenario[], history: HistoryItem[], size = 12, now = Date.now(), profile?: PlayerProfile): DailyTrainingPlan {
  const trainingScenarios = getTrainingScenarios(scenarios);
  const relevant = profile ? filterRelevantScenarios(trainingScenarios, profile) : trainingScenarios;
  const pool = relevant.length >= Math.min(size, trainingScenarios.length) ? relevant : trainingScenarios;
  const ranked = rankByExpectedLearningValue(pool, history, now, profile);
  const counts = { ...EMPTY_COUNTS };
  const weakCategories = getWeaknessInsights(history, now).filter(item => item.total >= 3 && item.mastery < 80).slice(0, 4).map(item => item.key);
  let benchmarkAssigned = false;
  const items = ranked.slice(0, Math.min(size, ranked.length)).map(({ scenario, value }) => {
    let reason = value.reason;
    if (reason === 'benchmark') {
      if (benchmarkAssigned) reason = 'new';
      else benchmarkAssigned = true;
    }
    counts[reason] += 1;
    return { scenario, reason, learningValue: Math.round(value.total * 100) / 100 };
  });
  return { items, counts, weakCategories };
}

export function getDueScenarioIds(history: HistoryItem[], now = Date.now()): string[] {
  const due = [...latestByMasteryKey(history).values()]
    .filter(item => item.trainingType !== 'benchmark')
    .filter(item => isDue(item, now))
    .sort((a, b) => (a.nextReviewAt || Infinity) - (b.nextReviewAt || Infinity));
  return [...new Set(due.map(item => item.scenarioId))];
}
