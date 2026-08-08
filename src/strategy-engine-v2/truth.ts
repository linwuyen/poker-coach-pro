import { StrategyProfile, StrategyTrustTier } from './types';

export const TRUTH_RANK: Record<StrategyTrustTier, number> = {
  'verified-solver': 6,
  'exact-math': 5,
  'population-exploit': 4,
  'expert-baseline': 3,
  'derived-interpolation': 2,
  'heuristic-estimate': 1,
};

export const TRUTH_LABEL: Record<StrategyTrustTier, string> = {
  'verified-solver': 'Verified Solver',
  'exact-math': 'Exact Math',
  'population-exploit': 'Population Evidence',
  'expert-baseline': 'Expert Baseline',
  'derived-interpolation': 'Derived / Interpolated',
  'heuristic-estimate': 'Teaching Heuristic',
};

export function truthRank(tier: StrategyTrustTier): number {
  return TRUTH_RANK[tier] || 0;
}

export function chooseHighestTruth<T extends { source: { trustTier: StrategyTrustTier } }>(items: T[]): T | undefined {
  return [...items].sort((a, b) => truthRank(b.source.trustTier) - truthRank(a.source.trustTier))[0];
}

export function truthWarnings(profile: StrategyProfile): string[] {
  const warnings: string[] = [];
  if (profile.source.trustTier === 'heuristic-estimate') warnings.push('此策略是教學估計，不是 solver 精確頻率。');
  if (profile.source.trustTier === 'derived-interpolation') warnings.push('此策略由鄰近節點推導，邊界手牌可能不可靠。');
  if (profile.mode === 'exploit' && profile.source.trustTier !== 'population-exploit') warnings.push('Exploit 調整沒有大型 population sample 支撐，請視為教學假設。');
  if (profile.source.trustTier === 'population-exploit' && !profile.source.sampleSize) warnings.push('Population profile 缺少 sample size，可信度應降級。');
  return warnings;
}

export function truthBadge(profile: StrategyProfile): { label: string; score: number; warnings: string[] } {
  return { label: TRUTH_LABEL[profile.source.trustTier], score: truthRank(profile.source.trustTier), warnings: truthWarnings(profile) };
}
