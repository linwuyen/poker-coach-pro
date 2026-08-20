import { analyzeBoardTexture } from './boardTexture';
import { solverCorpusRole, SolverCorpusRole } from './solverCurriculum';
import { fingerprintPokerBenchRow } from '../solver-data/contextFingerprint';
import { canonicalHolding, normalizeDecision, PokerBenchRow } from '../solver-data/pokerbench';

export type SemanticDimension = 'holding' | 'position' | 'bet-size' | 'action-line' | 'board' | 'street' | 'aggressor';

export interface SemanticDecisionPair {
  id: string;
  split: PokerBenchRow['split'];
  dimension: SemanticDimension;
  left: PokerBenchRow;
  right: PokerBenchRow;
  leftValue: string;
  rightValue: string;
}

export interface SemanticPairOptions {
  limit?: number;
  role?: SolverCorpusRole | 'all';
  roleOf?: (row: PokerBenchRow) => SolverCorpusRole;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/_/g, '-');
}

function structuralLine(value: string): string {
  return normalizeText(value).replace(/\d+(?:\.\d+)?/g, '#');
}

function moveTree(row: PokerBenchRow): string {
  return row.availableMoves.map(normalizeDecision).sort().join('|');
}

function boardKey(row: PokerBenchRow): string {
  if (row.split !== 'postflop') return '';
  return `${row.boardFlop}|${row.boardTurn || ''}|${row.boardRiver || ''}`.toLowerCase();
}

function boardTexture(row: PokerBenchRow): string {
  if (row.split !== 'postflop') return '';
  return analyzeBoardTexture(`${row.boardFlop}${row.boardTurn || ''}${row.boardRiver || ''}`).textureId;
}

function semanticDimensions(row: PokerBenchRow): SemanticDimension[] {
  if (row.split === 'preflop') return ['holding', 'position', 'bet-size', 'action-line'];
  return ['holding', 'position', 'bet-size', 'action-line', 'board', 'street', 'aggressor'];
}

function dimensionValue(row: PokerBenchRow, dimension: SemanticDimension): string {
  switch (dimension) {
    case 'holding': return canonicalHolding(row.holding);
    case 'position': return row.heroPosition.toUpperCase();
    case 'bet-size': return `${Math.round(row.potSize * 10) / 10}bb`;
    case 'action-line': return row.split === 'preflop'
      ? normalizeText(row.prevLine)
      : `${normalizeText(row.preflopAction)} -> ${normalizeText(row.postflopAction)}`;
    case 'board': return row.split === 'postflop' ? `${boardKey(row)} (${boardTexture(row)})` : '';
    case 'street': return row.split === 'postflop' ? row.evaluationAt : 'Preflop';
    case 'aggressor': return row.split === 'postflop' ? row.aggressorPosition.toUpperCase() : '';
  }
}

function invariantSignature(row: PokerBenchRow, dimension: SemanticDimension): string {
  const common: Record<string, string | number> = {
    split: row.split,
    moves: moveTree(row),
  };

  if (row.split === 'preflop') {
    if (dimension !== 'holding') common.holding = canonicalHolding(row.holding);
    if (dimension !== 'position') common.position = row.heroPosition.toUpperCase();
    common.players = row.numPlayers;
    common.numBets = row.numBets;
    if (dimension === 'bet-size') {
      common.actionShape = structuralLine(row.prevLine);
    } else if (dimension !== 'action-line') {
      common.actionLine = normalizeText(row.prevLine);
    }
    if (dimension !== 'bet-size') common.pot = Math.round(row.potSize * 10) / 10;
  } else {
    if (dimension !== 'holding') common.holding = canonicalHolding(row.holding);
    if (dimension !== 'position') common.position = row.heroPosition.toUpperCase();
    if (dimension !== 'street') common.street = row.evaluationAt;
    if (dimension !== 'aggressor') common.aggressor = row.aggressorPosition.toUpperCase();
    if (dimension !== 'board') {
      common.board = boardKey(row);
      common.texture = boardTexture(row);
    }
    if (dimension === 'bet-size') {
      common.preflopShape = structuralLine(row.preflopAction);
      common.postflopShape = structuralLine(row.postflopAction);
    } else if (dimension !== 'action-line') {
      common.preflopLine = normalizeText(row.preflopAction);
      common.postflopLine = normalizeText(row.postflopAction);
    }
    if (dimension !== 'bet-size') common.pot = Math.round(row.potSize * 10) / 10;
  }

  return Object.entries(common)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');
}

function validRow(row: PokerBenchRow): boolean {
  return Boolean(row.correctDecision && row.availableMoves.length >= 2 && row.availableMoves.some(move => normalizeDecision(move) === normalizeDecision(row.correctDecision)));
}

export function buildSemanticDecisionPairs(rows: PokerBenchRow[], options: SemanticPairOptions = {}): SemanticDecisionPair[] {
  const limit = options.limit ?? 120;
  const role = options.role ?? 'training';
  const roleOf = options.roleOf ?? solverCorpusRole;
  const eligible = rows
    .filter(validRow)
    .filter(row => role === 'all' || roleOf(row) === role)
    .sort((left, right) => left.id.localeCompare(right.id));
  const pairs: SemanticDecisionPair[] = [];
  const usedPairKeys = new Set<string>();

  for (const dimension of ['holding', 'position', 'bet-size', 'action-line', 'board', 'street', 'aggressor'] as SemanticDimension[]) {
    const groups = new Map<string, PokerBenchRow[]>();
    eligible.filter(row => semanticDimensions(row).includes(dimension)).forEach(row => {
      const signature = invariantSignature(row, dimension);
      groups.set(signature, [...(groups.get(signature) || []), row]);
    });

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
        const left = group[leftIndex];
        const leftValue = dimensionValue(left, dimension);
        for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
          const right = group[rightIndex];
          const rightValue = dimensionValue(right, dimension);
          if (leftValue === rightValue) continue;
          if (normalizeDecision(left.correctDecision) === normalizeDecision(right.correctDecision)) continue;
          const key = [left.id, right.id].sort().join(':');
          if (usedPairKeys.has(key)) continue;
          usedPairKeys.add(key);
          pairs.push({
            id: `semantic:${left.split}:${dimension}:${left.id}:${right.id}`,
            split: left.split,
            dimension,
            left,
            right,
            leftValue,
            rightValue,
          });
          break;
        }
        if (pairs.length >= limit) return pairs;
      }
    }
  }
  return pairs;
}

export function semanticDimensionLabel(dimension: SemanticDimension): string {
  const labels: Record<SemanticDimension, string> = {
    holding: '手牌 / blocker',
    position: '位置',
    'bet-size': '下注尺寸 / pot geometry',
    'action-line': '行動線',
    board: '牌面 / texture',
    street: 'Street',
    aggressor: '主動方位置',
  };
  return labels[dimension];
}

export function describeSemanticChange(pair: SemanticDecisionPair): string {
  return `${semanticDimensionLabel(pair.dimension)}：${pair.leftValue} → ${pair.rightValue}`;
}

export function solverDecisionFamilyId(row: PokerBenchRow): string {
  return `solver:${row.split}:${fingerprintPokerBenchRow(row).id}:${canonicalHolding(row.holding)}`;
}
