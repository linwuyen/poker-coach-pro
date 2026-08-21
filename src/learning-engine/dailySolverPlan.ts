import { HistoryItem, PlayerProfile } from '../types';
import { isHistoryCorrect } from './index';
import { buildSemanticDecisionPairs, SemanticDecisionPair } from './semanticPairs';
import { solverCorpusRole, solverCurriculum, SolverCorpusRole, SolverCurriculumLevel } from './solverCurriculum';
import { POKERBENCH_FILES, PokerBenchRow } from '../solver-data/pokerbench';

export interface DailyCurriculumQuota {
  total: number;
  curated: number;
  semanticPairs: number;
  semanticDecisions: number;
  generalization: number;
}

export interface SolverSelectionOptions {
  random?: () => number;
  now?: number;
  roleOf?: (row: PokerBenchRow) => SolverCorpusRole;
  levelOf?: (row: PokerBenchRow) => SolverCurriculumLevel;
  excludeIds?: Set<string>;
}

export function dailyCurriculumQuota(total: number): DailyCurriculumQuota {
  if (total <= 8) return { total, curated: Math.max(0, total - 4), semanticPairs: 1, semanticDecisions: 2, generalization: 2 };
  if (total <= 12) return { total, curated: Math.max(0, total - 6), semanticPairs: 2, semanticDecisions: 4, generalization: 2 };
  const semanticPairs = 3;
  const semanticDecisions = semanticPairs * 2;
  const generalization = 4;
  return { total, curated: Math.max(0, total - semanticDecisions - generalization), semanticPairs, semanticDecisions, generalization };
}

/** Due review consumes today's budget before new solver transfer work. */
export function rebalanceDailyCurriculumQuota(base: DailyCurriculumQuota, dueCount: number): DailyCurriculumQuota {
  const curated = Math.min(base.total, Math.max(base.curated, Math.max(0, dueCount)));
  let remaining = Math.max(0, base.total - curated);
  const semanticDecisions = Math.min(base.semanticDecisions, remaining - (remaining % 2));
  const semanticPairs = Math.floor(semanticDecisions / 2);
  remaining -= semanticDecisions;
  const generalization = remaining;
  return { total: base.total, curated, semanticPairs, semanticDecisions, generalization };
}

export function profileMaxSolverLevel(profile?: PlayerProfile): SolverCurriculumLevel {
  if (!profile || profile.experience === 'intermediate') return 3;
  return profile.experience === 'beginner' ? 2 : 4;
}

function rowHistory(row: PokerBenchRow, history: HistoryItem[]): HistoryItem[] {
  const split = POKERBENCH_FILES[row.split].split;
  return history.filter(item => item.truthSourceId === 'pokerbench-aaai2025' && item.datasetSplit === split && item.datasetRowId === row.id);
}

function situationAccuracy(row: PokerBenchRow, history: HistoryItem[]): number | undefined {
  const relevant = history.filter(item => item.truthSourceId === 'pokerbench-aaai2025')
    .filter(item => item.position?.toUpperCase() === row.heroPosition.toUpperCase())
    .filter(item => row.split === 'preflop' ? item.street === 'Preflop' : item.street === row.evaluationAt);
  if (!relevant.length) return undefined;
  return relevant.filter(isHistoryCorrect).length / relevant.length;
}

function profileBoost(row: PokerBenchRow, profile?: PlayerProfile): number {
  if (!profile) return 1;
  const focus = new Set(profile.focusAreas);
  let boost = 1;
  if (row.split === 'preflop' && focus.has('preflop')) boost += 0.35;
  if (row.split === 'postflop' && focus.has('postflop')) boost += 0.35;
  if (row.split === 'postflop' && focus.has('bluff-catching') && row.evaluationAt === 'River') boost += 0.2;
  if (focus.has('mixed')) boost += 0.1;
  return boost;
}

/**
 * Route training toward situations where exact HH↔solver joins observed real cash regret.
 * This is a situation-level priority signal only; it never relabels a PokerBench row as the same solver node.
 * Tournament utility is kept on its own P9-D plane because PokerBench rows do not carry compatible tournament utility units.
 */
export function verifiedRealGameLeakBoost(row: PokerBenchRow, history: HistoryItem[]): number {
  const targetStreet = row.split === 'preflop' ? 'Preflop' : row.evaluationAt;
  const relevant = history.filter(item => item.trainingType === 'real-hand')
    .filter(item => item.truthTier === 'verified-solver')
    .filter(item => item.gameFormat === 'Cash' && item.utilityUnit === 'bb' && item.utilityModel === 'cash-chip-ev')
    .filter(item => typeof item.evLossBB === 'number' && item.evLossBB > 0)
    .filter(item => item.position?.toUpperCase() === row.heroPosition.toUpperCase())
    .filter(item => item.street === targetStreet);
  if (!relevant.length) return 1;
  const pressure = relevant.reduce((sum, item) => {
    const frequency = typeof item.spotFrequencyPer100Hands === 'number' && item.spotFrequencyPer100Hands > 0 ? item.spotFrequencyPer100Hands : 1;
    return sum + (item.evLossBB || 0) * frequency;
  }, 0);
  return 1 + Math.min(2, pressure / 5);
}

