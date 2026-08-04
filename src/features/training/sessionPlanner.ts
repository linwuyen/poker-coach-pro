import { HistoryItem, Scenario } from '../../types';

export type TrainingReason = 'due-review' | 'weak-area' | 'recent-mistake' | 'new' | 'mixed';

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
  mixed: 0,
};

function latestAttempts(history: HistoryItem[]): Map<string, HistoryItem> {
  const result = new Map<string, HistoryItem>();
  history
    .filter(item => item.trainingType !== 'gto' && item.trainingType !== 'custom')
    .forEach(item => {
      const current = result.get(item.scenarioId);
      if (!current || current.timestamp < item.timestamp) result.set(item.scenarioId, item);
    });
  return result;
}

function getWeakCategories(history: HistoryItem[]): string[] {
  const groups = new Map<string, { total: number; correct: number }>();
  history.filter(item => item.trainingType !== 'gto' && item.trainingType !== 'custom').forEach(item => {
    (item.category || []).forEach(category => {
      const current = groups.get(category) || { total: 0, correct: 0 };
      current.total += 1;
      current.correct += item.score >= 8 ? 1 : 0;
      groups.set(category, current);
    });
  });
  return [...groups.entries()]
    .filter(([, value]) => value.total >= 2)
    .sort(([, a], [, b]) => (a.correct / a.total) - (b.correct / b.total) || b.total - a.total)
    .slice(0, 3)
    .map(([category]) => category);
}

function stableMixScore(id: string, now: number): number {
  const day = Math.floor(now / 86400000);
  return [...`${id}-${day}`].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7);
}

export function buildDailyTrainingPlan(
  scenarios: Scenario[],
  history: HistoryItem[],
  size = 12,
  now = Date.now(),
): DailyTrainingPlan {
  const latest = latestAttempts(history);
  const weakCategories = getWeakCategories(history);
  const selected = new Set<string>();
  const items: PlannedScenario[] = [];
  const counts = { ...EMPTY_COUNTS };
  const byId = new Map(scenarios.map(scenario => [scenario.id, scenario]));

  const take = (candidates: Scenario[], limit: number, reason: TrainingReason) => {
    for (const scenario of candidates) {
      if (items.length >= size || counts[reason] >= limit || selected.has(scenario.id)) continue;
      selected.add(scenario.id);
      items.push({ scenario, reason });
      counts[reason] += 1;
    }
  };

  const due = scenarios
    .filter(scenario => {
      const attempt = latest.get(scenario.id);
      return Boolean(attempt && (attempt.score < 8 || (attempt.nextReviewAt || Infinity) <= now));
    })
    .sort((a, b) => (latest.get(a.id)?.nextReviewAt || 0) - (latest.get(b.id)?.nextReviewAt || 0));
  take(due, 4, 'due-review');

  const weak = scenarios
    .filter(scenario => scenario.category?.some(category => weakCategories.includes(category)))
    .sort((a, b) => (latest.get(a.id)?.score ?? 10) - (latest.get(b.id)?.score ?? 10));
  take(weak, 3, 'weak-area');

  const recentMistakeIds = history
    .filter(item => item.trainingType !== 'gto' && item.trainingType !== 'custom' && item.score < 8)
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(item => item.scenarioId);
  take(recentMistakeIds.map(id => byId.get(id)).filter((scenario): scenario is Scenario => Boolean(scenario)), 2, 'recent-mistake');

  const unseen = scenarios.filter(scenario => !latest.has(scenario.id));
  take(unseen, 2, 'new');

  const mixed = [...scenarios].sort((a, b) => stableMixScore(a.id, now) - stableMixScore(b.id, now));
  take(mixed, size, 'mixed');

  return { items, counts, weakCategories };
}

export function getDueScenarioIds(history: HistoryItem[], now = Date.now()): string[] {
  return [...latestAttempts(history).values()]
    .filter(item => item.score < 8 || (item.nextReviewAt || Infinity) <= now)
    .sort((a, b) => (a.nextReviewAt || 0) - (b.nextReviewAt || 0))
    .map(item => item.scenarioId);
}
