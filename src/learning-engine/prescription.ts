import { HistoryItem } from '../types';
import { topEvLeaks } from './skillGraph';
import { calculateSituationLeaks } from './situationGraph';

export interface PrescriptionDay {
  day: 1 | 2 | 4 | 7;
  purpose: 'repair' | 'delayed-recall' | 'transfer' | 'holdout';
  questions: number;
  focus: string;
}

export interface PokerNorthStar {
  recentExpectedLossPer100: number;
  priorExpectedLossPer100: number;
  improvementPercent: number;
  benchmarkAccuracy: number;
  sampleSize: number;
}

export interface TrainingPrescription {
  focusSkill: string;
  focusSituation?: string;
  rationale: string;
  days: PrescriptionDay[];
  northStar: PokerNorthStar;
}

const DAY = 86400000;
const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function weightedExpectedLoss(items: HistoryItem[]): number {
  const values = items.filter(item => typeof item.evLossBB === 'number').map(item => (item.evLossBB || 0) * (item.spotFrequencyPer100Hands || 1));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function getPokerNorthStar(history: HistoryItem[], now = Date.now()): PokerNorthStar {
  const recent = history.filter(item => now - item.timestamp <= 30 * DAY);
  const prior = history.filter(item => now - item.timestamp > 30 * DAY && now - item.timestamp <= 60 * DAY);
  const recentExpectedLossPer100 = weightedExpectedLoss(recent);
  const priorExpectedLossPer100 = weightedExpectedLoss(prior);
  const improvementPercent = priorExpectedLossPer100 > 0
    ? (priorExpectedLossPer100 - recentExpectedLossPer100) / priorExpectedLossPer100 * 100
    : 0;
  const benchmark = history.filter(item => item.trainingType === 'benchmark');
  const benchmarkAccuracy = benchmark.length ? benchmark.filter(item => item.correct ?? item.score >= 8).length / benchmark.length * 100 : 0;
  return {
    recentExpectedLossPer100: round(recentExpectedLossPer100, 3),
    priorExpectedLossPer100: round(priorExpectedLossPer100, 3),
    improvementPercent: round(improvementPercent, 1),
    benchmarkAccuracy: round(benchmarkAccuracy, 1),
    sampleSize: recent.length,
  };
}

export function buildTrainingPrescription(history: HistoryItem[], now = Date.now()): TrainingPrescription {
  const skill = topEvLeaks(history, 1)[0];
  const situation = calculateSituationLeaks(history).find(item => item.attempts >= 2);
  const focusSkill = skill?.label || '建立基準資料';
  const focusSituation = situation?.label;
  const rationale = skill
    ? `${focusSkill} 目前平均 EV regret ${skill.averageEvLossBB.toFixed(3)}BB；${focusSituation ? `最大情境漏點集中在 ${focusSituation}。` : '情境樣本仍在累積。'}`
    : '目前 EV 標記樣本不足，先累積 Decision Boundary、Sizing 與 Hidden Benchmark。';
  return {
    focusSkill,
    focusSituation,
    rationale,
    northStar: getPokerNorthStar(history, now),
    days: [
      { day: 1, purpose: 'repair', questions: 8, focus: focusSkill },
      { day: 2, purpose: 'delayed-recall', questions: 4, focus: focusSkill },
      { day: 4, purpose: 'transfer', questions: 6, focus: focusSituation || focusSkill },
      { day: 7, purpose: 'holdout', questions: 6, focus: 'Hidden Benchmark' },
    ],
  };
}
