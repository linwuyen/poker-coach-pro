import { HistoryItem, Scenario } from '../types';
import { recommendIntervention, TrainingIntervention } from '../learning-engine/interventionRouter';
import { queryStrategy, STRATEGY_PROFILES_V2, StrategyQueryResult } from '../strategy-engine-v2';
import { companionAdvicePolicy } from './advicePolicy';
import { normalizeStrategyPosition } from './adapters';
import { CompanionAdvicePolicy, CompanionHandState } from './types';

export interface CompanionAnalysis {
  policy: CompanionAdvicePolicy;
  scenario: Scenario | null;
  intervention?: TrainingIntervention;
  strategy?: StrategyQueryResult;
  spr?: number;
  potOdds?: number;
}

function lineFromState(state: CompanionHandState): string {
  const actions = state.actionHistory.map(action => `${action.seat} ${action.action}${action.amountBB === undefined ? '' : ` ${action.amountBB}BB`}`).join(' → ');
  if (actions) return actions;
  const pieces = [state.villainPosition, state.openSizeBB ? `open ${state.openSizeBB}BB` : undefined, state.spot].filter(Boolean);
  return pieces.join(' ') || 'Companion synchronized hand';
}

export function companionScenario(state: CompanionHandState): Scenario {
  const category = [
    state.spot === 'bb-defense' ? 'BB 防守' : undefined,
    state.spot === '3bet' ? '3-Bet' : undefined,
    state.spot === '4bet' ? '4-Bet' : undefined,
    state.spot === 'push-fold' ? 'Push/Fold' : undefined,
    state.tournamentModel === 'icm' ? 'ICM' : undefined,
    state.tournamentModel === 'pko' ? 'PKO' : undefined,
    state.tournamentModel === 'satellite' ? '衛星' : undefined,
    state.street !== 'Preflop' ? 'Board Texture' : undefined,
  ].filter((item): item is string => Boolean(item));

  return {
    id: `companion:${state.handId}`,
    title: `Companion · ${state.heroPosition}${state.villainPosition ? ` vs ${state.villainPosition}` : ''}`,
    category,
    difficulty: '中階',
    type: state.gameFormat === 'MTT' ? 'Tournament' : 'Cash Game',
    blinds: 'companion',
    ante: Boolean(state.anteBB && state.anteBB > 0),
    tourneyInfo: state.tournamentModel,
    userStack: `${state.effectiveStackBB}BB`,
    userBB: state.effectiveStackBB,
    position: state.heroPosition,
    holeCards: [],
    preAction: lineFromState(state),
    effectiveStack: `${state.effectiveStackBB}BB`,
    tableSize: state.tableSize,
    steps: [{
      id: 'current',
      street: state.street,
      communityCards: [],
      description: lineFromState(state),
      potSize: state.potBB,
      spr: state.potBB > 0 ? state.effectiveStackBB / state.potBB : undefined,
      options: [],
      feedbacks: {},
      handState: {
        tableSize: state.tableSize,
        potSizeBB: state.potBB,
        heroStackBB: state.effectiveStackBB,
        actions: state.actionHistory,
      },
    }],
  };
}

function strategyFromState(state: CompanionHandState): StrategyQueryResult | undefined {
  if (state.street !== 'Preflop' || !state.heroHand || !state.spot) return undefined;
  const position = normalizeStrategyPosition(state.heroPosition);
  const villainPosition = normalizeStrategyPosition(state.villainPosition);
  if (!position) return undefined;
  return queryStrategy(STRATEGY_PROFILES_V2, {
    hand: state.heroHand,
    format: state.gameFormat === 'MTT' ? 'tournament' : 'cash',
    tableSize: state.tableSize,
    spot: state.spot,
    position,
    villainPosition,
    stackDepthBB: state.effectiveStackBB,
    anteBB: state.anteBB || 0,
    openSizeBB: state.openSizeBB,
    icm: state.gameFormat === 'MTT' && state.tournamentModel === 'icm' ? { model: 'icm' } : undefined,
    allowApproximate: false,
  });
}

export function analyzeCompanionState(state: CompanionHandState | null, history: HistoryItem[] = [], now = Date.now()): CompanionAnalysis {
  const policy = companionAdvicePolicy(state);
  if (!state) return { policy, scenario: null };
  const scenario = companionScenario(state);
  const spr = state.potBB > 0 ? state.effectiveStackBB / state.potBB : undefined;
  const potOdds = state.amountToCallBB !== undefined && state.amountToCallBB > 0
    ? state.amountToCallBB / (state.potBB + state.amountToCallBB)
    : undefined;
  const intervention = policy.canShowIntervention ? recommendIntervention(scenario, history, now) : undefined;
  const strategy = policy.canShowStrategy ? strategyFromState(state) : undefined;
  return { policy, scenario, intervention, strategy, spr, potOdds };
}
