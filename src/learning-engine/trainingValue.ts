import { HistoryItem, PlayerProfile, Scenario, UtilityUnit } from '../types';
import { scenarioProfileScore } from '../domain/playerProfile';
import { inferScenarioSkillIds, calculateSkillMastery, getSkillNode, inferSkillIds } from './skillGraph';
import { improvementProbabilityFromHistory } from './errorModel';
import { evidenceMatchesScenario } from './contextIdentity';
import { matchingUtilityEvidence, scenarioUtilityMode } from './utility';

export type EvGainEvidence = 'verified' | 'observed' | 'estimated';
export type SpotFrequencySource = 'observed-real-hand' | 'scenario-prior' | 'heuristic-prior';
export type UtilityMode = 'cash-bb' | 'tournament-dollar' | 'tournament-priority';

export interface LearningValueBreakdown {
  total: number;
  weakness: number;
  forgettingRisk: number;
  uncertainty: number;
  transferValue: number;
  evImportance: number;
  observedEvRegretBB: number;
  observedUtilityRegret: number;
  utilityUnit?: UtilityUnit;
  spotFrequencyPer100Hands: number;
  spotFrequencySource: SpotFrequencySource;
  expectedLossPer100Hands: number;
  probabilityOfImprovement: number;
  expectedEvGainPer100Hands: number;
  expectedUtilityGainPer100Hands: number;
  reportableExpectedEvGainPer100Hands?: number;
  reportableExpectedUtilityGainPer100Hands?: number;
  evGainEvidence: EvGainEvidence;
  utilityMode: UtilityMode;
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
  if (/ICM|泡沫|決賽桌|衛星/i.test(text)) return 0.9;
  if (/overbet|超額下注|150%|125%/i.test(text)) return 0.18;
  if (/多人|multiway/i.test(text)) return 0.7;
  if (scenario.steps.some(step => step.street === 'River')) return 0.9;
  if (scenario.steps.some(step => step.street === 'Turn')) return 1.8;
  if (scenario.steps.some(step => step.street === 'Flop')) return 3.5;
  return 2;
}

