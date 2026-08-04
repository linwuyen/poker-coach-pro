import { HistoryItem, PlayerProfile, Scenario } from '../../types';
import { filterRelevantScenarios, scenarioProfileScore } from '../../domain/playerProfile';
import { getWeaknessInsights, isDue, isHistoryCorrect, latestByMasteryKey, latestByScenario } from '../../learning-engine';

export type TrainingReason = 'due-review' | 'weak-area' | 'recent-mistake' | 'new' | 'benchmark' | 'mixed';

export interface PlannedScenario {
  scenario: Scenario;
  reason: TrainingReason;
}

export interface DailyTrainingPlan {
  items: PlannedScenario[];
  counts: Record<TrainingReason, number>;
  weakCategories: string[];
}

const EMPTY_COUNTS: Record<TrainingReason, number> = {
  'due-review': 0,
  'weak-area': 0,
  'recent-mistake': 0,
  new: 0,
  benchmark: 0,
  mixed: 0,
};

function stableMixScore(id: string, now: number): number {
  const day = Math.floor(now / 86400000);
  return [...`${id}-${day}`].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7);
}

function allocation(profile?: PlayerProfile) {
  if (profile?.experience === 'beginner') return { due: 3, weak: 2, mistake: 1, fresh: 4, benchmark: 1 };
  if (profile?.experience === 'advanced') return { due: 4, weak: 4, mistake: 2, fresh: 1, benchmark: 2 };
  return { due: 4, weak: 3, mistake: 2, fresh: 2, benchmark: 1 };
}

export function buildDailyTrainingPlan(
  scenarios: Scenario[],
  history: HistoryItem[],
  size = 12,
  now = Date.now(),
  profile?: PlayerProfile,
): DailyTrainingPlan {
  const relevant = profile ? filterRelevantScenarios(scenarios, profile) : scenarios;
  const latestScenario = latestByScenario(history);
  const latestMastery = latestByMasteryKey(history);
  const weakCategories = getWeaknessInsights(history, now)
    .filter(item => item.total >= 3 && item.mastery < 80)
    .slice(0, 4)
    .map(item => item.key);
  const selected = new Set<string>();
  const items: PlannedScenario[] = [];
  const counts = { ...EMPTY_COUNTS };
  const byId = new Map(scenarios.map(scenario => [scenario.id, scenario]));
  const limits = allocation(profile);

  const rank = (candidate: Scenario): number => (profile ? scenarioProfileScore(candidate, profile) * 1000 : 0) - stableMixScore(candidate.id, now);
  const take = (candidates: Scenario[], limit: number, reason: TrainingReason) => {
    [...candidates].sort((a, b) => rank(b) - rank(a)).forEach(scenario => {
      if (items.length >= size || counts[reason] >= limit || selected.has(scenario.id)) return;
      selected.add(scenario.id);
      items.push({ scenario, reason });
      counts[reason] += 1;
    });
  };

  const dueScenarioIds = new Set([...latestMastery.values()].filter(item => isDue(item, now)).map(item => item.scenarioId));
  take(relevant.filter(scenario => dueScenarioIds.has(scenario.id)), limits.due, 'due-review');

  take(relevant.filter(scenario => scenario.category?.some(category => weakCategories.includes(category))), limits.weak, 'weak-area');

  const recentMistakeIds = history
    .filter(item => item.trainingType !== 'custom' && !isHistoryCorrect(item))
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(item => item.scenarioId);
  take(recentMistakeIds.map(id => byId.get(id)).filter((scenario): scenario is Scenario => Boolean(scenario)), limits.mistake, 'recent-mistake');

  const unseen = relevant.filter(scenario => !latestScenario.has(scenario.id));
  take(unseen, limits.fresh, 'new');

  const benchmark = relevant
    .filter(scenario => !latestScenario.has(scenario.id) && !selected.has(scenario.id))
    .filter(scenario => !scenario.category?.some(category => weakCategories.includes(category)))
    .sort((a, b) => stableMixScore(a.id, now + 7919) - stableMixScore(b.id, now + 7919));
  take(benchmark, limits.benchmark, 'benchmark');

  const mixed = [...relevant].sort((a, b) => stableMixScore(a.id, now) - stableMixScore(b.id, now));
  take(mixed, size, 'mixed');
  if (items.length < size) take(scenarios, size, 'mixed');

  return { items, counts, weakCategories };
}

export function getDueScenarioIds(history: HistoryItem[], now = Date.now()): string[] {
  const due = [...latestByMasteryKey(history).values()]
    .filter(item => isDue(item, now))
    .sort((a, b) => (a.nextReviewAt || Infinity) - (b.nextReviewAt || Infinity));
  return [...new Set(due.map(item => item.scenarioId))];
}
