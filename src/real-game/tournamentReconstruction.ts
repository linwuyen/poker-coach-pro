import { UtilityUnit } from '../types';
import { IcmPlayer } from '../tournament/icm';
import { ParsedHandHistory } from './handHistory';

export interface TournamentFieldSnapshot {
  handId: string;
  playersRemaining: number;
  players: IcmPlayer[];
  bounties?: Record<string, number>;
}

export interface TournamentMetadataV1 {
  schemaVersion: 1;
  tournamentId: string;
  name?: string;
  generatedAt: string;
  reference: string;
  methodology: string;
  payouts: number[];
  utilityUnit: Extract<UtilityUnit, 'dollar-ev' | 'prize-pool-share' | 'seat-equity'>;
  snapshots: TournamentFieldSnapshot[];
}

export interface TournamentContextDraft {
  handId: string;
  tournamentId?: string;
  heroId?: string;
  tablePlayers: IcmPlayer[];
  fullFieldPlayers?: IcmPlayer[];
  playersRemaining?: number;
  payouts?: number[];
  utilityUnit?: TournamentMetadataV1['utilityUnit'];
  bounties?: Record<string, number>;
  reference?: string;
  methodology?: string;
  completeFieldState: boolean;
  missing: string[];
}

export function tournamentIdFromHand(hand: ParsedHandHistory): string | undefined {
  const match = hand.raw.match(/Tournament\s*#([A-Za-z0-9_-]+)/i)
    || hand.raw.match(/Tournament\s+([A-Za-z0-9_-]+),/i)
    || hand.raw.match(/Tourney\s*#([A-Za-z0-9_-]+)/i);
  return match?.[1];
}

export function validateTournamentMetadata(input: TournamentMetadataV1): TournamentMetadataV1 {
  if (!input || input.schemaVersion !== 1 || !input.tournamentId) throw new Error('Tournament metadata requires schemaVersion 1 and tournamentId.');
  if (!input.reference || !input.methodology || !Number.isFinite(Date.parse(input.generatedAt))) throw new Error(`${input.tournamentId}: provenance is incomplete.`);
  if (!Array.isArray(input.payouts) || !input.payouts.length || input.payouts.some(value => !Number.isFinite(value) || value < 0)) throw new Error(`${input.tournamentId}: explicit non-negative payouts are required.`);
  if (!['dollar-ev','prize-pool-share','seat-equity'].includes(input.utilityUnit)) throw new Error(`${input.tournamentId}: utilityUnit is invalid.`);
  const hands = new Set<string>();
  for (const snapshot of input.snapshots || []) {
    if (!snapshot.handId || hands.has(snapshot.handId)) throw new Error(`${input.tournamentId}: snapshot handId must be unique.`);
    hands.add(snapshot.handId);
    if (!Number.isInteger(snapshot.playersRemaining) || snapshot.playersRemaining < 2) throw new Error(`${input.tournamentId}:${snapshot.handId} playersRemaining is invalid.`);
    if (!Array.isArray(snapshot.players) || snapshot.players.length !== snapshot.playersRemaining) throw new Error(`${input.tournamentId}:${snapshot.handId} requires a full-field stack snapshot.`);
    const ids = new Set(snapshot.players.map(player => player.id));
    if (ids.size !== snapshot.players.length || snapshot.players.some(player => !player.id || !Number.isFinite(player.stack) || player.stack < 0)) throw new Error(`${input.tournamentId}:${snapshot.handId} player snapshot is invalid.`);
  }
  return JSON.parse(JSON.stringify(input)) as TournamentMetadataV1;
}

/**
 * Auto-extracts everything ordinary HH can prove, then joins one tournament-level metadata registry.
 * Missing full-field snapshots/payouts remain explicit; a table snapshot is never silently treated as
 * the entire tournament field.
 */
export function reconstructTournamentContextDrafts(hands: ParsedHandHistory[], metadata: TournamentMetadataV1[] = []): TournamentContextDraft[] {
  const byTournament = new Map(metadata.map(item => {
    const validated = validateTournamentMetadata(item);
    return [validated.tournamentId, validated] as const;
  }));
  return hands.filter(hand => hand.format === 'MTT').map(hand => {
    const tournamentId = tournamentIdFromHand(hand);
    const meta = tournamentId ? byTournament.get(tournamentId) : undefined;
    const snapshot = meta?.snapshots.find(item => item.handId === hand.id);
    const tablePlayers = hand.players.map(player => ({ id: player.name, stack: player.stack }));
    const heroId = hand.heroName;
    const missing: string[] = [];
    if (!tournamentId) missing.push('tournament-id');
    if (!heroId) missing.push('hero-id');
    if (!meta) missing.push('tournament-metadata');
    if (meta && !snapshot) missing.push('full-field-stack-snapshot');
    if (!meta?.payouts.length) missing.push('payout-vector');
    return {
      handId: hand.id,
      tournamentId,
      heroId,
      tablePlayers,
      fullFieldPlayers: snapshot?.players,
      playersRemaining: snapshot?.playersRemaining,
      payouts: meta?.payouts,
      utilityUnit: meta?.utilityUnit,
      bounties: snapshot?.bounties,
      reference: meta?.reference,
      methodology: meta?.methodology,
      completeFieldState: Boolean(meta && snapshot && heroId),
      missing,
    };
  });
}

export function importTournamentMetadataEnvelope(raw: string | { schemaVersion: 1; tournaments: TournamentMetadataV1[] }): TournamentMetadataV1[] {
  const envelope = typeof raw === 'string' ? JSON.parse(raw) as { schemaVersion: 1; tournaments: TournamentMetadataV1[] } : raw;
  if (!envelope || envelope.schemaVersion !== 1 || !Array.isArray(envelope.tournaments)) throw new Error('Invalid tournament metadata envelope.');
  const ids = new Set<string>();
  return envelope.tournaments.map(item => {
    const validated = validateTournamentMetadata(item);
    if (ids.has(validated.tournamentId)) throw new Error(`${validated.tournamentId}: duplicate tournament metadata.`);
    ids.add(validated.tournamentId);
    return validated;
  });
}
