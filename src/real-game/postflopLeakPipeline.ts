import { HistoryItem, Street } from '../types';
import {
  PostflopAction,
  PostflopTruthNode,
  canonicalHoleCombo,
  findExactVerifiedPostflopNode,
  postflopContextKey,
  verifiedPostflopRegret,
} from '../strategy-engine-v3';
import { ParsedHandHistory } from './handHistory';
import { extractObservedPostflopDecisions } from './postflopState';

export interface PostflopLeakPipelineOptions {
  importedAt?: number;
  rakePercent?: number;
  rakeCapBB?: number;
}

export interface VerifiedPostflopLeakFinding {
  decisionFamilyId: string;
  profileKey: string;
  street: Exclude<Street, 'Preflop'>;
  position: string;
  combo: string;
  chosenAction: PostflopAction;
  bestAction: PostflopAction;
  occurrences: number;
  totalEvLossBB: number;
  averageEvLossBB: number;
  sourceReference?: string;
}

export interface PostflopLeakPipelineResult {
  history: HistoryItem[];
  findings: VerifiedPostflopLeakFinding[];
  heroDecisions: number;
  matchedDecisions: number;
  gradedDecisions: number;
  unsupportedDecisions: number;
}

function skillIds(street: string, chosen: PostflopAction, facingBet: boolean): string[] {
  const ids = new Set<string>(['postflop.board-texture', `postflop.${street.toLowerCase()}`]);
  if (chosen === 'bet' || chosen === 'raise' || chosen === 'allIn') ids.add('postflop.bet-sizing');
  if (street === 'River' && facingBet) ids.add('postflop.bluff-catch');
  return [...ids];
}

export function buildVerifiedPostflopLeakEvidence(
  hands: ParsedHandHistory[],
  nodes: PostflopTruthNode[],
  options: PostflopLeakPipelineOptions = {},
): PostflopLeakPipelineResult {
  const history: HistoryItem[] = [];
  const grouped = new Map<string, VerifiedPostflopLeakFinding>();
  let heroDecisions = 0;
  let matchedDecisions = 0;

  for (const hand of hands) {
    const decisions = extractObservedPostflopDecisions(hand, options);
    heroDecisions += decisions.length;
    for (const decision of decisions) {
      const node = findExactVerifiedPostflopNode(nodes, decision.query);
      if (!node) continue;
      matchedDecisions += 1;
      const regret = verifiedPostflopRegret(node, decision.query.heroCards, decision.chosenAction);
      if (!regret) continue;
      const contextFamilyId = postflopContextKey(node.context);
      const decisionFamilyId = `solver-v3:${node.id}:${regret.combo}`;
      const isCash = hand.format === 'Cash';
      const facingBet = (decision.query.toCallBB || 0) > 0;
      const timestamp = hand.timestamp || options.importedAt || Date.now();
      const item: HistoryItem = {
        schemaVersion: 6,
        trainingType: 'real-hand',
        scenarioId: `hh-postflop-grade:${hand.id}:${decision.actionIndex}`,
        sourceHandId: hand.id,
        decisionFamilyId,
        category: ['Real Game', 'Verified Postflop Leak'],
        score: regret.evLossBB <= 0.01 ? 10 : Math.max(0, 10 - regret.evLossBB * 5),
        judgment: regret.evLossBB <= 0.01 ? 'solver-aligned' : 'verified-postflop-regret',
        timestamp,
        selectedAction: regret.chosenAction,
        bestAction: regret.bestAction,
        correct: regret.evLossBB <= 0.01,
        street: decision.query.street,
        position: node.context.heroPosition.toUpperCase(),
        chosenEvBB: regret.chosenEvBB,
        bestEvBB: regret.bestEvBB,
        evLossBB: regret.evLossBB,
        truthTier: 'verified-solver',
        truthSourceId: node.id,
        truthSourceRef: node.source.reference,
        truthSourceRevision: node.source.solverVersion || node.version,
        contextFamilyId,
        evidenceFamilyId: `${hand.format}:${contextFamilyId}`,
        contextFingerprint: contextFamilyId,
        skillIds: skillIds(node.context.street, regret.chosenAction, facingBet),
        situationIds: [`street.${node.context.street.toLowerCase()}`, `position.${node.context.heroPosition}`, facingBet ? 'facing.bet' : 'checked.to'],
        gameFormat: hand.format,
        handsObserved: hands.length,
        spotExposureCount: 1,
        spotFrequencyPer100Hands: hands.length ? 100 / hands.length : undefined,
        utilityLoss: isCash ? regret.evLossBB : undefined,
        utilityUnit: isCash ? 'bb' : undefined,
        utilityModel: isCash ? 'cash-chip-ev' : 'priority-only',
        realGameSource: hand.source,
        boardTextureId: node.context.board.join(''),
        notes: `P12 exact postflop grading: heads-up state matched one verified immutable v3 node exactly. ${node.id}@${node.version}. No approximate fallback.`,
      };
      history.push(item);
      const key = decisionFamilyId;
      const current = grouped.get(key);
      if (!current) {
        grouped.set(key, {
          decisionFamilyId,
          profileKey: `${node.id}@${node.version}`,
          street: node.context.street,
          position: node.context.heroPosition.toUpperCase(),
          combo: canonicalHoleCombo(decision.query.heroCards),
          chosenAction: regret.chosenAction,
          bestAction: regret.bestAction,
          occurrences: 1,
          totalEvLossBB: regret.evLossBB,
          averageEvLossBB: regret.evLossBB,
          sourceReference: node.source.reference,
        });
      } else {
        current.occurrences += 1;
        current.totalEvLossBB += regret.evLossBB;
        current.averageEvLossBB = current.totalEvLossBB / current.occurrences;
      }
    }
  }
  return {
    history,
    findings: [...grouped.values()].sort((a, b) => b.totalEvLossBB - a.totalEvLossBB || b.occurrences - a.occurrences),
    heroDecisions,
    matchedDecisions,
    gradedDecisions: history.length,
    unsupportedDecisions: Math.max(0, heroDecisions - matchedDecisions),
  };
}
