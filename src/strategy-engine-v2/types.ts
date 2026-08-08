export type TableSize = '6max' | '9max';
export type GameFormat = 'cash' | 'tournament';
export type StrategySpot = 'rfi' | 'vs-open' | 'bb-defense' | '3bet' | '4bet' | 'push-fold';
export type StrategyAction = 'raise' | 'call' | 'limp' | 'fold' | 'allIn';
export type Position = 'utg' | 'utg1' | 'utg2' | 'mp' | 'hj' | 'co' | 'btn' | 'sb' | 'bb';
export type HandClass = 'pair' | 'suited' | 'offsuit';
export type StrategySourceType = 'heuristic' | 'solver' | 'expert' | 'population' | 'derived';
export type StrategyTrustTier = 'verified-solver' | 'exact-math' | 'population-exploit' | 'expert-baseline' | 'derived-interpolation' | 'heuristic-estimate';
export type StrategyMode = 'theory' | 'exploit';
export type VillainArchetype = 'population' | 'nit' | 'tag' | 'lag' | 'calling-station';

export interface ActionFrequency {
  raise: number;
  call: number;
  limp: number;
  fold: number;
  allIn: number;
}

export type PartialActionFrequency = Partial<ActionFrequency>;

export interface BetTreeConfig {
  openSizesBB?: number[];
  threeBetSizesBB?: number[];
  fourBetSizesBB?: number[];
  jamAllowed?: boolean;
  notes?: string;
}

export interface IcmContext {
  model: 'chip-ev' | 'icm' | 'fgs';
  playersRemaining?: number;
  paidPlaces?: number;
  payoutReference?: string;
  riskPremiumPercent?: number;
}

export interface StrategyContext {
  format: GameFormat;
  tableSize: TableSize;
  spot: StrategySpot;
  position: Position;
  stackDepthBB: number;
  anteBB: number;
  openSizeBB?: number;
  villainPosition?: Position;
  rakePercent?: number;
  rakeCapBB?: number;
  betTree?: BetTreeConfig;
  icm?: IcmContext;
}

export interface StrategySource {
  type: StrategySourceType;
  trustTier: StrategyTrustTier;
  label: string;
  reference?: string;
  solverName?: string;
  solverVersion?: string;
  generatedAt: string;
  authoredBy?: string;
  reviewedBy?: string[];
  sampleSize?: number;
  disclaimer: string;
}

export type HandActionEv = Partial<Record<StrategyAction, number>>;

export interface StrategyProfile {
  schemaVersion: 2;
  id: string;
  version: string;
  name: string;
  description: string;
  context: StrategyContext;
  source: StrategySource;
  ranges: Record<string, PartialActionFrequency>;
  evByHand?: Record<string, HandActionEv>;
  actionSizesBB?: Partial<Record<StrategyAction, number[]>>;
  tags: string[];
  mode?: StrategyMode;
  villainArchetype?: VillainArchetype;
  immutable?: boolean;
  contentHash?: string;
}

export interface StrategyQuery extends Partial<StrategyContext> {
  hand?: string;
  allowApproximate?: boolean;
  mode?: StrategyMode;
  villainArchetype?: VillainArchetype;
}

export interface StrategyMatch {
  profile: StrategyProfile;
  score: number;
  exact: boolean;
  reasons: string[];
  warnings: string[];
}

export interface StrategyDecision {
  hand: string;
  handClass: HandClass;
  frequencies: ActionFrequency;
  primaryAction: StrategyAction | null;
  mixed: boolean;
  profile: StrategyProfile;
  matchScore: number;
  matchReasons: string[];
  warnings: string[];
  actionEv?: HandActionEv;
  bestEvBB?: number;
  primaryEvLossBB?: number;
}

export type StrategyQueryResult =
  | { status: 'exact'; decision: StrategyDecision; profile: StrategyProfile; warnings: string[] }
  | { status: 'approximate'; decision: StrategyDecision; profile: StrategyProfile; warnings: string[] }
  | { status: 'unsupported'; missingContexts: string[]; warnings: string[] };

export interface RangeStats {
  totalCombos: number;
  raiseCombos: number;
  callCombos: number;
  limpCombos: number;
  allInCombos: number;
  foldCombos: number;
  continuePercentage: number;
  aggressivePercentage: number;
}

export interface SolverImportEnvelope {
  schemaVersion: 2;
  exportedAt: string;
  profiles: StrategyProfile[];
  exporter?: string;
}
