import { Position } from '../strategy-engine-v2/types';
import { PostflopAction, PostflopLineAction, PostflopStreet, PostflopTruthQuery } from '../strategy-engine-v3';
import { ParsedHandAction, ParsedHandHistory } from './handHistory';
import { forcedBetContextKey, nonstandardForcedContributionMap, nonstandardForcedStreetCommitmentMap } from './handHistoryGeometry';

export interface ObservedPostflopDecision {
  handId: string;
  actionIndex: number;
  chosenAction: PostflopAction;
  query: PostflopTruthQuery & { street: PostflopStreet; heroCards: string[] };
}

const POSITION_MAPS: Record<number, string[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'MP', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'MP', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'UTG2', 'MP', 'HJ', 'CO'],
};

function positionForPlayer(hand: ParsedHandHistory, playerName: string): Position | undefined {
  if (!hand.buttonSeat) return undefined;
  const seats = [...hand.players].sort((a, b) => a.seat - b.seat).map(player => player.seat);
  const player = hand.players.find(item => item.name === playerName);
  const buttonIndex = seats.indexOf(hand.buttonSeat);
  const playerIndex = player ? seats.indexOf(player.seat) : -1;
  if (buttonIndex < 0 || playerIndex < 0) return undefined;
  const offset = (playerIndex - buttonIndex + seats.length) % seats.length;
  const label = POSITION_MAPS[Math.min(9, Math.max(2, seats.length))]?.[offset]?.toLowerCase();
  return label && ['utg','utg1','utg2','mp','hj','co','btn','sb','bb'].includes(label) ? label as Position : undefined;
}

function actionKind(action: ParsedHandAction): PostflopAction | undefined {
  if (action.type === 'check') return 'check';
  if (action.type === 'bet') return 'bet';
  if (action.type === 'call') return 'call';
  if (action.type === 'raise') return 'raise';
  if (action.type === 'fold') return 'fold';
  if (action.type === 'all-in') return 'allIn';
  return undefined;
}

function postflopStreet(value: ParsedHandAction['street']): PostflopStreet | undefined {
  return value === 'Flop' || value === 'Turn' || value === 'River' ? value : undefined;
}

