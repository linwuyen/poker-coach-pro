import { HistoryItem } from '../types';
import {
  Position,
  StrategyAction,
  StrategyProfile,
  StrategyQuery,
  StrategySpot,
  findExactVerifiedTruthProfile,
  strategyContextCoverageKey,
  verifiedActionRegret,
} from '../strategy-engine-v2';
import { ParsedHandAction, ParsedHandHistory } from './handHistory';

export interface LeakPipelineOptions {
  importedAt?: number;
  rakePercent?: number;
  rakeCapBB?: number;
}

export interface VerifiedLeakFinding {
  decisionFamilyId: string;
  profileKey: string;
  hand: string;
  position: string;
  street: 'Preflop';
  chosenAction: StrategyAction;
  bestAction: StrategyAction;
  occurrences: number;
  totalEvLossBB: number;
  averageEvLossBB: number;
  sourceReference?: string;
}

export interface LeakPipelineResult {
  history: HistoryItem[];
  findings: VerifiedLeakFinding[];
  heroDecisions: number;
  matchedDecisions: number;
  gradedDecisions: number;
  unsupportedDecisions: number;
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
  return ['utg', 'utg1', 'utg2', 'mp', 'hj', 'co', 'btn', 'sb', 'bb'].includes(label) ? label as Position : undefined;
}

function startingHandClass(cards: string[] | undefined): string | undefined {
  if (!cards || cards.length !== 2) return undefined;
  const match = cards.map(card => card.match(/^([2-9TJQKA])([shdc])$/i));
  if (match.some(value => !value)) return undefined;
  const [first, second] = match as RegExpMatchArray[];
  const ranks = 'AKQJT98765432';
  if (first[1].toUpperCase() === second[1].toUpperCase()) return `${first[1].toUpperCase()}${second[1].toUpperCase()}`;
  const ordered = [first[1].toUpperCase(), second[1].toUpperCase()].sort((a, b) => ranks.indexOf(a) - ranks.indexOf(b));
  return `${ordered[0]}${ordered[1]}${first[2].toLowerCase() === second[2].toLowerCase() ? 's' : 'o'}`;
}

function strategyAction(action: ParsedHandAction): StrategyAction | undefined {
  if (action.type === 'fold') return 'fold';
  if (action.type === 'call') return 'call';
  if (action.type === 'raise' || action.type === 'bet') return 'raise';
  if (action.type === 'all-in') return 'allIn';
  return undefined;
}

function anteBB(hand: ParsedHandHistory): number {
  const ante = hand.actions.find(action => action.street === 'Preflop' && action.type === 'post' && /ante/i.test(action.raw));
  return ante?.amountBB || 0;
}

function effectiveStack(hand: ParsedHandHistory, villainName?: string): number | undefined {
  const hero = hand.heroName ? hand.players.find(player => player.name === hand.heroName) : undefined;
  const villain = villainName ? hand.players.find(player => player.name === villainName) : undefined;
  if (!hero) return undefined;
  if (villain) return Math.min(hero.stackBB, villain.stackBB);
  // Multiway first-in decisions are only safe to match when the profile stack is compatible with
  // the shortest live effective stack. Using Hero stack alone could misgrade 100BB Hero vs 20BB blind.
  const liveStacks = hand.players.map(player => player.stackBB).filter(value => Number.isFinite(value) && value > 0);
  return liveStacks.length ? Math.min(...liveStacks) : hero.stackBB;
}

function candidateSpots(priorAggressions: ParsedHandAction[], heroPosition?: Position): StrategySpot[] {
  if (!priorAggressions.length) return ['rfi', 'push-fold'];
  if (priorAggressions.length === 1) return heroPosition === 'bb' ? ['bb-defense', 'vs-open'] : ['vs-open', '3bet'];
  return ['4bet'];
}

function skillIds(spot: StrategySpot): string[] {
  if (spot === 'bb-defense') return ['preflop.bb-defense'];
  if (spot === '3bet') return ['preflop.3bet'];
  if (spot === '4bet') return ['preflop.4bet'];
  if (spot === 'push-fold') return ['tournament.push-fold'];
  return ['preflop.rfi'];
}

interface GradedDecision {
  item: HistoryItem;
  finding: Omit<VerifiedLeakFinding, 'occurrences' | 'totalEvLossBB' | 'averageEvLossBB'> & { evLossBB: number };
}