function rowPriority(
  row: PokerBenchRow,
  history: HistoryItem[],
  profile: PlayerProfile | undefined,
  now: number,
  random: () => number,
  levelOf: (row: PokerBenchRow) => SolverCurriculumLevel,
): number {
  const attempts = rowHistory(row, history).sort((left, right) => right.timestamp - left.timestamp);
  const latest = attempts[0];
  const unseen = attempts.length === 0;
  const wrong = latest ? !isHistoryCorrect(latest) : false;
  const due = latest?.nextReviewAt !== undefined && latest.nextReviewAt <= now;
  const recent = latest ? now - latest.timestamp < 86400000 : false;
  const accuracy = situationAccuracy(row, history);
  const weakness = accuracy === undefined ? 0.45 : 1 - accuracy;
  const curriculum = levelOf(row);
  const novelty = unseen ? 1.7 : 1;
  const correction = wrong ? 1.8 : 1;
  const dueBoost = due ? 1.7 : 1;
  const repeatPenalty = recent && !due ? 0.25 : 1;
  const difficultyFit = 1 + Math.max(0, 4 - curriculum) * 0.05;
  const jitter = 0.85 + Math.min(0.999999, Math.max(0, random())) * 0.3;
  return (0.8 + weakness) * novelty * correction * dueBoost * repeatPenalty * difficultyFit
    * profileBoost(row, profile) * verifiedRealGameLeakBoost(row, history) * jitter;
}

function eligibleTrainingRows(
  rows: PokerBenchRow[],
  profile: PlayerProfile | undefined,
  roleOf: (row: PokerBenchRow) => SolverCorpusRole,
  levelOf: (row: PokerBenchRow) => SolverCurriculumLevel,
): PokerBenchRow[] {
  const maxLevel = profileMaxSolverLevel(profile);
  return rows.filter(row => roleOf(row) === 'training')
    .filter(row => row.correctDecision && row.availableMoves.length >= 2)
    .filter(row => levelOf(row) <= maxLevel);
}

export function selectDailySemanticPairs(
  rows: PokerBenchRow[],
  history: HistoryItem[],
  count: number,
  profile?: PlayerProfile,
  options: SolverSelectionOptions = {},
): SemanticDecisionPair[] {
  const roleOf = options.roleOf || solverCorpusRole;
  const levelOf = options.levelOf || (row => solverCurriculum(row).level);
  const random = options.random || Math.random;
  const now = options.now ?? Date.now();
  const eligibleIds = new Set(eligibleTrainingRows(rows, profile, roleOf, levelOf).map(row => row.id));
  const recentPairs = new Set(history.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 30).map(item => item.contrastivePairId).filter(Boolean));
  return buildSemanticDecisionPairs(rows, { role: 'training', roleOf, limit: 1000 })
    .filter(pair => eligibleIds.has(pair.left.id) && eligibleIds.has(pair.right.id))
    .filter(pair => !options.excludeIds?.has(pair.left.id) && !options.excludeIds?.has(pair.right.id))
    .map(pair => ({ pair, score: rowPriority(pair.left, history, profile, now, random, levelOf) + rowPriority(pair.right, history, profile, now, random, levelOf) + (recentPairs.has(pair.id) ? -4 : 1) }))
    .sort((left, right) => right.score - left.score || left.pair.id.localeCompare(right.pair.id))
    .slice(0, Math.max(0, count))
    .map(item => item.pair);
}

export function selectDailyGeneralizationRows(
  rows: PokerBenchRow[],
  history: HistoryItem[],
  count: number,
  profile?: PlayerProfile,
  options: SolverSelectionOptions = {},
): PokerBenchRow[] {
  const roleOf = options.roleOf || solverCorpusRole;
  const levelOf = options.levelOf || (row => solverCurriculum(row).level);
  const random = options.random || Math.random;
  const now = options.now ?? Date.now();
  return eligibleTrainingRows(rows, profile, roleOf, levelOf)
    .filter(row => !options.excludeIds?.has(row.id))
    .map(row => ({ row, score: rowPriority(row, history, profile, now, random, levelOf) }))
    .sort((left, right) => right.score - left.score || left.row.id.localeCompare(right.row.id))
    .slice(0, Math.max(0, count))
    .map(item => item.row);
}
