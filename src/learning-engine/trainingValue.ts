import { HistoryItem, PlayerProfile, Scenario } from '../types';
import { scenarioProfileScore } from '../domain/playerProfile';
import { inferScenarioSkillIds, calculateSkillMastery, getSkillNode, inferSkillIds } from './skillGraph';

export interface LearningValueBreakdown {
  total: number;
  weakness: number;
  forgettingRisk: number;
  uncertainty: number;
  transferValue: number;
  evImportance: number;
  profileRelevance: number;
  timeCost: number;
  due: boolean;
  recentMistake: boolean;
  unseen: boolean;
  reason: 'due-review' | 'weak-area' | 'recent-mistake' | 'new' | 'benchmark' | 'mixed';
}

const difficultyTimeCost: Record<Scenario['difficulty'], number> = { '新手': 1, '中階': 1.2, '進階': 1.45 };

export function expectedLearningValue(
  scenario: Scenario,
  history: HistoryItem[],
  now = Date.now(),
  profile?: PlayerProfile,
): LearningValueBreakdown {
  const skillMastery = new Map(calculateSkillMastery(history, now).map(item => [item.skillId, item]));
  const skills = inferScenarioSkillIds(scenario);
  const related = history.filter(item => item.scenarioId === scenario.id);
  const latest = [...related].sort((a, b) => b.timestamp - a.timestamp)[0];
  const due = related.some(item => typeof item.nextReviewAt === 'number' && item.nextReviewAt <= now);
  const recentMistake = related.some(item => now - item.timestamp <= 14 * 86400000 && !(item.correct ?? item.score >= 8));
  const unseen = related.length === 0;

  const weakness = skills.length
    ? skills.reduce((sum, id) => sum + (1 - (skillMastery.get(id)?.score ?? 50) / 100), 0) / skills.length
    : 0.45;
  const avgConfidence = skills.length
    ? skills.reduce((sum, id) => sum + (skillMastery.get(id)?.sampleConfidence ?? 0), 0) / skills.length / 100
    : 0;
  const uncertainty = Math.max(0.15, 1 - avgConfidence);
  const forgettingRisk = due ? 1 : latest ? Math.min(1, Math.max(0.1, (now - latest.timestamp) / (14 * 86400000))) : 0.45;
  const relatedSkillSeenElsewhere = skills.some(id => history.some(item => {
    if (item.scenarioId === scenario.id) return false;
    const itemSkills = item.skillIds?.length ? item.skillIds : inferSkillIds(item.category, item.street);
    return itemSkills.includes(id);
  }));
  const transferValue = unseen && relatedSkillSeenElsewhere ? 1 : unseen ? 0.65 : 0.25;
  const evImportance = skills.length
    ? skills.reduce((sum, id) => sum + (getSkillNode(id)?.evImportance || 1), 0) / skills.length
    : 1;
  const profileRelevance = profile ? Math.max(0.25, 1 + scenarioProfileScore(scenario, profile) / 12) : 1;
  const timeCost = difficultyTimeCost[scenario.difficulty];
  const dueBoost = due ? 1.5 : 1;
  const mistakeBoost = recentMistake ? 1.25 : 1;
  const total = ((0.34 * weakness + 0.2 * forgettingRisk + 0.16 * uncertainty + 0.18 * transferValue + 0.12) * evImportance * profileRelevance * dueBoost * mistakeBoost) / timeCost;

  let reason: LearningValueBreakdown['reason'] = 'mixed';
  if (due) reason = 'due-review';
  else if (recentMistake && weakness >= 0.45) reason = 'recent-mistake';
  else if (weakness >= 0.45) reason = 'weak-area';
  else if (unseen && relatedSkillSeenElsewhere) reason = 'benchmark';
  else if (unseen) reason = 'new';

  return { total, weakness, forgettingRisk, uncertainty, transferValue, evImportance, profileRelevance, timeCost, due, recentMistake, unseen, reason };
}

export function rankByExpectedLearningValue(scenarios: Scenario[], history: HistoryItem[], now = Date.now(), profile?: PlayerProfile) {
  return scenarios
    .map(scenario => ({ scenario, value: expectedLearningValue(scenario, history, now, profile) }))
    .sort((a, b) => b.value.total - a.value.total || a.scenario.id.localeCompare(b.scenario.id));
}
