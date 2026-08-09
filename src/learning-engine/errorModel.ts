import { ConfidenceLevel, HistoryItem, PokerDecisionAction } from '../types';

export type DecisionErrorType =
  | 'none'
  | 'knowledge-gap'
  | 'mental-model'
  | 'sizing-boundary'
  | 'action-boundary'
  | 'lucky-guess'
  | 'fragile-knowledge';

export interface ErrorDiagnosisInput {
  correct: boolean;
  confidence?: ConfidenceLevel;
  selectedDecision?: PokerDecisionAction;
  bestDecision?: PokerDecisionAction;
}

export function classifyDecisionError(input: ErrorDiagnosisInput): DecisionErrorType {
  if (input.correct) {
    if (input.confidence === 1) return 'lucky-guess';
    if (input.confidence === 2) return 'fragile-knowledge';
    return 'none';
  }
  if (input.selectedDecision && input.bestDecision) {
    if (input.selectedDecision.type === input.bestDecision.type && input.selectedDecision.type !== 'fold' && input.selectedDecision.type !== 'check') return 'sizing-boundary';
    if (input.selectedDecision.type !== input.bestDecision.type) return input.confidence === 4 ? 'mental-model' : 'action-boundary';
  }
  return input.confidence && input.confidence >= 3 ? 'mental-model' : 'knowledge-gap';
}

export function classifyHistoryError(item: HistoryItem): DecisionErrorType {
  return classifyDecisionError({
    correct: item.correct ?? item.score >= 8,
    confidence: item.confidence,
    selectedDecision: item.selectedDecision,
    bestDecision: item.bestDecision,
  });
}

export function improvementProbabilityFromHistory(items: HistoryItem[]): number {
  if (!items.length) return 0.55;
  const recent = [...items].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  const errors = recent.map(classifyHistoryError);
  const wrong = recent.filter(item => !(item.correct ?? item.score >= 8)).length;
  const highConfidenceWrong = recent.filter(item => !(item.correct ?? item.score >= 8) && (item.confidence || 0) >= 3).length;
  const fragile = errors.filter(type => type === 'lucky-guess' || type === 'fragile-knowledge').length;
  const repeatedPenalty = Math.max(0, wrong - 2) * 0.05;
  const repairOpportunity = wrong ? 0.18 : fragile ? 0.1 : 0;
  const mentalModelPenalty = highConfidenceWrong * 0.04;
  return Math.max(0.25, Math.min(0.9, 0.48 + repairOpportunity + fragile * 0.025 - repeatedPenalty - mentalModelPenalty));
}
