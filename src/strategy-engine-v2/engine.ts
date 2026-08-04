import {
  ActionFrequency,
  HandClass,
  RangeStats,
  StrategyAction,
  StrategyDecision,
  StrategyMatch,
  StrategyProfile,
  StrategyQuery,
  StrategyQueryResult,
} from './types';

export const STRATEGY_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

const ACTIONS: StrategyAction[] = ['raise', 'call', 'limp', 'allIn', 'fold'];
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
    limp: clamp(input.limp || 0),
    allIn: clamp(input.allIn || 0),
    fold: clamp(input.fold || 0),
  };
  const sum = ACTIONS.reduce((total, action) => total + values[action], 0);
  if (sum > 1) ACTIONS.forEach(action => { values[action] /= sum; });
  else if (sum < 1) values.fold += 1 - sum;
  return values;
}

export function getPrimaryAction(frequencies: ActionFrequency): StrategyAction | null {
  const ordered = [...ACTIONS].sort((a, b) => frequencies[b] - frequencies[a]);
  if (Math.abs(frequencies[ordered[0]] - frequencies[ordered[1]]) < 0.001) return null;
  return ordered[0];
}

export function isMixedStrategy(frequencies: ActionFrequency): boolean {
  const active = ACTIONS.filter(action => frequencies[action] >= 0.05);
  return active.length > 1 && Math.max(...active.map(action => frequencies[action])) < 0.95;
}

export function findBestProfile(profiles: StrategyProfile[], query: StrategyQuery): StrategyMatch {
  if (profiles.length === 0) throw new Error('Strategy Engine v2 has no profiles.');
  const scored = profiles.map(profile => scoreProfile(profile, query));
  return scored.sort((a, b) => b.score - a.score)[0];
}

function scoreProfile(profile: StrategyProfile, query: StrategyQuery): StrategyMatch {
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];
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
      warnings.push(`${label}不符合`);
    }
  };

  match('format', 30, '賽制');
  match('tableSize', 30, '桌型');
  match('spot', 45, '決策節點');
  match('position', 45, 'Hero 位置');
  match('villainPosition', 20, '對手位置');

  if (query.stackDepthBB !== undefined) {
    const distance = Math.abs(profile.context.stackDepthBB - query.stackDepthBB);
    score += Math.max(0, 25 - distance);
    exactChecks.push(distance <= 1);
    if (distance <= 1) reasons.push('有效籌碼完全符合');
    else warnings.push(`有效籌碼採用最接近的 ${profile.context.stackDepthBB}BB`);
  }
  if (query.anteBB !== undefined) {
    const distance = Math.abs(profile.context.anteBB - query.anteBB);
    score += Math.max(0, 10 - distance * 20);
    exactChecks.push(distance < 0.01);
    if (distance >= 0.01) warnings.push(`Ante 使用 ${profile.context.anteBB}BB 模型`);
  }
  if (query.openSizeBB !== undefined) {
    const actual = profile.context.openSizeBB;
    if (actual === undefined) warnings.push('Profile 未記錄 open size');
    else {
      const distance = Math.abs(actual - query.openSizeBB);
      score += Math.max(0, 8 - distance * 4);
      exactChecks.push(distance < 0.1);
      if (distance >= 0.1) warnings.push(`Open size 使用 ${actual}BB 模型`);
    }
  }
  if (query.icm?.model && profile.context.icm?.model !== query.icm.model) warnings.push('ICM/Chip-EV 模型不符合');
  return { profile, score, exact: exactChecks.length > 0 && exactChecks.every(Boolean), reasons, warnings };
}

