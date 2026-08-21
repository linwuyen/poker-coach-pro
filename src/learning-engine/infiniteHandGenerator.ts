import { HistoryItem, Scenario } from '../types';
import { isHiddenBenchmarkScenario } from './benchmark';
import { scenarioContextFamilyId } from './contextIdentity';
import { solverDecisionFamilyId } from './semanticPairs';
import { solverCorpusRole } from './solverCurriculum';
import { normalizeDecision, PokerBenchRow } from '../solver-data/pokerbench';

export type InfiniteHandSource = 'curated' | 'safe-variant' | 'pokerbench';

interface InfiniteCandidateBase {
  id: string;
  source: InfiniteHandSource;
  familyId: string;
  presentationFingerprint: string;
  truthLabel: string;
}

export interface InfiniteScenarioCandidate extends InfiniteCandidateBase {
  kind: 'scenario';
  scenario: Scenario;
}

export interface InfiniteSolverCandidate extends InfiniteCandidateBase {
  kind: 'solver';
  row: PokerBenchRow;
}

export type InfiniteHandCandidate = InfiniteScenarioCandidate | InfiniteSolverCandidate;

export interface InfinitePoolSummary {
  curatedInput: number;
  safeVariantInput: number;
  pokerBenchInput: number;
  usable: number;
  heldOut: number;
  deduplicated: number;
  bySource: Record<InfiniteHandSource, number>;
}

const SOURCE_TARGET: Record<InfiniteHandSource, number> = {
  curated: 0.30,
  'safe-variant': 0.25,
  pokerbench: 0.45,
};

function fnv1a(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
}

function cardKey(card: Scenario['holeCards'][number]): string {
  return `${card.rank}${card.suit}`;
}

export function scenarioBestAction(scenario: Scenario, stepIndex = 0): string | undefined {
  const step = scenario.steps[stepIndex];
  if (!step) return undefined;
  const feedbacks = Object.values(step.feedbacks).filter(Boolean);
  const best = [...new Set(feedbacks.map(feedback => feedback!.bestAction).filter(Boolean))];
  if (best.length !== 1) return undefined;
  const bestFeedback = Object.values(step.feedbacks).find(feedback => feedback?.bestAction === best[0] && feedback.score >= 8);
  return bestFeedback ? best[0] : undefined;
}

export function isTruthBackedScenario(scenario: Scenario): boolean {
  if (!scenario.steps.length) return false;
  return scenario.steps.every((step, index) => {
    const best = scenarioBestAction(scenario, index);
    return Boolean(best && Object.values(step.feedbacks).some(feedback => feedback?.bestAction === best));
  });
}

export function isTruthBackedPokerBenchRow(row: PokerBenchRow): boolean {
  if (solverCorpusRole(row) !== 'training') return false;
  if (!row.correctDecision || row.availableMoves.length < 2) return false;
  const target = normalizeDecision(row.correctDecision);
  return row.availableMoves.some(move => normalizeDecision(move) === target);
}

export function scenarioPresentationFingerprint(scenario: Scenario): string {
  const shape = {
    type: scenario.type,
    tableSize: scenario.tableSize,
    position: scenario.position,
    effectiveStack: scenario.effectiveStack,
    userBB: scenario.userBB,
    blinds: scenario.blinds,
    preAction: scenario.preAction,
    hole: scenario.holeCards.map(cardKey),
    steps: scenario.steps.map((step, index) => ({
      street: step.street,
      board: step.communityCards.map(cardKey),
      pot: step.potSize,
      spr: step.spr,
      description: step.description,
      best: scenarioBestAction(scenario, index),
    })),
  };
  return `scenario-${fnv1a(JSON.stringify(shape))}`;
}

export function pokerBenchPresentationFingerprint(row: PokerBenchRow): string {
  const common = {
    split: row.split,
    holding: row.holding,
    position: row.heroPosition,
    pot: row.potSize,
    moves: row.availableMoves.map(normalizeDecision).sort(),
    best: normalizeDecision(row.correctDecision),
  };
  const shape = row.split === 'preflop'
    ? { ...common, players: row.numPlayers, bets: row.numBets, line: row.prevLine }
    : { ...common, street: row.evaluationAt, flop: row.boardFlop, turn: row.boardTurn, river: row.boardRiver, preflop: row.preflopAction, postflop: row.postflopAction, aggressor: row.aggressorPosition };
  return `pokerbench-${fnv1a(JSON.stringify(shape))}`;
}

function scenarioCandidate(scenario: Scenario, source: 'curated' | 'safe-variant'): InfiniteScenarioCandidate {
  return {
    kind: 'scenario',
    id: `${source}:${scenario.id}`,
    source,
    familyId: scenarioContextFamilyId(scenario),
    presentationFingerprint: scenarioPresentationFingerprint(scenario),
    truthLabel: source === 'safe-variant' ? 'strategy-equivalent truth' : 'validated teaching truth',
    scenario,
  };
}

function solverCandidate(row: PokerBenchRow): InfiniteSolverCandidate {
  return {
    kind: 'solver',
    id: `pokerbench:${row.split}:${row.id}`,
    source: 'pokerbench',
    familyId: solverDecisionFamilyId(row),
    presentationFingerprint: pokerBenchPresentationFingerprint(row),
    truthLabel: 'verified solver label',
    row,
  };
}

function holdoutSourceIds(curated: Scenario[]): Set<string> {
  return new Set(curated.filter(isHiddenBenchmarkScenario).map(scenario => scenario.id));
}

function isTrainingSafeCurated(scenario: Scenario): boolean {
  return !isHiddenBenchmarkScenario(scenario) && isTruthBackedScenario(scenario);
}

