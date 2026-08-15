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

export interface LearningOutcomeSummary {
  immediateRepair: number;
  delayedRetention: number;
  transferSuccess: number;
  repairSamples: number;
  retentionSamples: number;
  transferSamples: number;
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

function betaPosterior(successes: number, failures: number, alpha = 2, beta = 2): number {
  return (alpha + successes) / (alpha + beta + successes + failures);
}

export function empiricalRepairPosterior(items: HistoryItem[]): { probability: number; samples: number } {
  const ordered = [...items].sort((a, b) => a.timestamp - b.timestamp);
  let successes = 0;
  let failures = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const previousCorrect = previous.correct ?? previous.score >= 8;
    if (previousCorrect) continue;
    // Immediate repair measures whether instruction changed the next policy
    // sample. It is useful, but deliberately not treated as retention.
    if (current.timestamp - previous.timestamp > 6 * 60 * 60 * 1000) continue;
    const currentCorrect = current.correct ?? current.score >= 8;
    if (currentCorrect) successes += 1;
    else failures += 1;
  }
  return { probability: betaPosterior(successes, failures), samples: successes + failures };
}

function delayedRetentionPosterior(items: HistoryItem[]): { probability: number; samples: number } {
  const candidates = items.filter(item => item.isDelayedReview || item.isReview || item.reviewIntervalDays && item.reviewIntervalDays >= 0.25);
  let successes = 0;
  let failures = 0;
  candidates.forEach(item => {
    if (item.correct ?? item.score >= 8) successes += 1;
    else failures += 1;
  });
  return { probability: betaPosterior(successes, failures), samples: successes + failures };
}

function transferPosterior(items: HistoryItem[]): { probability: number; samples: number } {
  const candidates = items.filter(item => item.isTransferTest || item.trainingType === 'transfer' || item.trainingType === 'counterfactual' || item.trainingType === 'solver-benchmark' || item.transferLevel);
  let successes = 0;
  let failures = 0;
  candidates.forEach(item => {
    if (item.correct ?? item.score >= 8) successes += 1;
    else failures += 1;
  });
  return { probability: betaPosterior(successes, failures), samples: successes + failures };
}

export function learningOutcomeSummary(items: HistoryItem[]): LearningOutcomeSummary {
  const repair = empiricalRepairPosterior(items);
  const retention = delayedRetentionPosterior(items);
  const transfer = transferPosterior(items);
  return {
    immediateRepair: repair.probability,
    delayedRetention: retention.probability,
    transferSuccess: transfer.probability,
    repairSamples: repair.samples,
    retentionSamples: retention.samples,
    transferSamples: transfer.samples,
  };
}

export function improvementProbabilityFromHistory(items: HistoryItem[]): number {
  if (!items.length) return 0.55;
  const recent = [...items].sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
  const errors = recent.map(classifyHistoryError);
  const wrong = recent.filter(item => !(item.correct ?? item.score >= 8)).length;
  const highConfidenceWrong = recent.filter(item => !(item.correct ?? item.score >= 8) && (item.confidence || 0) >= 3).length;
  const fragile = errors.filter(type => type === 'lucky-guess' || type === 'fragile-knowledge').length;
  const repeatedPenalty = Math.max(0, wrong - 2) * 0.05;
  const repairOpportunity = wrong ? 0.18 : fragile ? 0.1 : 0;
  const mentalModelPenalty = highConfidenceWrong * 0.04;
  const diagnosticPrior = Math.max(0.25, Math.min(0.9, 0.48 + repairOpportunity + fragile * 0.025 - repeatedPenalty - mentalModelPenalty));

  const outcome = learningOutcomeSummary(items);
  const weighted: Array<{ value: number; weight: number }> = [{ value: diagnosticPrior, weight: 1.5 }];
  if (outcome.repairSamples) weighted.push({ value: outcome.immediateRepair, weight: Math.min(2, 0.5 + outcome.repairSamples * 0.2) });
  // Retention and transfer are stronger evidence that the learned policy will
  // survive outside the immediate drill, so they receive higher maximum weight.
  if (outcome.retentionSamples) weighted.push({ value: outcome.delayedRetention, weight: Math.min(3, 1 + outcome.retentionSamples * 0.3) });
  if (outcome.transferSamples) weighted.push({ value: outcome.transferSuccess, weight: Math.min(3.5, 1.25 + outcome.transferSamples * 0.35) });
  const denominator = weighted.reduce((sum, item) => sum + item.weight, 0);
  const probability = weighted.reduce((sum, item) => sum + item.value * item.weight, 0) / denominator;
  return Math.max(0.25, Math.min(0.9, probability));
}
