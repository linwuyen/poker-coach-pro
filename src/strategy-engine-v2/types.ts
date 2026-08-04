export type TableSize = '6max' | '9max';
export type GameFormat = 'cash' | 'tournament';
export type StrategySpot = 'rfi' | 'vs-open' | 'push-fold';
export type StrategyAction = 'raise' | 'call' | 'fold' | 'allIn';
export type Position = 'utg' | 'utg1' | 'utg2' | 'mp' | 'hj' | 'co' | 'btn' | 'sb' | 'bb';
export type HandClass = 'pair' | 'suited' | 'offsuit';
export type StrategySourceType = 'heuristic' | 'solver' | 'expert';

export interface ActionFrequency {
  raise: number;
  call: number;
  fold: number;
  allIn: number;
}

export type PartialActionFrequency = Partial<ActionFrequency>;

export interface StrategyContext {
  format: GameFormat;
  tableSize: TableSize;
  spot: StrategySpot;
  position: Position;
  stackDepthBB: number;
  anteBB: number;
  openSizeBB?: number;
  villainPosition?: Position;
}

export interface StrategySource {
  type: StrategySourceType;
  label: string;
  reference?: string;
  generatedAt: string;
  disclaimer: string;
}

export interface StrategyProfile {
  schemaVersion: 2;
  id: string;
  version: string;
  name: string;
  description: string;
  context: StrategyContext;
  source: StrategySource;
  ranges: Record<string, PartialActionFrequency>;
  tags: string[];
}

export interface StrategyQuery extends Partial<StrategyContext> {
  hand?: string;
}

export interface StrategyMatch {
  profile: StrategyProfile;
  score: number;
  exact: boolean;
  reasons: string[];
}

export interface StrategyDecision {
  hand: string;
  handClass: HandClass;
  frequencies: ActionFrequency;
  primaryAction: StrategyAction;
  mixed: boolean;
  profile: StrategyProfile;
  matchScore: number;
  matchReasons: string[];
}

export interface RangeStats {
  totalCombos: number;
  raiseCombos: number;
  callCombos: number;
  allInCombos: number;
  foldCombos: number;
  continuePercentage: number;
  aggressivePercentage: number;
}
