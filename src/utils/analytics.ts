import { HistoryItem, Scenario } from '../types';
import { getWeaknessInsights, isDue, isHistoryCorrect, latestByMasteryKey } from '../learning-engine';

export interface WeaknessSummary {
  key: string;
  total: number;
  accuracy: number;
  mastery?: number;
  sampleConfidence?: number;
  recentTrend?: number;
}

export function summarizeBy(items: HistoryItem[], selector: (item: HistoryItem) => string | undefined): WeaknessSummary[] {
  const groups = new Map<string, HistoryItem[]>();
  items.forEach(item => {
    const key = selector(item);
    if (!key || item.trainingType === 'custom') return;
    groups.set(key, [...(groups.get(key) || []), item]);
  });
  return [...groups.entries()].map(([key, group]) => {
    const correct = group.filter(isHistoryCorrect).length;
    const adjusted = (correct + 2) / (group.length + 4);
    return { key, total: group.length, accuracy: Math.round(adjusted * 100) };
  }).sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
}

export function summarizeWeaknesses(history: HistoryItem[]): WeaknessSummary[] {
  return getWeaknessInsights(history).map(item => ({
    key: item.key,
    total: item.total,
    accuracy: item.adjustedAccuracy,
    mastery: item.mastery,
    sampleConfidence: item.sampleConfidence,
    recentTrend: item.recentTrend,
  }));
}

export function getWeakScenarioIds(history: HistoryItem[], allScenarios: Scenario[], limit = 20, now = Date.now()): string[] {
  const weakCategories = getWeaknessInsights(history, now)
    .filter(group => group.total >= 3 && group.mastery < 78 && group.sampleConfidence >= 25)
    .slice(0, 4)
    .map(group => group.key);
  const latest = latestByMasteryKey(history);
  const dueScenarioIds = new Set([...latest.values()].filter(item => isDue(item, now)).map(item => item.scenarioId));
  return allScenarios
    .filter(scenario => dueScenarioIds.has(scenario.id) || scenario.category?.some(category => weakCategories.includes(category)))
    .sort((a, b) => Number(dueScenarioIds.has(b.id)) - Number(dueScenarioIds.has(a.id)))
    .slice(0, limit)
    .map(scenario => scenario.id);
}