function isTrainingSafeVariant(scenario: Scenario, heldOutSources: Set<string>): boolean {
  const sourceId = scenario.reviewSourceId;
  return isTruthBackedScenario(scenario) && (!sourceId || !heldOutSources.has(sourceId));
}

export function buildInfiniteCandidatePool(
  curated: Scenario[],
  safeVariants: Scenario[],
  pokerBenchRows: PokerBenchRow[],
): InfiniteHandCandidate[] {
  const heldOutSources = holdoutSourceIds(curated);
  const raw: InfiniteHandCandidate[] = [
    ...curated.filter(isTrainingSafeCurated).map(item => scenarioCandidate(item, 'curated')),
    ...safeVariants.filter(item => isTrainingSafeVariant(item, heldOutSources)).map(item => scenarioCandidate(item, 'safe-variant')),
    ...pokerBenchRows.filter(isTruthBackedPokerBenchRow).map(solverCandidate),
  ];
  const byFingerprint = new Map<string, InfiniteHandCandidate>();
  raw.forEach(candidate => {
    if (!byFingerprint.has(candidate.presentationFingerprint)) byFingerprint.set(candidate.presentationFingerprint, candidate);
  });
  return [...byFingerprint.values()];
}

export function summarizeInfinitePool(
  curated: Scenario[],
  safeVariants: Scenario[],
  pokerBenchRows: PokerBenchRow[],
  pool = buildInfiniteCandidatePool(curated, safeVariants, pokerBenchRows),
): InfinitePoolSummary {
  const heldOutSources = holdoutSourceIds(curated);
  const truthBackedCurated = curated.filter(isTruthBackedScenario);
  const truthBackedVariants = safeVariants.filter(isTruthBackedScenario);
  const truthBackedPokerBench = pokerBenchRows.filter(row => row.correctDecision && row.availableMoves.length >= 2 && row.availableMoves.some(move => normalizeDecision(move) === normalizeDecision(row.correctDecision)));
  const trainingCurated = truthBackedCurated.filter(item => !isHiddenBenchmarkScenario(item));
  const trainingVariants = truthBackedVariants.filter(item => !item.reviewSourceId || !heldOutSources.has(item.reviewSourceId));
  const trainingPokerBench = truthBackedPokerBench.filter(item => solverCorpusRole(item) === 'training');
  const rawUsable = trainingCurated.length + trainingVariants.length + trainingPokerBench.length;
  const heldOut = (truthBackedCurated.length - trainingCurated.length)
    + (truthBackedVariants.length - trainingVariants.length)
    + (truthBackedPokerBench.length - trainingPokerBench.length);
  return {
    curatedInput: curated.length,
    safeVariantInput: safeVariants.length,
    pokerBenchInput: pokerBenchRows.length,
    usable: pool.length,
    heldOut,
    deduplicated: Math.max(0, rawUsable - pool.length),
    bySource: {
      curated: pool.filter(item => item.source === 'curated').length,
      'safe-variant': pool.filter(item => item.source === 'safe-variant').length,
      pokerbench: pool.filter(item => item.source === 'pokerbench').length,
    },
  };
}

function historyMatches(candidate: InfiniteHandCandidate, item: HistoryItem): boolean {
  if (item.decisionFamilyId === candidate.familyId || item.contextFamilyId === candidate.familyId) return true;
  if (candidate.kind === 'scenario') return item.scenarioId === candidate.scenario.id;
  return item.datasetRowId === candidate.row.id;
}

function candidateWeight(candidate: InfiniteHandCandidate, history: HistoryItem[], now: number): number {
  const relevant = history.filter(item => historyMatches(candidate, item)).slice(-40);
  if (!relevant.length) return 1.35;
  const misses = relevant.filter(item => item.correct === false).length;
  const due = relevant.filter(item => typeof item.nextReviewAt === 'number' && item.nextReviewAt <= now).length;
  const errorBoost = 1 + (misses / relevant.length) * 2.5;
  const dueBoost = 1 + Math.min(2, due) * 0.75;
  return errorBoost * dueBoost;
}

function weightedPick<T>(items: T[], weightOf: (item: T) => number, random: () => number): T {
  const weights = items.map(item => Math.max(0.0001, weightOf(item)));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let cursor = Math.min(0.999999999, Math.max(0, random())) * total;
  for (let index = 0; index < items.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return items[index];
  }
  return items[items.length - 1];
}

export function selectNextInfiniteCandidate(
  pool: InfiniteHandCandidate[],
  history: HistoryItem[],
  recentCandidateIds: string[] = [],
  recentFamilyIds: string[] = [],
  random: () => number = Math.random,
  now = Date.now(),
): InfiniteHandCandidate | undefined {
  if (!pool.length) return undefined;
  const recentIdSet = new Set(recentCandidateIds.slice(-64));
  const recentFamilySet = new Set(recentFamilyIds.slice(-6));
  let eligible = pool.filter(candidate => !recentIdSet.has(candidate.id));
  if (!eligible.length) eligible = [...pool];
  const familyFresh = eligible.filter(candidate => !recentFamilySet.has(candidate.familyId));
  if (familyFresh.length >= Math.min(8, eligible.length)) eligible = familyFresh;

  const sourceGroups = new Map<InfiniteHandSource, InfiniteHandCandidate[]>();
  eligible.forEach(candidate => sourceGroups.set(candidate.source, [...(sourceGroups.get(candidate.source) || []), candidate]));
  const availableSources = [...sourceGroups.keys()];
  const source = weightedPick(availableSources, item => SOURCE_TARGET[item], random);
  const sourcePool = sourceGroups.get(source) || eligible;
  return weightedPick(sourcePool, candidate => candidateWeight(candidate, history, now), random);
}
