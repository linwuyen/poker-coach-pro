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
  observedEvRegretBB: number;
  spotFrequencyPer100Hands: number;
  expectedLossPer100Hands: number;
  profileRelevance: number;
  timeCost: number;
  due: boolean;
  recentMistake: boolean;
  unseen: boolean;
  reason: 'due-review' | 'weak-area' | 'recent-mistake' | 'new' | 'benchmark' | 'mixed';
}

const difficultyTimeCost: Record<Scenario['difficulty'], number> = { '新手': 1, '中階': 1.2, '進階': 1.45 };

export function estimateSpotFrequencyPer100Hands(scenario: Scenario): number {
  if (typeof scenario.spotFrequencyPer100Hands === 'number' && scenario.spotFrequencyPer100Hands > 0) return scenario.spotFrequencyPer100Hands;
  const text = `${scenario.title} ${(scenario.category || []).join(' ')} ${scenario.position} ${scenario.steps.map(step => `${step.street} ${step.description}`).join(' ')}`;
  if (/4-?Bet/i.test(text)) return 0.45;
  if (/3-?Bet|Squeeze|擠壓/i.test(text)) return 2.2;
  if (/BB.*防守|大盲|盲注戰/i.test(text)) return 8;
  if (/RFI|開池|open/i.test(text) && scenario.steps.some(step => step.street === 'Preflop')) return 7;
  if (/Push|Fold|短碼|shove|全下/i.test(text) && scenario.type === 'Tournament') return 1.2;
  // Tournament pressure spots are event-frequency priors rather than literal cash-game hand frequencies.
  // Keep them below common blind/RFI nodes without making ICM disappear from an MTT learner's curriculum.
  if (/ICM|泡沫|決賽桌|衛星/i.test(text)) return 0.9;
  if (/overbet|超額下注|150%|125%/i.test(text)) return 0.18;
  if (/多人|multiway/i.test(text)) return 0.7;
  if (scenario.steps.some(step => step.street === 'River')) return 0.9;
  if (scenario.steps.some(step => step.street === 'Turn')) return 1.8;
  if (scenario.steps.some(step => step.street === 'Flop')) return 3.5;
  return 2;
}

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
  const observedLosses = skills.map(id => skillMastery.get(id)?.averageEvLossBB || 0).filter(value => value > 0);
  const observedEvRegretBB = observedLosses.length ? observedLosses.reduce((sum, value) => sum + value, 0) / observedLosses.length : 0.08 * evImportance;
  const spotFrequencyPer100Hands = estimateSpotFrequencyPer100Hands(scenario);
  const expectedLossPer100Hands = observedEvRegretBB * spotFrequencyPer100Hands;
  const frequencyMultiplier = Math.max(0.45, Math.min(2.2, Math.sqrt(spotFrequencyPer100Hands / 2)));
  const evCostMultiplier = Math.max(0.75, Math.min(2.5, 0.75 + observedEvRegretBB));
  const profileRelevance = profile ? Math.max(0.25, 1 + scenarioProfileScore(scenario, profile) / 12) : 1;
  const timeCost = difficultyTimeCost[scenario.difficulty];
  const dueBoost = due ? 1.5 : 1;
  const mistakeBoost = recentMistake ? 1.25 : 1;
  const learningCore = 0.34 * weakness + 0.2 * forgettingRisk + 0.16 * uncertainty + 0.18 * transferValue + 0.12;
  const total = (learningCore * evImportance * evCostMultiplier * frequencyMultiplier * profileRelevance * dueBoost * mistakeBoost) / timeCost;

  let reason: LearningValueBreakdown['reason'] = 'mixed';
  if (due) reason = 'due-review';
  else if (recentMistake) reason = 'recent-mistake';
  else if (unseen && relatedSkillSeenElsewhere) reason = 'benchmark';
  else if (unseen) reason = 'new';
  else if (weakness >= 0.45) reason = 'weak-area';

  return { total, weakness, forgettingRisk, uncertainty, transferValue, evImportance, observedEvRegretBB, spotFrequencyPer100Hands, expectedLossPer100Hands, profileRelevance, timeCost, due, recentMistake, unseen, reason };
}

export function rankByExpectedLearningValue(scenarios: Scenario[], history: HistoryItem[], now = Date.now(), profile?: PlayerProfile) {
  return scenarios
    .map(scenario => ({ scenario, value: expectedLearningValue(scenario, history, now, profile) }))
    .sort((a, b) => b.value.total - a.value.total || b.value.expectedLossPer100Hands - a.value.expectedLossPer100Hands || a.scenario.id.localeCompare(b.scenario.id));
}