export function queryStrategy(profiles: StrategyProfile[], query: StrategyQuery): StrategyQueryResult {
  if (!query.hand) return { status: 'unsupported', missingContexts: ['hand'], warnings: ['缺少起手牌'] };
  const hardKeys: Array<keyof StrategyQuery> = ['format', 'tableSize', 'spot', 'position', 'villainPosition'];
  const candidates = profiles.filter(profile => hardKeys.every(key => {
    const expected = query[key];
    if (expected === undefined) return true;
    return profile.context[key as keyof typeof profile.context] === expected;
  }));
  if (!candidates.length) {
    const supplied = hardKeys.filter(key => query[key] !== undefined).map(String);
    return { status: 'unsupported', missingContexts: supplied, warnings: ['沒有符合賽制、桌型、節點與位置的策略資料；系統拒絕以其他節點代答。'] };
  }

  const match = findBestProfile(candidates, query);
  const stackDistance = query.stackDepthBB === undefined ? 0 : Math.abs(match.profile.context.stackDepthBB - query.stackDepthBB);
  const maxApproximateDistance = Math.max(5, match.profile.context.stackDepthBB * 0.2);
  if (stackDistance > maxApproximateDistance && !query.allowApproximate) {
    return {
      status: 'unsupported',
      missingContexts: ['stackDepthBB'],
      warnings: [`最接近模型為 ${match.profile.context.stackDepthBB}BB，與查詢差距過大。`],
    };
  }
  if (query.icm?.model && match.profile.context.icm?.model !== query.icm.model) {
    return { status: 'unsupported', missingContexts: ['icm.model'], warnings: ['ICM 節點不可使用 Chip-EV Profile 近似。'] };
  }

  const decision = getDecision(match.profile, query.hand, match.score, match.reasons, match.warnings);
  const approximate = !match.exact || match.warnings.length > 0;
  return {
    status: approximate ? 'approximate' : 'exact',
    profile: match.profile,
    decision,
    warnings: match.warnings,
  };
}

export function getDecision(
  profile: StrategyProfile,
  handInput: string,
  matchScore = 100,
  matchReasons: string[] = [],
  warnings: string[] = [],
): StrategyDecision {
  const hand = normalizeHand(handInput);
  const frequencies = normalizeFrequencies(profile.ranges[hand]);
  const primaryAction = getPrimaryAction(frequencies);
  const actionEv = profile.evByHand?.[hand];
  const evValues = actionEv ? Object.values(actionEv).filter((value): value is number => typeof value === 'number') : [];
  const bestEvBB = evValues.length ? Math.max(...evValues) : undefined;
  const primaryEv = primaryAction && actionEv ? actionEv[primaryAction] : undefined;
  return {
    hand,
    handClass: getHandClass(hand),
    frequencies,
    primaryAction,
    mixed: isMixedStrategy(frequencies),
    profile,
    matchScore,
    matchReasons,
    warnings,
    actionEv,
    bestEvBB,
    primaryEvLossBB: bestEvBB !== undefined && primaryEv !== undefined ? bestEvBB - primaryEv : undefined,
  };
}

export function getRangeStats(profile: StrategyProfile): RangeStats {
  let raiseCombos = 0;
  let callCombos = 0;
  let limpCombos = 0;
  let allInCombos = 0;
  let foldCombos = 0;
  getAllStartingHands().forEach(hand => {
    const combos = getComboCount(hand);
    const frequency = normalizeFrequencies(profile.ranges[hand]);
    raiseCombos += combos * frequency.raise;
    callCombos += combos * frequency.call;
    limpCombos += combos * frequency.limp;
    allInCombos += combos * frequency.allIn;
    foldCombos += combos * frequency.fold;
  });
  const totalCombos = raiseCombos + callCombos + limpCombos + allInCombos + foldCombos;
  return {
    totalCombos,
    raiseCombos,
    callCombos,
    limpCombos,
    allInCombos,
    foldCombos,
    continuePercentage: ((raiseCombos + callCombos + limpCombos + allInCombos) / totalCombos) * 100,
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
  if (decision.primaryAction === null) return `平衡混合：${entries.join('、')}`;
  return decision.mixed ? `混合策略：${entries.join('、')}` : `主要策略：${entries[0] || 'fold 100%'}`;
}