function boardForStreet(hand: ParsedHandHistory, street: PostflopStreet): string[] {
  const count = street === 'Flop' ? 3 : street === 'Turn' ? 4 : 5;
  return hand.board.slice(0, count);
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

interface ReplayState {
  potBB: number;
  street: string;
  committedStreet: Map<string, number>;
  contributedTotal: Map<string, number>;
  active: Set<string>;
  preflopLine: PostflopLineAction[];
  streetLine: PostflopLineAction[];
  lastAggressorPosition?: Position;
}

function amountAdded(action: ParsedHandAction, committed: number): number {
  if (action.toBB !== undefined && Number.isFinite(action.toBB)) return Math.max(0, action.toBB - committed);
  return Math.max(0, action.amountBB || 0);
}

function lineAction(hand: ParsedHandHistory, action: ParsedHandAction, potBefore: number, committedBefore: number): PostflopLineAction | undefined {
  const actor = positionForPlayer(hand, action.player);
  const kind = actionKind(action);
  if (!actor || !kind || action.type === 'post') return undefined;
  const added = amountAdded(action, committedBefore);
  const aggressive = kind === 'bet' || kind === 'raise' || kind === 'allIn';
  const isPreflop = action.street === 'Preflop';
  return {
    actor,
    action: kind,
    sizePot: !isPreflop && aggressive && potBefore > 0 ? round(added / potBefore) : undefined,
    toBB: isPreflop && action.toBB !== undefined ? round(action.toBB) : undefined,
  };
}

function applyAction(hand: ParsedHandHistory, action: ParsedHandAction, state: ReplayState): void {
  if (state.street !== action.street) {
    state.street = action.street;
    state.committedStreet = new Map();
    state.streetLine = [];
  }
  const committed = state.committedStreet.get(action.player) || 0;
  const potBefore = state.potBB;
  const line = lineAction(hand, action, potBefore, committed);
  if (action.type === 'fold') state.active.delete(action.player);
  if (action.type === 'post' || action.type === 'call' || action.type === 'bet' || action.type === 'raise' || action.type === 'all-in') {
    const added = amountAdded(action, committed);
    state.potBB += added;
    state.committedStreet.set(action.player, committed + added);
    state.contributedTotal.set(action.player, (state.contributedTotal.get(action.player) || 0) + added);
  }
  if (line) {
    if (action.street === 'Preflop') state.preflopLine.push(line);
    else state.streetLine.push(line);
    if (line.action === 'bet' || line.action === 'raise' || line.action === 'allIn') state.lastAggressorPosition = line.actor;
  }
}

function remainingStackBB(hand: ParsedHandHistory, player: string, state: ReplayState): number | undefined {
  const starting = hand.players.find(item => item.name === player)?.stackBB;
  if (starting === undefined) return undefined;
  return Math.max(0, starting - (state.contributedTotal.get(player) || 0));
}

/** Replays each exact Hero heads-up postflop decision, including P18 non-standard forced money. */
export function extractObservedPostflopDecisions(hand: ParsedHandHistory, options: { rakePercent?: number; rakeCapBB?: number } = {}): ObservedPostflopDecision[] {
  if (!hand.heroName || !hand.holeCards || hand.holeCards.length !== 2 || !hand.heroPosition) return [];
  if (hand.tableSize !== 6 && hand.tableSize !== 9) return [];
  const heroPosition = positionForPlayer(hand, hand.heroName);
  if (!heroPosition) return [];
  const forcedTotal = nonstandardForcedContributionMap(hand);
  const forcedLive = nonstandardForcedStreetCommitmentMap(hand);
  const forcedBetKey = forcedBetContextKey(hand);
  const state: ReplayState = {
    potBB: [...forcedTotal.values()].reduce((sum, value) => sum + value, 0),
    street: 'Preflop',
    committedStreet: new Map(forcedLive),
    contributedTotal: new Map(forcedTotal),
    active: new Set(hand.players.map(player => player.name)),
    preflopLine: [],
    streetLine: [],
  };
  const observed: ObservedPostflopDecision[] = [];

  hand.actions.forEach((action, actionIndex) => {
    if (state.street !== action.street) {
      state.street = action.street;
      state.committedStreet = new Map();
      state.streetLine = [];
    }
    const street = postflopStreet(action.street);
    const chosenAction = actionKind(action);
    if (street && action.player === hand.heroName && chosenAction && state.active.size === 2) {
      const villainName = [...state.active].find(name => name !== hand.heroName);
      const villainPosition = villainName ? positionForPlayer(hand, villainName) : undefined;
      const heroRemaining = remainingStackBB(hand, hand.heroName, state);
      const villainRemaining = villainName ? remainingStackBB(hand, villainName, state) : undefined;
      const heroCommitted = state.committedStreet.get(hand.heroName) || 0;
      const maxCommitted = Math.max(0, ...state.committedStreet.values());
      const toCallBB = Math.max(0, maxCommitted - heroCommitted);
      const effectiveStackBB = heroRemaining !== undefined && villainRemaining !== undefined ? Math.min(heroRemaining, villainRemaining) : undefined;
      const board = boardForStreet(hand, street);
      if (villainPosition && effectiveStackBB !== undefined && state.potBB > 0 && board.length === (street === 'Flop' ? 3 : street === 'Turn' ? 4 : 5)) {
        observed.push({
          handId: hand.id,
          actionIndex,
          chosenAction,
          query: {
            heroCards: [...hand.holeCards],
            format: hand.format === 'Cash' ? 'cash' : 'tournament',
            tableSize: hand.tableSize === 6 ? '6max' : '9max',
            street,
            heroPosition,
            villainPosition,
            playersInHand: 2,
            effectiveStackBB: round(effectiveStackBB),
            potBB: round(state.potBB),
            spr: round(effectiveStackBB / state.potBB),
            toCallBB: round(toCallBB),
            board,
            preflopLine: [...state.preflopLine],
            streetLine: [...state.streetLine],
            lastAggressorPosition: state.lastAggressorPosition,
            rakePercent: hand.format === 'Cash' ? options.rakePercent : undefined,
            rakeCapBB: hand.format === 'Cash' ? options.rakeCapBB : undefined,
            forcedBetKey,
          },
        });
      }
    }
    applyAction(hand, action, state);
  });
  return observed;
}