function average(values: number[]): number | undefined {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

function observedRealHandFrequency(items: HistoryItem[], scenario: Scenario): number | undefined {
  const seen = new Set<string>();
  const values: number[] = [];
  items.forEach(item => {
    if (item.trainingType !== 'real-hand' || !evidenceMatchesScenario(item, scenario)) return;
    const structured = typeof item.handsObserved === 'number' && item.handsObserved > 0 && typeof item.spotExposureCount === 'number' && item.spotExposureCount > 0
      ? item.spotExposureCount / item.handsObserved * 100
      : undefined;
    const value = structured ?? item.spotFrequencyPer100Hands;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return;
    const key = item.sessionId ? `${item.sessionId}:${item.contextFamilyId || item.scenarioId}` : item.attemptId || `${item.scenarioId}:${item.timestamp}`;
    if (seen.has(key)) return;
    seen.add(key);
    values.push(value);
  });
  return average(values);
}

function utilityScale(regret: number, unit?: UtilityUnit): number {
  if (unit === 'bb' || !unit) return Math.max(0.75, Math.min(2.5, 0.75 + regret));
  return Math.max(0.75, Math.min(2.5, 0.9 + Math.log1p(Math.max(0, regret))));
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

  const utilityEvidence = matchingUtilityEvidence(history, scenario);
  const observedUtilityRegret = average(utilityEvidence.map(entry => entry.observation.loss));
  const utilityUnit = utilityEvidence[0]?.observation.unit;
  const skillPriorLosses = skills.map(id => skillMastery.get(id)?.averageEvLossBB || 0).filter(value => value > 0);
  const fallbackRegret = average(skillPriorLosses) ?? 0.08 * evImportance;
  const regretForRanking = observedUtilityRegret ?? fallbackRegret;
  const observedEvRegretBB = scenario.type === 'Cash Game' ? regretForRanking : 0;

  const observedFrequency = observedRealHandFrequency(history, scenario);
  const spotFrequencyPer100Hands = observedFrequency ?? estimateSpotFrequencyPer100Hands(scenario);
  const spotFrequencySource: SpotFrequencySource = observedFrequency !== undefined
    ? 'observed-real-hand'
    : typeof scenario.spotFrequencyPer100Hands === 'number' && scenario.spotFrequencyPer100Hands > 0
      ? 'scenario-prior'
      : 'heuristic-prior';

  const hasObservedUtility = utilityEvidence.length > 0;
  const hasVerifiedUtility = utilityEvidence.some(entry => entry.observation.reportable);
  const evGainEvidence: EvGainEvidence = hasObservedUtility && spotFrequencySource === 'observed-real-hand'
    ? hasVerifiedUtility ? 'verified' : 'observed'
    : 'estimated';

  const utilityMode = scenarioUtilityMode(scenario, utilityEvidence) as UtilityMode;
  const expectedLossPer100Hands = regretForRanking * spotFrequencyPer100Hands;
  const skillRelatedHistory = history.filter(item => {
    const itemSkills = item.skillIds?.length ? item.skillIds : inferSkillIds(item.category, item.street);
    return skills.some(skill => itemSkills.includes(skill));
  });
  const repairProbability = improvementProbabilityFromHistory(related.length ? related : skillRelatedHistory);
  const probabilityOfImprovement = Math.max(0.25, Math.min(0.92, repairProbability + weakness * 0.16 + uncertainty * 0.08 + (due ? 0.04 : 0)));
  const expectedUtilityGainPer100Hands = expectedLossPer100Hands * probabilityOfImprovement;
  const expectedEvGainPer100Hands = expectedUtilityGainPer100Hands;
  // Numeric gain is a report, not merely a ranking signal. v8 only exposes it
  // when the regret source is verified/exact and the real-game exposure is observed.
  const reportableExpectedUtilityGainPer100Hands = evGainEvidence === 'verified' && utilityMode !== 'tournament-priority'
    ? expectedUtilityGainPer100Hands
    : undefined;
  const reportableExpectedEvGainPer100Hands = utilityMode === 'cash-bb'
    ? reportableExpectedUtilityGainPer100Hands
    : undefined;

  const frequencyMultiplier = Math.max(0.45, Math.min(2.2, Math.sqrt(spotFrequencyPer100Hands / 2)));
  const evCostMultiplier = utilityScale(regretForRanking, utilityUnit);
  const gainMultiplier = Math.max(0.65, Math.min(2.5, 0.85 + Math.sqrt(Math.max(0, expectedUtilityGainPer100Hands))));
  const profileRelevance = profile ? Math.max(0.25, 1 + scenarioProfileScore(scenario, profile) / 12) : 1;
  const timeCost = difficultyTimeCost[scenario.difficulty];
  const dueBoost = due ? 1.5 : 1;
  const mistakeBoost = recentMistake ? 1.25 : 1;
  const learningCore = 0.34 * weakness + 0.2 * forgettingRisk + 0.16 * uncertainty + 0.18 * transferValue + 0.12;
  const total = (learningCore * evImportance * evCostMultiplier * frequencyMultiplier * gainMultiplier * profileRelevance * dueBoost * mistakeBoost) / timeCost;

  let reason: LearningValueBreakdown['reason'] = 'mixed';
  if (due) reason = 'due-review';
  else if (recentMistake) reason = 'recent-mistake';
  else if (unseen && relatedSkillSeenElsewhere) reason = 'benchmark';
  else if (unseen) reason = 'new';
  else if (weakness >= 0.45) reason = 'weak-area';

  return {
    total,
    weakness,
    forgettingRisk,
    uncertainty,
    transferValue,
    evImportance,
    observedEvRegretBB,
    observedUtilityRegret: regretForRanking,
    utilityUnit,
    spotFrequencyPer100Hands,
    spotFrequencySource,
    expectedLossPer100Hands,
    probabilityOfImprovement,
    expectedEvGainPer100Hands,
    expectedUtilityGainPer100Hands,
    reportableExpectedEvGainPer100Hands,
    reportableExpectedUtilityGainPer100Hands,
    evGainEvidence,
    utilityMode,
    profileRelevance,
    timeCost,
    due,
    recentMistake,
    unseen,
    reason,
  };
}

export function rankByExpectedLearningValue(scenarios: Scenario[], history: HistoryItem[], now = Date.now(), profile?: PlayerProfile) {
  return scenarios
    .map(scenario => ({ scenario, value: expectedLearningValue(scenario, history, now, profile) }))
    .sort((a, b) => b.value.total - a.value.total || b.value.expectedUtilityGainPer100Hands - a.value.expectedUtilityGainPer100Hands || b.value.expectedLossPer100Hands - a.value.expectedLossPer100Hands || a.scenario.id.localeCompare(b.scenario.id));
}
