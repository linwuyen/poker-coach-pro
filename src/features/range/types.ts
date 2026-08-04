export type RangeBucket = 'monster' | 'strong' | 'medium' | 'draw' | 'air';
export type HeroAction = 'fold' | 'call';
export type RangeFrequency = 0 | 0.5 | 1;
export type EquityBand = 'under-30' | '30-39' | '40-49' | '50-59' | '60-plus';

export interface RangeOption {
  hand: string;
  bucket: RangeBucket;
  combos: number;
  heroEquity: number;
  baselineFrequency: number;
}

export interface RangeQuestionSource {
  trustTier: 'verified-solver' | 'expert-baseline' | 'heuristic-estimate';
  label: string;
  disclaimer: string;
}

export interface RangeQuestion {
  id: string;
  title: string;
  table: string;
  stack: string;
  villain: string;
  heroHand: string;
  heroPosition: string;
  action: string[];
  board?: string;
  potAfterBet: number;
  callCost: number;
  prompt: string;
  category: string[];
  difficulty: '新手' | '中階' | '進階';
  options: RangeOption[];
  explanation: string;
  blockerNote?: string;
  assumptions: string[];
  source: RangeQuestionSource;
}

export interface WeightedRangeSelection {
  hand: string;
  frequency: number;
}

export interface RangeCalculation {
  weightedCombos: number;
  heroEquity: number;
  potOdds: number;
  callEvBB: number;
  foldEvBB: number;
  bestAction: HeroAction;
}
