import { HistoryItem } from '../types';

export function evRegret(bestEvBB: number, chosenEvBB: number): number {
  return Math.max(0, bestEvBB - chosenEvBB);
}

export function evRegretScore(lossBB: number): number {
  if (lossBB <= 0.02) return 100;
  if (lossBB <= 0.05) return 95;
  if (lossBB <= 0.1) return 88;
  if (lossBB <= 0.25) return 72;
  if (lossBB <= 0.5) return 55;
  if (lossBB <= 1) return 35;
  if (lossBB <= 2) return 18;
  return 5;
}

export function effectiveEvLoss(item: HistoryItem): number | undefined {
  if (typeof item.evLossBB === 'number') return Math.max(0, item.evLossBB);
  if (typeof item.bestEvBB === 'number' && typeof item.chosenEvBB === 'number') {
    return evRegret(item.bestEvBB, item.chosenEvBB);
  }
  return undefined;
}

export function averageEvRegret(items: HistoryItem[]): number {
  const losses = items.map(effectiveEvLoss).filter((value): value is number => typeof value === 'number');
  return losses.length ? losses.reduce((sum, value) => sum + value, 0) / losses.length : 0;
}

export function regretBand(lossBB: number): 'near-indifferent' | 'small' | 'clear' | 'major' | 'punt' {
  if (lossBB <= 0.05) return 'near-indifferent';
  if (lossBB <= 0.25) return 'small';
  if (lossBB <= 0.75) return 'clear';
  if (lossBB <= 2) return 'major';
  return 'punt';
}
