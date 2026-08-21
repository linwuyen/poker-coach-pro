import { PlayerProfile, Scenario, StackBand } from '../types';
import { getTrainingScenarios } from '../learning-engine/benchmark';

export const PLAYER_PROFILE_KEY = 'poker_player_profile_v1';

/**
 * Frictionless first-run profile. It is intentionally broad rather than pretending
 * the player supplied preferences that were never asked for. More specific choices
 * remain optional in Settings and are persisted only after explicit edits.
 */
export const DEFAULT_PLAYER_PROFILE: PlayerProfile = {
  schemaVersion: 1,
  formats: ['cash', 'tournament'],
  tableSizes: ['6max', '9max'],
  stackBands: ['10-20', '20-40', '40-100', '100+'],
  experience: 'intermediate',
  focusAreas: ['mixed'],
  dailyQuestions: 12,
  onboardingComplete: true,
  updatedAt: Date.now(),
};

export function loadPlayerProfile(): PlayerProfile {
  try {
    const parsed = JSON.parse(localStorage.getItem(PLAYER_PROFILE_KEY) || 'null') as Partial<PlayerProfile> | null;
    if (!parsed) return { ...DEFAULT_PLAYER_PROFILE };
    return {
      ...DEFAULT_PLAYER_PROFILE,
      ...parsed,
      schemaVersion: 1,
      formats: parsed.formats?.length ? parsed.formats : DEFAULT_PLAYER_PROFILE.formats,
      tableSizes: parsed.tableSizes?.length ? parsed.tableSizes : DEFAULT_PLAYER_PROFILE.tableSizes,
      stackBands: parsed.stackBands?.length ? parsed.stackBands : DEFAULT_PLAYER_PROFILE.stackBands,
      focusAreas: parsed.focusAreas?.length ? parsed.focusAreas : DEFAULT_PLAYER_PROFILE.focusAreas,
    };
  } catch {
    return { ...DEFAULT_PLAYER_PROFILE };
  }
}

export function savePlayerProfile(profile: PlayerProfile): PlayerProfile {
  const normalized = { ...profile, schemaVersion: 1 as const, updatedAt: Date.now() };
  localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function getStackBand(stackBB: number): StackBand {
  if (stackBB <= 20) return '10-20';
  if (stackBB <= 40) return '20-40';
  if (stackBB <= 100) return '40-100';
  return '100+';
}

export function scenarioProfileScore(scenario: Scenario, profile: PlayerProfile): number {
  let score = 0;
  const format = scenario.type === 'Tournament' ? 'tournament' : 'cash';
  if (profile.formats.includes(format)) score += 5;
  else score -= 5;

  const tableSize = scenario.tableSize;
  if (!tableSize || profile.tableSizes.includes(tableSize)) score += 2;
  else score -= 2;

  if (profile.stackBands.includes(getStackBand(scenario.userBB))) score += 4;

  const text = `${scenario.title} ${(scenario.category || []).join(' ')} ${scenario.steps.map(step => step.street).join(' ')}`;
  const focusMatches = profile.focusAreas.some(area => {
    if (area === 'mixed') return true;
    if (area === 'preflop') return /Preflop|翻前|3-Bet|4-Bet|Push|Fold/i.test(text);
    if (area === 'postflop') return /Flop|Turn|River|翻後|價值|詐唬/i.test(text);
    if (area === 'short-stack') return /短碼|ICM|Push|Fold|錦標賽/i.test(text) || scenario.userBB <= 25;
    if (area === 'math') return /SPR|賠率|數學|尺寸|組合/i.test(text);
    return /抓詐唬|bluff.?catch|河牌/i.test(text);
  });
  if (focusMatches) score += 3;

  const difficultyScore = scenario.difficulty === '新手' ? 0 : scenario.difficulty === '中階' ? 1 : 2;
  const experienceScore = profile.experience === 'beginner' ? 0 : profile.experience === 'intermediate' ? 1 : 2;
  score -= Math.abs(difficultyScore - experienceScore);
  return score;
}

export function filterRelevantScenarios(scenarios: Scenario[], profile: PlayerProfile): Scenario[] {
  const trainingScenarios = getTrainingScenarios(scenarios);
  const ranked = trainingScenarios
    .map(scenario => ({ scenario, score: scenarioProfileScore(scenario, profile) }))
    .sort((a, b) => b.score - a.score);
  const relevant = ranked.filter(item => item.score >= 2).map(item => item.scenario);
  return relevant.length >= Math.min(12, trainingScenarios.length) ? relevant : ranked.map(item => item.scenario);
}
