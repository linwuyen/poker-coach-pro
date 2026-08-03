import { HistoryItem, Scenario } from '../types';

export interface WeaknessSummary {
  key: string;
  total: number;
  accuracy: number;
}

export function summarizeBy(items: HistoryItem[], selector: (item: HistoryItem) => string | undefined): WeaknessSummary[] {
  const groups = new Map<string, { total: number; correct: number }>();
  items.forEach(item => {
    const key = selector(item);
    if (!key || item.trainingType === 'custom') return;
    const current = groups.get(key) || { total: 0, correct: 0 };
    current.total += 1;
    current.correct += item.score >= 8 ? 1 : 0;
    groups.set(key, current);
  });
  return [...groups.entries()].map(([key, value]) => ({
    key,
    total: value.total,
    accuracy: Math.round((value.correct / value.total) * 100),
  })).sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
}

export function getWeakScenarioIds(history: HistoryItem[], allScenarios: Scenario[], limit = 20): string[] {
  const weakCategories = summarizeBy(history, item => item.category?.[0])
    .filter(group => group.total >= 2 && group.accuracy < 80)
    .slice(0, 3)
    .map(group => group.key);
  const latestByScenario = new Map<string, HistoryItem>();
  history.filter(item => item.trainingType !== 'gto' && item.trainingType !== 'custom').forEach(item => {
    const current = latestByScenario.get(item.scenarioId);
    if (!current || current.timestamp <= item.timestamp) latestByScenario.set(item.scenarioId, item);
  });
  const dueIds = new Set([...latestByScenario.values()]
    .filter(item => item.score < 8 || (item.nextReviewAt || Infinity) <= Date.now())
    .map(item => item.scenarioId));
  return allScenarios
    .filter(scenario => dueIds.has(scenario.id) || scenario.category?.some(category => weakCategories.includes(category)))
    .slice(0, limit)
    .map(scenario => scenario.id);
}
