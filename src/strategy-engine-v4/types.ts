import { GameFormat, Position, StrategySource, TableSize } from '../strategy-engine-v2/types';
import { PostflopAction, PostflopActionEv, PostflopActionFrequency, PostflopLineAction, PostflopStreet } from '../strategy-engine-v3/types';

export interface MultiwayOpponentState {
  position: Position;
  remainingStackBB: number;
}

export interface MultiwayTruthContext {
  format: GameFormat;
  tableSize: TableSize;
  street: PostflopStreet;
  heroPosition: Position;
  heroRemainingStackBB: number;
  opponents: MultiwayOpponentState[];
  playersInHand: number;
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

export interface MultiwayTruthNodeV4 {
  schemaVersion: 4;
  id: string;
  version: string;
  name: string;
  description: string;
  context: MultiwayTruthContext;
  source: StrategySource;
  strategyByCombo: Record<string, PostflopActionFrequency>;
  evByCombo?: Record<string, PostflopActionEv>;
  tags: string[];
  immutable?: boolean;
  contentHash?: string;
}

export interface MultiwayTruthPackV4 {
  schemaVersion: 4;
  packId: string;
  version: string;
  exportedAt: string;
  sourceReference: string;
  nodes: MultiwayTruthNodeV4[];
}

export interface MultiwayTruthQuery extends Partial<MultiwayTruthContext> {
  heroCards?: string[];
}

export interface MultiwayVerifiedRegret {
  combo: string;
  chosenAction: PostflopAction;
  bestAction: PostflopAction;
  chosenEvBB: number;
  bestEvBB: number;
  evLossBB: number;
}
