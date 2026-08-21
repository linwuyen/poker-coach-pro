import { GameFormat, Position, StrategySource, TableSize } from '../strategy-engine-v2/types';

export type PostflopStreet = 'Flop' | 'Turn' | 'River';
export type PostflopAction = 'check' | 'bet' | 'call' | 'raise' | 'fold' | 'allIn';

export interface PostflopLineAction {
  actor: Position;
  action: PostflopAction;
  /** Bet/raise size as fraction of the pot immediately before the action. */
  sizePot?: number;
  /** Preflop raise-to amount in BB when that representation is material. */
  toBB?: number;
}

export interface PostflopTruthContext {
  format: GameFormat;
  tableSize: TableSize;
  street: PostflopStreet;
  heroPosition: Position;
  villainPosition: Position;
  playersInHand: 2;
  effectiveStackBB: number;
  potBB: number;
  spr: number;
  toCallBB: number;
  board: string[];
  preflopLine: PostflopLineAction[];
  streetLine: PostflopLineAction[];
  lastAggressorPosition?: Position;
  rakePercent?: number;
  rakeCapBB?: number;
}

export type PostflopActionFrequency = Partial<Record<PostflopAction, number>>;
export type PostflopActionEv = Partial<Record<PostflopAction, number>>;

export interface PostflopTruthNode {
  schemaVersion: 3;
  id: string;
  version: string;
  name: string;
  description: string;
  context: PostflopTruthContext;
  source: StrategySource;
  /** Exact hole-card combo key, e.g. AsKd. No rank-class fallback is allowed for automatic grading. */
  strategyByCombo: Record<string, PostflopActionFrequency>;
  evByCombo?: Record<string, PostflopActionEv>;
  actionSizesPot?: Partial<Record<'bet' | 'raise' | 'allIn', number[]>>;
  tags: string[];
  immutable?: boolean;
  contentHash?: string;
}

export interface PostflopTruthPackV3 {
  schemaVersion: 3;
  packId: string;
  version: string;
  exportedAt: string;
  sourceReference: string;
  nodes: PostflopTruthNode[];
  exporter?: string;
}

export interface PostflopTruthQuery extends Partial<PostflopTruthContext> {
  heroCards?: string[];
}

export interface PostflopVerifiedRegret {
  combo: string;
  chosenAction: PostflopAction;
  bestAction: PostflopAction;
  chosenEvBB: number;
  bestEvBB: number;
  evLossBB: number;
}
