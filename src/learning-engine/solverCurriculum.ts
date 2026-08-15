import { fingerprintPokerBenchRow } from '../solver-data/contextFingerprint';
import { PokerBenchRow, canonicalHolding, isSizingDecisionRow, normalizeDecision } from '../solver-data/pokerbench';

export type SolverCurriculumLevel = 1 | 2 | 3 | 4 | 5;
export type SolverCorpusRole = 'training' | 'sibling' | 'holdout';

export interface SolverCurriculumInfo {
  level: SolverCurriculumLevel;
  label: string;
  reasons: string[];
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function solverContextFamilyId(row: PokerBenchRow): string {
  return fingerprintPokerBenchRow(row).id;
}

export function solverCorpusRole(row: PokerBenchRow): SolverCorpusRole {
  const bucket = hash(`v7-family:${row.split}:${solverContextFamilyId(row)}`) % 100;
  if (bucket < 80) return 'training';
  if (bucket < 90) return 'sibling';
  return 'holdout';
}

export function solverCurriculum(row: PokerBenchRow): SolverCurriculumInfo {
  const reasons: string[] = [];
  const moveCount = row.availableMoves.length;
  const sizing = isSizingDecisionRow(row);
  const normalizedMoves = row.availableMoves.map(normalizeDecision);
  const hasRaise = normalizedMoves.some(move => move.startsWith('raise'));
  const hasLargeTree = moveCount >= 4;
  let level: SolverCurriculumLevel = 1;

  if (row.split === 'preflop') {
    if (row.numBets >= 3 || moveCount >= 4) {
      level = 3;
      reasons.push('multi-bet preflop tree');
    } else if (row.numBets >= 2 || moveCount === 3) {
      level = 2;
      reasons.push('response node');
    } else {
      reasons.push('simple preflop node');
    }
  } else {
    level = 2;
    reasons.push(`${row.evaluationAt.toLowerCase()} decision`);
    if (sizing) {
      level = 3;
      reasons.push('bet-size choice');
    }
    if (hasRaise || hasLargeTree || row.evaluationAt === 'River') {
      level = Math.max(level, 4) as SolverCurriculumLevel;
      reasons.push('complex action boundary');
    }
  }
  if (solverCorpusRole(row) !== 'training') level = 5;
  const labels: Record<SolverCurriculumLevel, string> = {
    1: 'Foundation',
    2: 'Core Decision',
    3: 'Sizing / Response',
    4: 'Boundary / Complex',
    5: 'Transfer / Holdout',
  };
  return { level, label: labels[level], reasons };
}

export function curriculumFilter(rows: PokerBenchRow[], maxLevel: SolverCurriculumLevel): PokerBenchRow[] {
  return rows.filter(row => solverCorpusRole(row) === 'training' && solverCurriculum(row).level <= maxLevel);
}

export interface ContrastivePair {
  id: string;
  left: PokerBenchRow;
  right: PokerBenchRow;
  similarityScore: number;
}

function pairSimilarity(left: PokerBenchRow, right: PokerBenchRow): number {
  if (left.id === right.id || left.split !== right.split || normalizeDecision(left.correctDecision) === normalizeDecision(right.correctDecision)) return -Infinity;
  let score = 0;
  if (left.heroPosition === right.heroPosition) score += 4;
  if (canonicalHolding(left.holding) === canonicalHolding(right.holding)) score += 5;
  if (left.availableMoves.map(normalizeDecision).join('|') === right.availableMoves.map(normalizeDecision).join('|')) score += 3;
  if (Math.abs(left.potSize - right.potSize) <= 5) score += 1;
  if (left.split === 'postflop' && right.split === 'postflop') {
    if (left.evaluationAt === right.evaluationAt) score += 3;
    if (left.aggressorPosition === right.aggressorPosition) score += 1;
  }
  if (left.split === 'preflop' && right.split === 'preflop') {
    if (left.numPlayers === right.numPlayers) score += 1;
    if (left.numBets === right.numBets) score += 2;
  }
  return score;
}

export function buildContrastivePairs(rows: PokerBenchRow[], limit = 40): ContrastivePair[] {
  const sibling = rows.filter(row => solverCorpusRole(row) === 'sibling' && row.availableMoves.length >= 2 && row.correctDecision);
  const used = new Set<string>();
  const pairs: ContrastivePair[] = [];
  for (const left of sibling) {
    if (used.has(left.id)) continue;
    let best: PokerBenchRow | undefined;
    let bestScore = -Infinity;
    for (const right of sibling) {
      if (used.has(right.id)) continue;
      const score = pairSimilarity(left, right);
      if (score > bestScore) {
        best = right;
        bestScore = score;
      }
    }
    if (best && bestScore >= 4) {
      used.add(left.id);
      used.add(best.id);
      pairs.push({ id: `contrast:${left.split}:${left.id}:${best.id}`, left, right: best, similarityScore: bestScore });
      if (pairs.length >= limit) break;
    }
  }
  return pairs;
}
