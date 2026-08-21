import { HistoryItem, Street } from '../types';

const DAY = 86400000;
const LIVE_TRAINING_TYPES = new Set<NonNullable<HistoryItem['trainingType']>>([
  'scenario', 'solver-corpus', 'counterfactual', 'transfer', 'contrastive', 'strategy-surface', 'range', 'gto',
]);

export interface MonthlyTrainingOutcome {
  month: string;
  decisions: number;
  accuracy?: number;
  averageEvLossBB?: number;
  byStreet: Partial<Record<Street, { decisions: number; accuracy: number; averageEvLossBB?: number }>>;
}

export interface FamilyOutcome {
  decisionFamilyId: string;
  street?: Street;
  position?: string;
  observations: number;
  earlyAccuracy?: number;
  recentAccuracy?: number;
  earlyAverageEvLossBB?: number;
  recentAverageEvLossBB?: number;
  observedDeltaBB?: number;
  improved?: boolean;
}

export interface TrainingPrescription {
  decisionFamilyId: string;
  street?: Street;
  position?: string;
  observations: number;
  averageEvLossBB?: number;
  recentTrainingAttempts: number;
  recentTrainingAccuracy?: number;
  delayedRetention?: number;
  priority: number;
  reason: string;
}

export interface LongitudinalTrainingReport {
  months: MonthlyTrainingOutcome[];
  families: FamilyOutcome[];
  prescriptions: TrainingPrescription[];
  caveats: string[];
}

const correct = (item: HistoryItem) => item.correct ?? item.score >= 8;
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
const accuracy = (items: HistoryItem[]) => items.length ? items.filter(correct).length / items.length : undefined;
const evLosses = (items: HistoryItem[]) => items.map(item => item.evLossBB).filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
const isLiveTraining = (item: HistoryItem) => Boolean(item.trainingType && LIVE_TRAINING_TYPES.has(item.trainingType));
function monthKey(timestamp: number) { const d = new Date(timestamp); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }

export function buildMonthlyTrainingOutcomes(history: HistoryItem[]): MonthlyTrainingOutcome[] {
  const groups = new Map<string, HistoryItem[]>();
  history.filter(isLiveTraining).forEach(item => {
    const key = monthKey(item.timestamp);
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, items]) => {
    const byStreet: MonthlyTrainingOutcome['byStreet'] = {};
    for (const street of ['Preflop', 'Flop', 'Turn', 'River'] as Street[]) {
      const subset = items.filter(item => item.street === street);
      if (!subset.length) continue;
      byStreet[street] = { decisions: subset.length, accuracy: accuracy(subset) || 0, averageEvLossBB: mean(evLosses(subset)) };
    }
    return { month, decisions: items.length, accuracy: accuracy(items), averageEvLossBB: mean(evLosses(items)), byStreet };
  });
}

export function buildFamilyOutcomes(history: HistoryItem[], minimumPerPeriod = 5): FamilyOutcome[] {
  const groups = new Map<string, HistoryItem[]>();
  history.filter(isLiveTraining).filter(item => item.decisionFamilyId).forEach(item => {
    const list = groups.get(item.decisionFamilyId!) || [];
    list.push(item);
    groups.set(item.decisionFamilyId!, list);
  });
  return [...groups.entries()].map(([decisionFamilyId, items]) => {
    items.sort((a, b) => a.timestamp - b.timestamp);
    const split = Math.floor(items.length / 2);
    const early = items.slice(0, split);
    const recent = items.slice(split);
    const earlyAccuracy = early.length >= minimumPerPeriod ? accuracy(early) : undefined;
    const recentAccuracy = recent.length >= minimumPerPeriod ? accuracy(recent) : undefined;
    const earlyAverageEvLossBB = early.length >= minimumPerPeriod ? mean(evLosses(early)) : undefined;
    const recentAverageEvLossBB = recent.length >= minimumPerPeriod ? mean(evLosses(recent)) : undefined;
    const delta = earlyAverageEvLossBB !== undefined && recentAverageEvLossBB !== undefined ? recentAverageEvLossBB - earlyAverageEvLossBB : undefined;
    const improved = delta !== undefined
      ? delta < 0
      : earlyAccuracy !== undefined && recentAccuracy !== undefined
        ? recentAccuracy > earlyAccuracy
        : undefined;
    return { decisionFamilyId, street: items[0]?.street, position: items[0]?.position, observations: items.length, earlyAccuracy, recentAccuracy, earlyAverageEvLossBB, recentAverageEvLossBB, observedDeltaBB: delta, improved };
  }).sort((a, b) => b.observations - a.observations);
}

export function buildTrainingPrescriptions(history: HistoryItem[], now = Date.now()): TrainingPrescription[] {
  const recent = history.filter(isLiveTraining).filter(item => item.decisionFamilyId && item.timestamp >= now - 90 * DAY);
  const groups = new Map<string, HistoryItem[]>();
  recent.forEach(item => {
    const list = groups.get(item.decisionFamilyId!) || [];
    list.push(item);
    groups.set(item.decisionFamilyId!, list);
  });

  const prescriptions: TrainingPrescription[] = [];
  for (const [decisionFamilyId, items] of groups) {
    const itemAccuracy = accuracy(items) ?? 0;
    const averageEvLossBB = mean(evLosses(items));
    const delayed = items.filter(item => item.isDelayedReview);
    const delayedRetention = accuracy(delayed);
    const repairNeed = 1 - (delayedRetention ?? itemAccuracy);
    const sampleConfidence = Math.min(1, items.length / 12);
    const evSeverity = averageEvLossBB === undefined ? 1 : 1 + Math.min(3, averageEvLossBB * 2);
    const missSeverity = 0.25 + (1 - itemAccuracy);
    const priority = missSeverity * evSeverity * (0.5 + repairNeed) * (0.5 + sampleConfidence);
    if (priority <= 0.2) continue;
    prescriptions.push({
      decisionFamilyId,
      street: items[0].street,
      position: items[0].position,
      observations: items.length,
      averageEvLossBB,
      recentTrainingAttempts: items.length,
      recentTrainingAccuracy: itemAccuracy,
      delayedRetention,
      priority,
      reason: `Trainer evidence: ${items.length} decisions, accuracy ${(itemAccuracy * 100).toFixed(0)}%${averageEvLossBB !== undefined ? `, mean sourced EV loss ${averageEvLossBB.toFixed(3)} BB` : ''}; repair need ${(repairNeed * 100).toFixed(0)}%; sample confidence ${(sampleConfidence * 100).toFixed(0)}%.`,
    });
  }
  return prescriptions.sort((a, b) => b.priority - a.priority);
}

export function buildLongitudinalPokerReport(history: HistoryItem[], now = Date.now()): LongitudinalTrainingReport {
  return {
    months: buildMonthlyTrainingOutcomes(history),
    families: buildFamilyOutcomes(history),
    prescriptions: buildTrainingPrescriptions(history, now),
    caveats: [
      'All outcomes come from decisions made inside the trainer; no external hand-history or real-money evidence is used.',
      'Accuracy and sourced EV loss describe training performance, not bankroll win rate.',
      'Longitudinal changes are observational unless separately supported by a preregistered randomized N-of-1 result.',
    ],
  };
}
