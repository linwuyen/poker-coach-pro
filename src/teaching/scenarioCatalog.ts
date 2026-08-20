import { scenarios as rawCoreScenarios } from '../coreData';
import { ActionType, Feedback, Scenario, Suit } from '../types';

const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};

const SUIT_PERMUTATIONS: Suit[][] = [
  ['hearts', 'diamonds', 'clubs', 'spades'],
  ['diamonds', 'clubs', 'spades', 'hearts'],
  ['clubs', 'spades', 'hearts', 'diamonds'],
  ['spades', 'clubs', 'diamonds', 'hearts'],
  ['diamonds', 'spades', 'hearts', 'clubs'],
  ['clubs', 'hearts', 'spades', 'diamonds'],
  ['hearts', 'clubs', 'spades', 'diamonds'],
  ['spades', 'diamonds', 'hearts', 'clubs'],
];

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

/**
 * Legacy source corrections are explicit instead of silently guessing from score.
 * The stricter validator then protects the corrected production catalog.
 */
const GROUND_TRUTH_FIXES: Record<string, ActionType> = {
  '71:1:Fold': 'Call',
  '82:1:Fold': 'Call',
};

function mapTextSymbols(text: string | undefined, map: Record<Suit, Suit>): string | undefined {
  if (!text) return text;
  const symbolMap: Record<string, string> = {
    '♠': SUIT_SYMBOL[map.spades],
    '♥': SUIT_SYMBOL[map.hearts],
    '♦': SUIT_SYMBOL[map.diamonds],
    '♣': SUIT_SYMBOL[map.clubs],
  };
  return text.replace(/[♠♥♦♣]/g, symbol => symbolMap[symbol] || symbol);
}

function mapFeedback(feedback: Feedback, map: Record<Suit, Suit>): Feedback {
  return {
    ...feedback,
    why: mapTextSymbols(feedback.why, map) || feedback.why,
    conceptualError: mapTextSymbols(feedback.conceptualError, map) || feedback.conceptualError,
    remember: mapTextSymbols(feedback.remember, map) || feedback.remember,
    evidence: feedback.evidence ? {
      ...feedback.evidence,
      objective: mapTextSymbols(feedback.evidence.objective, map),
      heroRange: mapTextSymbols(feedback.evidence.heroRange, map),
      villainRange: mapTextSymbols(feedback.evidence.villainRange, map),
      continues: mapTextSymbols(feedback.evidence.continues, map),
      blockers: mapTextSymbols(feedback.evidence.blockers, map),
      reversals: feedback.evidence.reversals?.map(text => mapTextSymbols(text, map) || text),
    } : undefined,
  };
}

function repairKnownGroundTruth(scenario: Scenario): Scenario {
  return {
    ...scenario,
    steps: scenario.steps.map(step => ({
      ...step,
      feedbacks: Object.fromEntries(Object.entries(step.feedbacks).map(([action, feedback]) => {
        if (!feedback) return [action, feedback];
        const fixedBestAction = GROUND_TRUTH_FIXES[`${scenario.id}:${step.id}:${action}`];
        return [action, fixedBestAction ? { ...feedback, bestAction: fixedBestAction } : feedback];
      })) as typeof step.feedbacks,
    })),
  };
}

export function makeSuitIsomorphicScenario(base: Scenario, variantIndex: number, idPrefix = 'teach'): Scenario {
  const permutation = SUIT_PERMUTATIONS[Math.abs(variantIndex) % SUIT_PERMUTATIONS.length];
  const suitMap = Object.fromEntries(SUITS.map((suit, index) => [suit, permutation[index]])) as Record<Suit, Suit>;
  const mapCard = (card: Scenario['holeCards'][number]) => ({ ...card, suit: suitMap[card.suit] });
  return {
    ...base,
    id: `${idPrefix}-${base.id}-iso-${variantIndex + 1}`,
    title: `${mapTextSymbols(base.title, suitMap) || base.title} · 同構轉移`,
    preAction: mapTextSymbols(base.preAction, suitMap) || base.preAction,
    holeCards: base.holeCards.map(mapCard),
    reviewSourceId: base.id,
    benchmarkRole: 'training',
    steps: base.steps.map(step => ({
      ...step,
      communityCards: step.communityCards.map(mapCard),
      description: mapTextSymbols(step.description, suitMap) || step.description,
      assumptions: step.assumptions?.map(text => mapTextSymbols(text, suitMap) || text),
      strategySource: mapTextSymbols(step.strategySource, suitMap),
      feedbacks: Object.fromEntries(Object.entries(step.feedbacks).map(([action, feedback]) => [
        action,
        feedback ? mapFeedback(feedback, suitMap) : feedback,
      ])) as typeof step.feedbacks,
    })),
  };
}

export const coreScenarios: Scenario[] = rawCoreScenarios.map(repairKnownGroundTruth);

// 88 originals + 64 curated, strategy-equivalent suit isomorphs = 152 teaching scenarios.
// These variants change visual identity but not strategic truth, so they are safe for retrieval practice.
export const curatedTeachingVariants: Scenario[] = coreScenarios
  .slice(0, 64)
  .map((scenario, index) => makeSuitIsomorphicScenario(scenario, index));

export const scenarios: Scenario[] = [...coreScenarios, ...curatedTeachingVariants];