function gradeHand(hand: ParsedHandHistory, profiles: StrategyProfile[], options: LeakPipelineOptions, handsObserved: number): { heroDecisions: number; matched: number; graded: GradedDecision[] } {
  if (!hand.heroName || !hand.holeCards || !hand.heroPosition) return { heroDecisions: 0, matched: 0, graded: [] };
  if (hand.tableSize !== 6 && hand.tableSize !== 9) return { heroDecisions: 0, matched: 0, graded: [] };
  const heroPosition = hand.heroPosition.toLowerCase() as Position;
  const handClass = startingHandClass(hand.holeCards);
  if (!handClass) return { heroDecisions: 0, matched: 0, graded: [] };
  const preflop = hand.actions.filter(action => action.street === 'Preflop');
  let heroDecisions = 0;
  let matched = 0;
  const graded: GradedDecision[] = [];

  preflop.forEach((action, index) => {
    if (action.player !== hand.heroName || action.type === 'post') return;
    const chosenAction = strategyAction(action);
    if (!chosenAction) return;
    heroDecisions += 1;
    const earlier = preflop.slice(0, index);
    const priorAggressions = earlier.filter(item => item.type === 'raise' || item.type === 'all-in');
    const lastAggressor = [...priorAggressions].reverse().find(item => item.player !== hand.heroName);
    const villainPosition = lastAggressor ? positionForPlayer(hand, lastAggressor.player) : undefined;
    const firstAggression = priorAggressions[0];
    const openSizeBB = firstAggression?.toBB ?? firstAggression?.amountBB;
    const base: Omit<StrategyQuery, 'spot'> = {
      hand: handClass,
      format: hand.format === 'Cash' ? 'cash' : 'tournament',
      tableSize: hand.tableSize === 6 ? '6max' : '9max',
      position: heroPosition,
      villainPosition,
      stackDepthBB: effectiveStack(hand, lastAggressor?.player),
      anteBB: anteBB(hand),
      openSizeBB,
      rakePercent: hand.format === 'Cash' ? options.rakePercent : undefined,
      rakeCapBB: hand.format === 'Cash' ? options.rakeCapBB : undefined,
      icm: hand.format === 'MTT' ? { model: 'chip-ev' } : undefined,
    };
    const matches = candidateSpots(priorAggressions, heroPosition)
      .map(spot => ({ spot, profile: findExactVerifiedTruthProfile(profiles, { ...base, spot }) }))
      .filter((entry): entry is { spot: StrategySpot; profile: StrategyProfile } => Boolean(entry.profile));
    if (matches.length !== 1) return;
    matched += 1;
    const { spot, profile } = matches[0];
    const regret = verifiedActionRegret(profile, handClass, chosenAction);
    if (!regret) return;
    const decisionFamilyId = `solver:${profile.id}:${handClass}`;
    const contextFamilyId = strategyContextCoverageKey(profile);
    const timestamp = hand.timestamp || options.importedAt || Date.now();
    const isCash = hand.format === 'Cash';
    const item: HistoryItem = {
      schemaVersion: 6,
      trainingType: 'real-hand',
      scenarioId: `hh-grade:${hand.id}:${index}`,
      sourceHandId: hand.id,
      decisionFamilyId,
      category: ['Real Game', 'Verified Leak'],
      score: regret.evLossBB <= 0.01 ? 10 : Math.max(0, 10 - regret.evLossBB * 5),
      judgment: regret.evLossBB <= 0.01 ? 'solver-aligned' : 'verified-regret',
      timestamp,
      selectedAction: regret.chosenAction,
      bestAction: regret.bestAction,
      correct: regret.evLossBB <= 0.01,
      street: 'Preflop',
      position: hand.heroPosition,
      chosenEvBB: regret.chosenEvBB,
      bestEvBB: regret.bestEvBB,
      evLossBB: regret.evLossBB,
      truthTier: 'verified-solver',
      truthSourceId: profile.id,
      truthSourceRef: profile.source.reference,
      truthSourceRevision: profile.source.solverVersion || profile.version,
      contextFamilyId,
      evidenceFamilyId: `${hand.format}:${contextFamilyId}`,
      skillIds: skillIds(spot),
      situationIds: [`spot.${spot}`, `position.${heroPosition}`, `source.${hand.source}`],
      gameFormat: hand.format,
      handsObserved,
      spotExposureCount: 1,
      spotFrequencyPer100Hands: handsObserved > 0 ? 100 / handsObserved : undefined,
      utilityLoss: isCash ? regret.evLossBB : undefined,
      utilityUnit: isCash ? 'bb' : undefined,
      utilityModel: isCash ? 'cash-chip-ev' : 'priority-only',
      realGameSource: hand.source,
      notes: `Auto-graded only because HH context matched one verified immutable surface exactly. Profile ${profile.id}@${profile.version}. Tournament chip-EV regret is not relabelled as reportable dollar utility.`,
    };
    graded.push({
      item,
      finding: {
        decisionFamilyId, profileKey: `${profile.id}@${profile.version}`, hand: handClass, position: hand.heroPosition!, street: 'Preflop',
        chosenAction: regret.chosenAction, bestAction: regret.bestAction, evLossBB: regret.evLossBB, sourceReference: profile.source.reference,
      },
    });
  });
  return { heroDecisions, matched, graded };
}

export function buildVerifiedLeakEvidence(hands: ParsedHandHistory[], profiles: StrategyProfile[], options: LeakPipelineOptions = {}): LeakPipelineResult {
  const graded: GradedDecision[] = [];
  let heroDecisions = 0;
  let matchedDecisions = 0;
  hands.forEach(hand => {
    const result = gradeHand(hand, profiles, options, hands.length);
    heroDecisions += result.heroDecisions;
    matchedDecisions += result.matched;
    graded.push(...result.graded);
  });
  const grouped = new Map<string, VerifiedLeakFinding>();
  graded.forEach(entry => {
    const key = entry.finding.decisionFamilyId;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, { ...entry.finding, occurrences: 1, totalEvLossBB: entry.finding.evLossBB, averageEvLossBB: entry.finding.evLossBB });
    } else {
      current.occurrences += 1;
      current.totalEvLossBB += entry.finding.evLossBB;
      current.averageEvLossBB = current.totalEvLossBB / current.occurrences;
    }
  });
  const findings = [...grouped.values()].sort((a, b) => b.totalEvLossBB - a.totalEvLossBB || b.occurrences - a.occurrences);
  return {
    history: graded.map(entry => entry.item),
    findings,
    heroDecisions,
    matchedDecisions,
    gradedDecisions: graded.length,
    unsupportedDecisions: Math.max(0, heroDecisions - matchedDecisions),
  };
}
