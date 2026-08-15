import { Card, Scenario, Street } from '../types';
import type { Position, StrategySpot } from '../strategy-engine-v2';
import { CompanionHandState, CompanionMode } from './types';

const RANK_ORDER = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const POSITIONS = ['UTG+2', 'UTG+1', 'UTG', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

function cardCode(card: Card): string {
  const suit = card.suit === 'spades' ? 's' : card.suit === 'hearts' ? 'h' : card.suit === 'diamonds' ? 'd' : 'c';
  return `${card.rank}${suit}`;
}

export function cardsToStartingHand(cards: Card[]): string | undefined {
  if (cards.length !== 2) return undefined;
  const [left, right] = cards;
  if (left.rank === right.rank) return `${left.rank}${right.rank}`;
  const leftIndex = RANK_ORDER.indexOf(left.rank);
  const rightIndex = RANK_ORDER.indexOf(right.rank);
  const high = leftIndex < rightIndex ? left.rank : right.rank;
  const low = leftIndex < rightIndex ? right.rank : left.rank;
  return `${high}${low}${left.suit === right.suit ? 's' : 'o'}`;
}

function inferVillainPosition(preAction: string, heroPosition: string): string | undefined {
  const hero = heroPosition.toUpperCase();
  return POSITIONS.find(position => position !== hero && new RegExp(`(^|\\W)${position.replace('+', '\\+')}($|\\W)`, 'i').test(preAction));
}

function inferSpot(scenario: Scenario): StrategySpot {
  const text = `${scenario.title} ${(scenario.category || []).join(' ')} ${scenario.preAction}`;
  if (/4-?bet/i.test(text)) return '4bet';
  if (/3-?bet|squeeze|擠壓/i.test(text)) return '3bet';
  if (scenario.type === 'Tournament' && /push|fold|shove|all-?in|全下|短碼/i.test(text)) return 'push-fold';
  if (scenario.position.toUpperCase() === 'BB' && /open|raise|加注|開池/i.test(text)) return 'bb-defense';
  if (/fold.*to|first in|rfi|開池/i.test(text)) return 'rfi';
  return 'vs-open';
}

function inferOpenSize(preAction: string): number | undefined {
  const match = preAction.match(/(?:open|raise|加注|開池)[^0-9]*(\d+(?:\.\d+)?)\s*bb/i) || preAction.match(/(\d+(?:\.\d+)?)\s*bb/i);
  return match ? Number(match[1]) : undefined;
}

function inferTournamentModel(scenario: Scenario): CompanionHandState['tournamentModel'] {
  const text = `${scenario.title} ${(scenario.category || []).join(' ')} ${scenario.tourneyInfo || ''}`;
  if (/satellite|衛星/i.test(text)) return 'satellite';
  if (/pko|bounty|賞金/i.test(text)) return 'pko';
  if (/icm|泡沫|決賽桌|獎金/i.test(text)) return 'icm';
  return scenario.type === 'Tournament' ? 'chip-ev' : undefined;
}

export function companionStateFromScenario(
  scenario: Scenario,
  stepIndex: number,
  options: { mode?: CompanionMode; handComplete?: boolean; decisionLocked?: boolean } = {},
): CompanionHandState {
  const step = scenario.steps[Math.max(0, Math.min(stepIndex, scenario.steps.length - 1))] || scenario.steps[0];
  const handState = step?.handState;
  return {
    schemaVersion: 1,
    handId: `${scenario.id}:${step?.id || 'root'}`,
    source: 'trainer',
    mode: options.mode || 'training',
    gameFormat: scenario.type === 'Tournament' ? 'MTT' : 'Cash',
    tableSize: scenario.tableSize || '6max',
    street: step?.street || 'Preflop',
    heroPosition: scenario.position,
    villainPosition: inferVillainPosition(scenario.preAction, scenario.position),
    effectiveStackBB: scenario.userBB,
    potBB: step?.potSize || handState?.potSizeBB || 0,
    heroHand: cardsToStartingHand(scenario.holeCards),
    heroCards: scenario.holeCards.map(cardCode),
    board: (step?.communityCards || []).map(cardCode),
    actionHistory: handState?.actions || [],
    spot: inferSpot(scenario),
    openSizeBB: inferOpenSize(scenario.preAction),
    anteBB: scenario.ante ? 0.1 : 0,
    tournamentModel: inferTournamentModel(scenario),
    handComplete: Boolean(options.handComplete),
    decisionLocked: Boolean(options.decisionLocked),
    updatedAt: Date.now(),
  };
}

export interface ManualCompanionInput {
  handId?: string;
  mode: CompanionMode;
  gameFormat: 'Cash' | 'MTT';
  tableSize: '6max' | '9max';
  street: Street;
  heroPosition: string;
  villainPosition?: string;
  effectiveStackBB: number;
  potBB: number;
  amountToCallBB?: number;
  heroHand?: string;
  spot?: StrategySpot;
  openSizeBB?: number;
  anteBB?: number;
  tournamentModel?: CompanionHandState['tournamentModel'];
  handComplete?: boolean;
}

export function companionStateFromManual(input: ManualCompanionInput): CompanionHandState {
  return {
    schemaVersion: 1,
    handId: input.handId || `manual-${Date.now()}`,
    source: input.mode === 'replay' ? 'replay' : 'manual',
    mode: input.mode,
    gameFormat: input.gameFormat,
    tableSize: input.tableSize,
    street: input.street,
    heroPosition: input.heroPosition,
    villainPosition: input.villainPosition,
    effectiveStackBB: Math.max(0, input.effectiveStackBB),
    potBB: Math.max(0, input.potBB),
    amountToCallBB: input.amountToCallBB === undefined ? undefined : Math.max(0, input.amountToCallBB),
    heroHand: input.heroHand?.trim() || undefined,
    actionHistory: [],
    spot: input.spot,
    openSizeBB: input.openSizeBB,
    anteBB: input.anteBB || 0,
    tournamentModel: input.tournamentModel,
    handComplete: Boolean(input.handComplete || input.mode === 'completed-real-hand'),
    decisionLocked: false,
    updatedAt: Date.now(),
  };
}

export function normalizeStrategyPosition(input?: string): Position | undefined {
  if (!input) return undefined;
  const value = input.toLowerCase().replace(/\s+/g, '').replace('utg+1', 'utg1').replace('utg+2', 'utg2');
  return ['utg', 'utg1', 'utg2', 'mp', 'hj', 'co', 'btn', 'sb', 'bb'].includes(value) ? value as Position : undefined;
}
