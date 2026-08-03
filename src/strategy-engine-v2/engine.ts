import {
  ActionFrequency,
  HandClass,
  RangeStats,
  StrategyAction,
  StrategyDecision,
  StrategyMatch,
  StrategyProfile,
  StrategyQuery,
} from './types';

export const STRATEGY_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

const ACTIONS: StrategyAction[] = ['raise', 'call', 'allIn', 'fold'];
const clamp = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export function normalizeHand(input: string): string {
  const raw = input.trim().toUpperCase().replace(/10/g, 'T');
  const match = raw.match(/^([AKQJT2-9])([AKQJT2-9])([SO])?$/);
  if (!match) throw new Error(`Invalid poker hand: ${input}`);
  const [, first, second, suffix] = match;
  const firstIndex = STRATEGY_RANKS.indexOf(first as (typeof STRATEGY_RANKS)[number]);
  const secondIndex = STRATEGY_RANKS.indexOf(second as (typeof STRATEGY_RANKS)[number]);
  if (first === second) return `${first}${second}`;
  const high = firstIndex < secondIndex ? first : second;
  const low = firstIndex < secondIndex ? second : first;
  if (!suffix) throw new Error(`Non-pair hand requires s or o suffix: ${input}`);
  return `${high}${low}${suffix.toLowerCase()}`;
}

export function getHandClass(handInput: string): HandClass {
  const hand = normalizeHand(handInput);
  if (hand.length === 2) return 'pair';
  return hand.endsWith('s') ? 'suited' : 'offsuit';
}

export function getComboCount(handInput: string): number {
  const handClass = getHandClass(handInput);
  return handClass === 'pair' ? 6 : handClass === 'suited' ? 4 : 12;
}

export function getAllStartingHands(): string[] {
  const result: string[] = [];
  STRATEGY_RANKS.forEach((rowRank, row) => {
    STRATEGY_RANKS.forEach((columnRank, column) => {
      if (row === column) result.push(`${rowRank}${columnRank}`);
      else if (row < column) result.push(`${rowRank}${columnRank}s`);
      else result.push(`${columnRank}${rowRank}o`);
    });
  });
  return result;
}

export function normalizeFrequencies(input: Partial<ActionFrequency> = {}): ActionFrequency {
  const values: ActionFrequency = {
    raise: clamp(input.raise || 0),
    call: clamp(input.call || 0),
    allIn: clamp(input.allIn || 0),
    fold: clamp(input.fold || 0),
  };
  const sum = ACTIONS.reduce((total, action) => total + values[action], 0);
  if (sum > 1) {
    ACTIONS.forEach(action => { values[action] /= sum; });
  } else if (sum < 1) {
    values.fold += 1 - sum;
  }
  return values;
}

export function getPrimaryAction(frequencies: ActionFrequency): StrategyAction {
  return ACTIONS.reduce((best, action) => frequencies[action] > frequencies[best] ? action : best, 'fold');
}

export function isMixedStrategy(frequencies: ActionFrequency): boolean {
  return ACTIONS.filter(action => frequencies[action] >= 0.05).length > 1;
}

export function findBestProfile(profiles: StrategyProfile[], query: StrategyQuery): StrategyMatch {
  if (profiles.length === 0) throw new Error('Strategy Engine v2 has no profiles.');
  const scored = profiles.map(profile => {
    let score = 0;
    const reasons: string[] = [];
    const exactChecks: boolean[] = [];

    const match = <K extends keyof StrategyQuery>(key: K, weight: number, label: string) => {
      const expected = query[key];
      if (expected === undefined) return;
      const actual = profile.context[key as keyof typeof profile.context];
      const exact = actual === expected;
      exactChecks.push(exact);
      if (exact) {
        score += weight;
        reasons.push(`${label}完全符合`);
      } else {
        score -= weight;
      }
    };

    match('format', 25, '賽制');
    match('tableSize', 25, '桌型');
    match('spot', 30, '決策節點');
    match('position', 35, '位置');
    match('villainPosition', 10, '對手位置');

    if (query.stackDepthBB !== undefined) {
      const distance = Math.abs(profile.context.stackDepthBB - query.stackDepthBB);
      score += Math.max(0, 20 - distance * 0.75);
      exactChecks.push(distance <= 1);
      reasons.push(distance <= 1 ? '有效籌碼完全符合' : `採用最接近的 ${profile.context.stackDepthBB}BB 模型`);
    }
    if (query.anteBB !== undefined) {
      const distance = Math.abs(profile.context.anteBB - query.anteBB);
      score += Math.max(0, 8 - distance * 16);
      exactChecks.push(distance < 0.01);
    }
    if (query.openSizeBB !== undefined && profile.context.openSizeBB !== undefined) {
      const distance = Math.abs(profile.context.openSizeBB - query.openSizeBB);
      score += Math.max(0, 7 - distance * 4);
      exactChecks.push(distance < 0.1);
    }

    return { profile, score, exact: exactChecks.length > 0 && exactChecks.every(Boolean), reasons };
  });
  return scored.sort((a, b) => b.score - a.score)[0];
}

export function getDecision(profile: StrategyProfile, handInput: string, matchScore = 100, matchReasons: string[] = []): StrategyDecision {
  const hand = normalizeHand(handInput);
  const frequencies = normalizeFrequencies(profile.ranges[hand]);
  return {
    hand,
    handClass: getHandClass(hand),
    frequencies,
    primaryAction: getPrimaryAction(frequencies),
    mixed: isMixedStrategy(frequencies),
    profile,
    matchScore,
    matchReasons,
  };
}

export function queryStrategy(profiles: StrategyProfile[], query: StrategyQuery): StrategyDecision {
  if (!query.hand) throw new Error('Strategy query requires a starting hand.');
  const match = findBestProfile(profiles, query);
  return getDecision(match.profile, query.hand, match.score, match.reasons);
}

export function getRangeStats(profile: StrategyProfile): RangeStats {
  let raiseCombos = 0;
  let callCombos = 0;
  let allInCombos = 0;
  let foldCombos = 0;
  getAllStartingHands().forEach(hand => {
    const combos = getComboCount(hand);
    const frequency = normalizeFrequencies(profile.ranges[hand]);
    raiseCombos += combos * frequency.raise;
    callCombos += combos * frequency.call;
    allInCombos += combos * frequency.allIn;
    foldCombos += combos * frequency.fold;
  });
  const totalCombos = raiseCombos + callCombos + allInCombos + foldCombos;
  return {
    totalCombos,
    raiseCombos,
    callCombos,
    allInCombos,
    foldCombos,
    continuePercentage: ((raiseCombos + callCombos + allInCombos) / totalCombos) * 100,
    aggressivePercentage: ((raiseCombos + allInCombos) / totalCombos) * 100,
  };
}

export function formatFrequency(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function describeDecision(decision: StrategyDecision): string {
  const entries = ACTIONS
    .filter(action => decision.frequencies[action] >= 0.05)
    .map(action => `${action} ${formatFrequency(decision.frequencies[action])}`);
  return decision.mixed ? `混合策略：${entries.join('、')}` : `主要策略：${entries[0] || 'fold 100%'}`;
}
