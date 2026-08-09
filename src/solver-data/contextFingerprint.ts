import { StrategyContext } from '../strategy-engine-v2/types';
import { analyzeBoardTexture } from '../learning-engine/boardTexture';
import { PokerBenchRow } from './pokerbench';

export type ContextMatchStatus = 'exact' | 'approximate' | 'unsupported';

export interface ContextFingerprint {
  id: string;
  fields: Record<string, string | number | boolean>;
}

export interface ContextComparison {
  status: ContextMatchStatus;
  materialMismatches: string[];
  approximateDifferences: string[];
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${key}:${stable(item)}`).join(',')}}`;
  return String(value ?? '');
}

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
}

function normalizeLine(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '').replace(/_/g, '-');
}

function potBucket(pot: number): string {
  if (pot < 5) return '<5';
  if (pot < 10) return '5-10';
  if (pot < 20) return '10-20';
  if (pot < 40) return '20-40';
  return '40+';
}

export function fingerprintPokerBenchRow(row: PokerBenchRow): ContextFingerprint {
  const fields: Record<string, string | number | boolean> = {
    split: row.split,
    heroPosition: row.heroPosition.toUpperCase(),
    potBucket: potBucket(row.potSize),
    moveTree: row.availableMoves.map(normalizeLine).sort().join('|'),
  };
  if (row.split === 'preflop') {
    fields.players = row.numPlayers;
    fields.numBets = row.numBets;
    fields.actionLine = normalizeLine(row.prevLine);
  } else {
    const board = `${row.boardFlop}${row.boardTurn || ''}${row.boardRiver || ''}`;
    const texture = analyzeBoardTexture(board);
    fields.street = row.evaluationAt;
    fields.boardTexture = texture.textureId;
    fields.preflopLine = normalizeLine(row.preflopAction);
    fields.postflopLine = normalizeLine(row.postflopAction);
    fields.aggressor = row.aggressorPosition.toUpperCase();
  }
  const canonical = stable(fields);
  return { id: `pb-${hash(canonical)}`, fields };
}

export function fingerprintStrategyContext(context: StrategyContext): ContextFingerprint {
  const fields: Record<string, string | number | boolean> = {
    format: context.format,
    tableSize: context.tableSize,
    spot: context.spot,
    position: context.position,
    stackDepthBB: context.stackDepthBB,
    anteBB: context.anteBB,
  };
  if (context.villainPosition) fields.villainPosition = context.villainPosition;
  if (context.openSizeBB !== undefined) fields.openSizeBB = context.openSizeBB;
  if (context.rakePercent !== undefined) fields.rakePercent = context.rakePercent;
  if (context.rakeCapBB !== undefined) fields.rakeCapBB = context.rakeCapBB;
  if (context.icm) {
    fields.icmModel = context.icm.model;
    if (context.icm.playersRemaining !== undefined) fields.playersRemaining = context.icm.playersRemaining;
    if (context.icm.paidPlaces !== undefined) fields.paidPlaces = context.icm.paidPlaces;
  }
  if (context.betTree?.openSizesBB) fields.openSizes = context.betTree.openSizesBB.join('/');
  if (context.betTree?.threeBetSizesBB) fields.threeBetSizes = context.betTree.threeBetSizesBB.join('/');
  if (context.betTree?.fourBetSizesBB) fields.fourBetSizes = context.betTree.fourBetSizesBB.join('/');
  if (context.betTree?.jamAllowed !== undefined) fields.jamAllowed = context.betTree.jamAllowed;
  const canonical = stable(fields);
  return { id: `strategy-${hash(canonical)}`, fields };
}

export function compareStrategyContexts(target: StrategyContext, candidate: StrategyContext): ContextComparison {
  const materialMismatches: string[] = [];
  const approximateDifferences: string[] = [];
  const exactKeys: Array<keyof StrategyContext> = ['format', 'tableSize', 'spot', 'position', 'villainPosition'];
  exactKeys.forEach(key => {
    if ((target[key] ?? null) !== (candidate[key] ?? null)) materialMismatches.push(String(key));
  });
  if (target.icm?.model !== candidate.icm?.model) materialMismatches.push('icm.model');
  if (Math.abs(target.stackDepthBB - candidate.stackDepthBB) > 5) materialMismatches.push('stackDepthBB');
  else if (target.stackDepthBB !== candidate.stackDepthBB) approximateDifferences.push('stackDepthBB');
  if (Math.abs(target.anteBB - candidate.anteBB) > 0.05) materialMismatches.push('anteBB');
  else if (target.anteBB !== candidate.anteBB) approximateDifferences.push('anteBB');

  const compareOptional = (key: 'openSizeBB' | 'rakePercent' | 'rakeCapBB', tolerance: number) => {
    const left = target[key];
    const right = candidate[key];
    if (left === undefined && right === undefined) return;
    if (left === undefined || right === undefined) {
      materialMismatches.push(key);
      return;
    }
    const delta = Math.abs(left - right);
    if (delta > tolerance) materialMismatches.push(key);
    else if (delta > 0) approximateDifferences.push(key);
  };
  compareOptional('openSizeBB', 0.25);
  compareOptional('rakePercent', 0.5);
  compareOptional('rakeCapBB', 0.25);

  if (materialMismatches.length) return { status: 'unsupported', materialMismatches, approximateDifferences };
  if (approximateDifferences.length) return { status: 'approximate', materialMismatches, approximateDifferences };
  return { status: 'exact', materialMismatches, approximateDifferences };
}
