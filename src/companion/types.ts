import { GameFormatTag, HandAction, Street } from '../types';
import type { StrategySpot } from '../strategy-engine-v2';

export type CompanionMode = 'training' | 'play-money' | 'replay' | 'completed-real-hand' | 'live-real-money';
export type CompanionSource = 'trainer' | 'manual' | 'replay' | 'post-session' | 'external-adapter';

export interface CompanionHandState {
  schemaVersion: 1;
  handId: string;
  source: CompanionSource;
  mode: CompanionMode;
  gameFormat: GameFormatTag;
  tableSize: '6max' | '9max';
  street: Street;
  heroPosition: string;
  villainPosition?: string;
  effectiveStackBB: number;
  potBB: number;
  amountToCallBB?: number;
  heroHand?: string;
  heroCards?: string[];
  board?: string[];
  actionHistory: HandAction[];
  spot?: StrategySpot;
  openSizeBB?: number;
  anteBB?: number;
  tournamentModel?: 'chip-ev' | 'icm' | 'pko' | 'satellite';
  handComplete: boolean;
  decisionLocked?: boolean;
  updatedAt: number;
}

export interface CompanionAdvicePolicy {
  level: 'full' | 'context-only';
  canShowStrategy: boolean;
  canOpenDecisionTools: boolean;
  canShowIntervention: boolean;
  reason: string;
}
