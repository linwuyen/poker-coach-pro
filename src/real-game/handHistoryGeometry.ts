import { Position } from '../strategy-engine-v2/types';
import { ParsedHandHistory } from './handHistory';

export type ForcedPostKind = 'straddle' | 'dead-blind';

export interface ForcedPostGeometry {
  player: string;
  position?: Position;
  kind: ForcedPostKind;
  amountBB: number;
}

export interface HandSettlementGeometry {
  multipleRunout: boolean;
  cashout: boolean;
  sidePotMarker: boolean;
  heroActsAfterMultipleRunout: boolean;
  heroActsAfterCashout: boolean;
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
const POSITION_ORDER = ['utg','utg1','utg2','mp','hj','co','btn','sb','bb'];
const round = (value: number, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;

function amount(text: string): number | undefined {
  const parsed = Number(text.replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function positionForHandPlayer(hand: ParsedHandHistory, playerName: string): Position | undefined {
  if (!hand.buttonSeat) return undefined;
  const seats = [...hand.players].sort((a, b) => a.seat - b.seat).map(player => player.seat);
  const player = hand.players.find(item => item.name === playerName);
  const buttonIndex = seats.indexOf(hand.buttonSeat);
  const playerIndex = player ? seats.indexOf(player.seat) : -1;
  if (buttonIndex < 0 || playerIndex < 0) return undefined;
  const offset = (playerIndex - buttonIndex + seats.length) % seats.length;
  const label = POSITION_MAPS[Math.min(9, Math.max(2, seats.length))]?.[offset]?.toLowerCase();
  return label && POSITION_ORDER.includes(label) ? label as Position : undefined;
}

/** Parses only non-standard forced bets. Standard SB/BB/ante remain represented by existing HH actions. */
export function parseNonstandardForcedPosts(hand: ParsedHandHistory): ForcedPostGeometry[] {
  const result: ForcedPostGeometry[] = [];
  for (const rawLine of hand.raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    const actor = line.match(/^(.+?):\s+(.+)$/);
    if (!actor) continue;
    const body = actor[2];
    const straddle = body.match(/(?:posts?\s+(?:a\s+)?)?straddles?(?:\s+of)?\s*(?:[$€£¥]\s*)?([0-9]+(?:[.,][0-9]+)*)/i);
    const dead = body.match(/posts?\s+(?:a\s+)?(?:dead|missed)\s+blind(?:\s+of)?\s*(?:[$€£¥]\s*)?([0-9]+(?:[.,][0-9]+)*)/i);
    const match = straddle || dead;
    if (!match) continue;
    const rawAmount = amount(match[1]);
    if (rawAmount === undefined || !(hand.bigBlind > 0)) continue;
    result.push({
      player: actor[1].trim(),
      position: positionForHandPlayer(hand, actor[1].trim()),
      kind: straddle ? 'straddle' : 'dead-blind',
      amountBB: round(rawAmount / hand.bigBlind),
    });
  }
  return result;
}

export function hasNonstandardForcedBetMarker(hand: ParsedHandHistory): boolean {
  return /\bstraddles?\b|posts?\s+(?:a\s+)?(?:dead|missed)\s+blind|dead\s+button/i.test(hand.raw);
}

/** Material key is portable across player names: position + kind + amount only. */
export function forcedBetContextKey(hand: ParsedHandHistory): string | undefined {
  const posts = parseNonstandardForcedPosts(hand);
  if (!posts.length) return undefined;
  if (posts.some(post => !post.position || !Number.isFinite(post.amountBB) || post.amountBB <= 0)) return undefined;
  return JSON.stringify(posts
    .map(post => ({ position: post.position!, kind: post.kind, amountBB: round(post.amountBB) }))
    .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || a.kind.localeCompare(b.kind) || a.amountBB - b.amountBB));
}

/** Extra forced contributions missing from the legacy ParsedHandAction stream. */
export function nonstandardForcedContributionMap(hand: ParsedHandHistory): Map<string, number> {
  const map = new Map<string, number>();
  parseNonstandardForcedPosts(hand).forEach(post => map.set(post.player, round((map.get(post.player) || 0) + post.amountBB)));
  return map;
}

function firstLineIndex(lines: string[], pattern: RegExp): number {
  const index = lines.findIndex(line => pattern.test(line));
  return index < 0 ? Number.POSITIVE_INFINITY : index;
}

function heroDecisionAfter(lines: string[], heroName: string | undefined, index: number): boolean {
  if (!heroName || !Number.isFinite(index)) return false;
  return lines.slice(index + 1).some(line => {
    if (!line.startsWith(`${heroName}:`)) return false;
    return /\b(?:folds|checks|calls|bets|raises)\b/i.test(line);
  });
}

export function settlementGeometry(hand: ParsedHandHistory): HandSettlementGeometry {
  const lines = hand.raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const multiPattern = /run\s+it\s+twice|\*\*\*\s+(?:first|second)\s+(?:flop|turn|river)|^first\s+(?:flop|turn|river)|^second\s+(?:flop|turn|river)/i;
  const cashoutPattern = /cash\s*out|cashout/i;
  const multiIndex = firstLineIndex(lines, multiPattern);
  const cashoutIndex = firstLineIndex(lines, cashoutPattern);
  return {
    multipleRunout: Number.isFinite(multiIndex),
    cashout: Number.isFinite(cashoutIndex),
    sidePotMarker: /\bside\s+pot\b|\bmain\s+pot\b/i.test(hand.raw),
    heroActsAfterMultipleRunout: heroDecisionAfter(lines, hand.heroName, multiIndex),
    heroActsAfterCashout: heroDecisionAfter(lines, hand.heroName, cashoutIndex),
  };
}

/**
 * Canonical pot-tier key for decisions where an active all-in player makes side-pot eligibility material.
 * Folded money contributes to pot amounts but folded players are never eligible to win a tier.
 */
export function potStructureContextKey(
  hand: ParsedHandHistory,
  contributedTotal: Map<string, number>,
  active: Set<string>,
): string | undefined {
  if (active.size < 3) return undefined;
  const remaining = (name: string) => {
    const start = hand.players.find(player => player.name === name)?.stackBB;
    return start === undefined ? undefined : Math.max(0, start - (contributedTotal.get(name) || 0));
  };
  const activeAllIn = [...active].some(name => {
    const value = remaining(name);
    return value !== undefined && value <= 0.001;
  });
  if (!activeAllIn) return undefined;

  const contributions = [...contributedTotal.entries()].filter(([, value]) => value > 0.0005);
  const levels = [...new Set(contributions.map(([, value]) => round(value)))].sort((a, b) => a - b);
  if (levels.length < 2) return undefined;
  let previous = 0;
  const tiers = levels.map((level, index) => {
    const contributors = contributions.filter(([, value]) => value + 0.0005 >= level);
    const tierAmountBB = round((level - previous) * contributors.length);
    previous = level;
    const eligible = [...active]
      .filter(name => (contributedTotal.get(name) || 0) + 0.0005 >= level)
      .map(name => positionForHandPlayer(hand, name))
      .filter((position): position is Position => Boolean(position))
      .sort((a, b) => POSITION_ORDER.indexOf(a) - POSITION_ORDER.indexOf(b));
    return { kind: index === 0 ? 'main' : 'side', amountBB: tierAmountBB, eligible };
  }).filter(tier => tier.amountBB > 0);
  if (tiers.length < 2 || tiers.some(tier => !tier.eligible.length)) return undefined;
  return JSON.stringify(tiers);
}
