import { HistoryItem, UtilityUnit } from '../types';
import {
  FgsActionTree,
  IcmPlayer,
  calculateHeadsUpIcmRisk,
  calculateHeadsUpPkoRisk,
  compareFgsActions,
} from '../tournament/icm';
import { ParsedHandHistory } from './handHistory';

export type TournamentContextModel = 'icm' | 'pko' | 'fgs';

export interface TournamentHandContext {
  schemaVersion: 1;
  id: string;
  version: string;
  handId: string;
  model: TournamentContextModel;
  heroId: string;
  players: IcmPlayer[];
  payouts: number[];
  utilityUnit: Extract<UtilityUnit, 'dollar-ev' | 'prize-pool-share' | 'seat-equity'>;
  chosenAction: string;
  reference: string;
  generatedAt: string;
  methodology: string;
  villainId?: string;
  amountAtRisk?: number;
  showdownEquity?: number;
  villainBountyValue?: number;
  bountyCashFraction?: number;
  actionTrees?: FgsActionTree[];
}

export interface TournamentContextEnvelope {
  schemaVersion: 1;
  exportedAt: string;
  contexts: TournamentHandContext[];
  exporter?: string;
}

export interface TournamentUtilityEvaluation {
  contextId: string;
  handId: string;
  model: TournamentContextModel;
  chosenAction: string;
  bestAction: string;
  chosenUtility: number;
  bestUtility: number;
  utilityLoss: number;
  utilityUnit: TournamentHandContext['utilityUnit'];
  reference: string;
}

function validatePlayersAndPayouts(input: TournamentHandContext): void {
  if (!Array.isArray(input.players) || input.players.length < 2) throw new Error(`${input.id}: tournament context requires at least two players.`);
  if (!input.players.some(player => player.id === input.heroId)) throw new Error(`${input.id}: heroId must exist in players.`);
  const ids = new Set(input.players.map(player => player.id));
  if (ids.size !== input.players.length || input.players.some(player => !player.id || !Number.isFinite(player.stack) || player.stack < 0)) {
    throw new Error(`${input.id}: player ids/stacks are invalid.`);
  }
  if (!Array.isArray(input.payouts) || !input.payouts.length || input.payouts.some(value => !Number.isFinite(value) || value < 0)) {
    throw new Error(`${input.id}: explicit finite non-negative payouts are required.`);
  }
}

export function validateTournamentHandContext(input: TournamentHandContext): TournamentHandContext {
  if (!input || input.schemaVersion !== 1) throw new Error('Tournament context schemaVersion must be 1.');
  if (!input.id || !input.version || !input.handId || !input.model || !input.heroId || !input.chosenAction) {
    throw new Error('Tournament context requires id, version, handId, model, heroId and chosenAction.');
  }
  if (!input.reference || !input.generatedAt || !input.methodology) throw new Error(`${input.id}: provenance is required.`);
  if (!Number.isFinite(Date.parse(input.generatedAt))) throw new Error(`${input.id}: invalid generatedAt.`);
  validatePlayersAndPayouts(input);
  if (input.model === 'icm' || input.model === 'pko') {
    if (!input.villainId || !input.players.some(player => player.id === input.villainId)) throw new Error(`${input.id}: villainId is required for ${input.model}.`);
    if (!Number.isFinite(input.amountAtRisk) || (input.amountAtRisk || 0) < 0) throw new Error(`${input.id}: amountAtRisk is required.`);
    if (!Number.isFinite(input.showdownEquity) || (input.showdownEquity || 0) < 0 || (input.showdownEquity || 0) > 1) throw new Error(`${input.id}: showdownEquity must be in [0,1].`);
    if (!['fold', 'call'].includes(input.chosenAction)) throw new Error(`${input.id}: ICM/PKO chosenAction must be fold or call.`);
    if (input.model === 'pko' && (!Number.isFinite(input.villainBountyValue) || (input.villainBountyValue || 0) < 0)) {
      throw new Error(`${input.id}: PKO requires villainBountyValue in the declared utility unit.`);
    }
  }
  if (input.model === 'fgs') {
    if (!Array.isArray(input.actionTrees) || input.actionTrees.length < 2) throw new Error(`${input.id}: FGS requires at least two explicit action trees.`);
    const actions = new Set(input.actionTrees.map(tree => tree.action));
    if (actions.size !== input.actionTrees.length || !actions.has(input.chosenAction)) throw new Error(`${input.id}: FGS action labels must be unique and include chosenAction.`);
  }
  return JSON.parse(JSON.stringify(input)) as TournamentHandContext;
}

export function importTournamentContextEnvelope(raw: string | TournamentContextEnvelope): TournamentHandContext[] {
  const envelope = typeof raw === 'string' ? JSON.parse(raw) as TournamentContextEnvelope : raw;
  if (!envelope || envelope.schemaVersion !== 1 || !Array.isArray(envelope.contexts)) throw new Error('Invalid tournament context envelope.');
  const keys = new Set<string>();
  return envelope.contexts.map(candidate => {
    const context = validateTournamentHandContext(candidate);
    const key = `${context.id}@${context.version}`;
    if (keys.has(key)) throw new Error(`${key}: duplicate tournament context version.`);
    keys.add(key);
    return context;
  });
}

