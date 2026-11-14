import { HistoryItem, TransferLevel } from '../types';
import { historyContextFamilyId, historyDecisionFamilyId, transferDistance } from './contextIdentity';

/** Earlier contrastive screens omitted pot/preflop context; keep exposure but retire their grades. */
export function hasValidLearningContext(item: HistoryItem): boolean {
  return item.trainingType !== 'contrastive' || (item.decisionContextVersion ?? 0) >= 3;
}

/** Assessment evidence requires an unaided first exposure with valid decision context. */
export function hasValidAssessmentEvidence(item: HistoryItem): boolean {
  if (item.trainingType === 'custom' || item.trainingType === 'solver-corpus') return false;
  if (!hasValidLearningContext(item)) return false;
  if (item.datasetRowId && (item.decisionContextVersion ?? 0) < 2) return false;
  if (item.isReview || item.isDelayedReview || item.isUnseen === false) return false;
  if (item.examMode && !item.examCompletedAt) return false;
  return true;
}

export function hasValidTransferEvidence(item: HistoryItem): boolean {
  return hasValidAssessmentEvidence(item) && transferDistance(item) > 0;
}

export function firstAssessmentEvidence(history: HistoryItem[]): HistoryItem[] {
  const seen = new Set<string>();
  const result: HistoryItem[] = [];
  for (const item of [...history].sort((a, b) => a.timestamp - b.timestamp)) {
    // A dataset row is one decision regardless of changed fingerprints, missing
    // legacy format/step metadata, or which training screen revealed it.
    const identity = item.datasetRowId
      ? `dataset:${item.truthSourceId || 'pokerbench-aaai2025'}:${item.datasetRowId}`
      : `${item.gameFormat || ''}:${historyContextFamilyId(item) || historyDecisionFamilyId(item)}:${item.stepId || 'root'}`;
    if (!seen.has(identity) && hasValidAssessmentEvidence(item)) result.push(item);
    seen.add(identity);
  }
  return result;
}

export function firstTransferEvidence(history: HistoryItem[]): HistoryItem[] {
  return firstAssessmentEvidence(history).filter(hasValidTransferEvidence);
}

export interface TransferBucket {
  level: TransferLevel;
  attempts: number;
  correct: number;
  accuracy: number;
}

export interface TransferBenchmarkReport {
  near: TransferBucket;
  context: TransferBucket;
  structural: TransferBucket;
}

function bucket(level: TransferLevel, items: HistoryItem[]): TransferBucket {
  const selected = items.filter(item => {
    const distance = transferDistance(item);
    return level === 'near' ? distance === 1 : level === 'context' ? distance === 2 : distance >= 3;
  });
  const correct = selected.filter(item => item.correct ?? item.score >= 8).length;
  return { level, attempts: selected.length, correct, accuracy: selected.length ? Math.round(correct / selected.length * 100) : 0 };
}

export function transferBenchmarkReport(history: HistoryItem[]): TransferBenchmarkReport {
  const evidence = firstTransferEvidence(history);
  return {
    near: bucket('near', evidence),
    context: bucket('context', evidence),
    structural: bucket('structural', evidence),
  };
}

export function annotateTransferLevel(item: HistoryItem, level: TransferLevel): HistoryItem {
  return { ...item, isTransferTest: true, transferLevel: level };
}
