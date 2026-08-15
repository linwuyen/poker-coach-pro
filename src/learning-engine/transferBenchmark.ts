import { HistoryItem, TransferLevel } from '../types';
import { transferDistance } from './contextIdentity';

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
  return {
    near: bucket('near', history),
    context: bucket('context', history),
    structural: bucket('structural', history),
  };
}

export function annotateTransferLevel(item: HistoryItem, level: TransferLevel): HistoryItem {
  return { ...item, isTransferTest: true, transferLevel: level };
}
