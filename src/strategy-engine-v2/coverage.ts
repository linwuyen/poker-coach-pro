import { normalizeFrequencies, normalizeHand } from './engine';
import { StrategyAction, StrategyProfile, StrategyQuery } from './types';

export interface TruthCoverageRow {
  profileKey: string;
  profileId: string;
  version: string;
  contextKey: string;
  verified: boolean;
  frequencyHands: number;
  evHands: number;
  mixedHands: number;
  fullEvHands: number;
}

export interface TruthCoverageReport {
  profiles: number;
  verifiedSolverProfiles: number;
  contexts: number;
  frequencyHands: number;
  evHands: number;
  fullEvHands: number;
  mixedHands: number;
  rows: TruthCoverageRow[];
}

const ACTIONS: StrategyAction[] = ['raise', 'call', 'limp', 'allIn', 'fold'];

export function strategyContextCoverageKey(profile: Pick<StrategyProfile, 'context'>): string {
  const c = profile.context;
  return [
    c.format,
    c.tableSize,
    c.spot,
    c.position,
    c.villainPosition || '-',
    `${c.stackDepthBB}bb`,
    `ante:${c.anteBB}`,
    `open:${c.openSizeBB ?? '-'}`,
    `rake:${c.rakePercent ?? '-'}`,
    `cap:${c.rakeCapBB ?? '-'}`,
    `icm:${c.icm?.model || '-'}`,
    `forced:${c.forcedBetKey || '-'}`,
  ].join('|');
}

export function buildTruthCoverageReport(profiles: StrategyProfile[]): TruthCoverageReport {
  const rows = profiles.map(profile => {
    const hands = Object.keys(profile.ranges || {});
    const evHands = Object.keys(profile.evByHand || {});
    const mixedHands = hands.filter(hand => {
      const f = normalizeFrequencies(profile.ranges[hand]);
      return ACTIONS.filter(action => f[action] >= 0.05).length > 1;
    }).length;
    const fullEvHands = evHands.filter(hand => {
      const ev = profile.evByHand?.[hand] || {};
      return ACTIONS.filter(action => typeof ev[action] === 'number' && Number.isFinite(ev[action])).length >= 2;
    }).length;
    return {
      profileKey: `${profile.id}@${profile.version}`,
      profileId: profile.id,
      version: profile.version,
      contextKey: strategyContextCoverageKey(profile),
      verified: profile.source.trustTier === 'verified-solver',
      frequencyHands: hands.length,
      evHands: evHands.length,
      mixedHands,
      fullEvHands,
    };
  });
  const verifiedRows = rows.filter(row => row.verified);
  return {
    profiles: rows.length,
    verifiedSolverProfiles: verifiedRows.length,
    contexts: new Set(verifiedRows.map(row => row.contextKey)).size,
    frequencyHands: verifiedRows.reduce((sum, row) => sum + row.frequencyHands, 0),
    evHands: verifiedRows.reduce((sum, row) => sum + row.evHands, 0),
    fullEvHands: verifiedRows.reduce((sum, row) => sum + row.fullEvHands, 0),
    mixedHands: verifiedRows.reduce((sum, row) => sum + row.mixedHands, 0),
    rows,
  };
}

function sameOptionalNumber(actual: number | undefined, observed: number | undefined, tolerance: number): boolean {
  if (actual === undefined) return observed === undefined;
  return observed !== undefined && Math.abs(actual - observed) <= tolerance;
}

function normalizeObservedHand(query: StrategyQuery): string | undefined {
  if (!query.hand) return undefined;
  try { return normalizeHand(query.hand); } catch { return undefined; }
}

function isExactVerifiedMatch(profile: StrategyProfile, query: StrategyQuery, hand: string): boolean {
  if (profile.source.trustTier !== 'verified-solver') return false;
  const c = profile.context;
  if (query.format !== c.format) return false;
  if (query.tableSize !== c.tableSize) return false;
  if (query.spot !== c.spot) return false;
  if (query.position !== c.position) return false;
  if (query.villainPosition !== c.villainPosition) return false;
  if (!sameOptionalNumber(c.stackDepthBB, query.stackDepthBB, 1)) return false;
  if (!sameOptionalNumber(c.anteBB, query.anteBB, 0.01)) return false;
  if (!sameOptionalNumber(c.openSizeBB, query.openSizeBB, 0.1)) return false;
  if (!sameOptionalNumber(c.rakePercent, query.rakePercent, 0.1)) return false;
  if (!sameOptionalNumber(c.rakeCapBB, query.rakeCapBB, 0.1)) return false;
  if (query.icm?.model !== c.icm?.model) return false;
  if ((query.forcedBetKey || undefined) !== (c.forcedBetKey || undefined)) return false;
  return Boolean(profile.ranges[hand]);
}

/** Strict automated matching returns all exact verified candidates so ambiguity is observable. */
export function findExactVerifiedTruthProfiles(profiles: StrategyProfile[], query: StrategyQuery): StrategyProfile[] {
  const hand = normalizeObservedHand(query);
  if (!hand) return [];
  return profiles.filter(profile => isExactVerifiedMatch(profile, query, hand));
}

/**
 * Automated grading gets a profile only when the exact match set has cardinality one.
 * Zero matches are Unknown; multiple matching solver versions are Ambiguous/Unknown rather than array-order truth.
 */
export function findExactVerifiedTruthProfile(profiles: StrategyProfile[], query: StrategyQuery): StrategyProfile | undefined {
  const matches = findExactVerifiedTruthProfiles(profiles, query);
  return matches.length === 1 ? matches[0] : undefined;
}

export interface VerifiedActionRegret {
  hand: string;
  chosenAction: StrategyAction;
  bestAction: StrategyAction;
  chosenEvBB: number;
  bestEvBB: number;
  evLossBB: number;
}

export function verifiedActionRegret(profile: StrategyProfile, handInput: string, chosenAction: StrategyAction): VerifiedActionRegret | undefined {
  if (profile.source.trustTier !== 'verified-solver') return undefined;
  const hand = normalizeHand(handInput);
  const actionEv = profile.evByHand?.[hand];
  if (!actionEv || typeof actionEv[chosenAction] !== 'number' || !Number.isFinite(actionEv[chosenAction])) return undefined;
  const available = ACTIONS
    .map(action => [action, actionEv[action]] as const)
    .filter((entry): entry is readonly [StrategyAction, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]));
  if (available.length < 2) return undefined;
  const [bestAction, bestEvBB] = available.sort((a, b) => b[1] - a[1])[0];
  const chosenEvBB = actionEv[chosenAction] as number;
  return { hand, chosenAction, bestAction, chosenEvBB, bestEvBB, evLossBB: Math.max(0, bestEvBB - chosenEvBB) };
}