export function evaluateTournamentHandContext(input: TournamentHandContext): TournamentUtilityEvaluation {
  const context = validateTournamentHandContext(input);
  if (context.model === 'fgs') {
    const results = compareFgsActions(context.actionTrees!, context.payouts, context.heroId);
    const chosen = results.find(result => result.action === context.chosenAction)!;
    const best = results[0];
    return {
      contextId: `${context.id}@${context.version}`,
      handId: context.handId,
      model: context.model,
      chosenAction: chosen.action,
      bestAction: best.action,
      chosenUtility: chosen.heroEquity,
      bestUtility: best.heroEquity,
      utilityLoss: Math.max(0, best.heroEquity - chosen.heroEquity),
      utilityUnit: context.utilityUnit,
      reference: context.reference,
    };
  }
  if (context.model === 'pko') {
    const risk = calculateHeadsUpPkoRisk({
      players: context.players,
      payouts: context.payouts,
      heroId: context.heroId,
      villainId: context.villainId!,
      amountAtRisk: context.amountAtRisk!,
      showdownEquity: context.showdownEquity!,
      villainBountyValue: context.villainBountyValue!,
      bountyCashFraction: context.bountyCashFraction,
    });
    const utilities = { fold: risk.foldEquity, call: risk.pkoCallEquity };
    const bestAction = utilities.call > utilities.fold ? 'call' : 'fold';
    const chosenUtility = utilities[context.chosenAction as 'fold' | 'call'];
    const bestUtility = utilities[bestAction];
    return { contextId: `${context.id}@${context.version}`, handId: context.handId, model: context.model, chosenAction: context.chosenAction, bestAction, chosenUtility, bestUtility, utilityLoss: Math.max(0, bestUtility - chosenUtility), utilityUnit: context.utilityUnit, reference: context.reference };
  }
  const risk = calculateHeadsUpIcmRisk({
    players: context.players,
    payouts: context.payouts,
    heroId: context.heroId,
    villainId: context.villainId!,
    amountAtRisk: context.amountAtRisk!,
    showdownEquity: context.showdownEquity!,
  });
  const utilities = { fold: risk.foldEquity, call: risk.callEquity };
  const bestAction = utilities.call > utilities.fold ? 'call' : 'fold';
  const chosenUtility = utilities[context.chosenAction as 'fold' | 'call'];
  const bestUtility = utilities[bestAction];
  return { contextId: `${context.id}@${context.version}`, handId: context.handId, model: context.model, chosenAction: context.chosenAction, bestAction, chosenUtility, bestUtility, utilityLoss: Math.max(0, bestUtility - chosenUtility), utilityUnit: context.utilityUnit, reference: context.reference };
}

export function joinTournamentContextsToHands(
  hands: ParsedHandHistory[],
  contexts: TournamentHandContext[],
  importedAt = Date.now(),
): { evaluations: TournamentUtilityEvaluation[]; history: HistoryItem[]; unmatchedContextIds: string[] } {
  const byId = new Map(hands.map(hand => [hand.id, hand]));
  const evaluations: TournamentUtilityEvaluation[] = [];
  const history: HistoryItem[] = [];
  const unmatchedContextIds: string[] = [];
  contexts.forEach(raw => {
    const context = validateTournamentHandContext(raw);
    const hand = byId.get(context.handId);
    if (!hand || hand.format !== 'MTT') {
      unmatchedContextIds.push(`${context.id}@${context.version}`);
      return;
    }
    const evaluation = evaluateTournamentHandContext(context);
    evaluations.push(evaluation);
    history.push({
      schemaVersion: 6,
      trainingType: 'real-hand',
      scenarioId: `tournament-context:${context.id}@${context.version}`,
      sourceHandId: hand.id,
      decisionFamilyId: `tournament:${context.model}:${context.id}`,
      category: ['Real Game', 'Tournament Utility', context.model.toUpperCase()],
      score: evaluation.utilityLoss <= 1e-9 ? 10 : 0,
      judgment: evaluation.utilityLoss <= 1e-9 ? 'utility-aligned' : 'verified-utility-regret',
      timestamp: hand.timestamp || importedAt,
      selectedAction: evaluation.chosenAction,
      bestAction: evaluation.bestAction,
      correct: evaluation.utilityLoss <= 1e-9,
      truthTier: 'exact-math',
      truthSourceId: `${context.id}@${context.version}`,
      truthSourceRef: context.reference,
      gameFormat: 'MTT',
      utilityLoss: evaluation.utilityLoss,
      utilityUnit: evaluation.utilityUnit,
      utilityModel: context.model,
      realGameSource: hand.source,
      notes: `Tournament utility is conditional on explicitly supplied ${context.model.toUpperCase()} state/context. Methodology: ${context.methodology}`,
    });
  });
  return { evaluations, history, unmatchedContextIds };
}
