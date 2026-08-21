import { HistoryItem } from '../types';

const DAY_MS = 86400000;

export interface EffectivenessWindow {
  id: 'baseline' | 'training' | 'followup';
  label: string;
  start: number;
  end: number;
}

export interface EffectivenessWindowMetrics {
  window: EffectivenessWindow;
  decisions: number;
  trainingDecisions: number;
  holdoutAttempts: number;
  holdoutAccuracy?: number;
  transferAttempts: number;
  transferAccuracy?: number;
  delayedAttempts: number;
  delayedRetention?: number;
}

export interface MetricDelta {
  baseline?: number;
  followup?: number;
  delta?: number;
  direction: 'higher-is-better' | 'lower-is-better';
  improved?: boolean;
}

export interface EffectivenessReport {
  observationalOnly: true;
  windows: EffectivenessWindowMetrics[];
  holdout: MetricDelta;
  transfer: MetricDelta;
  delayedRetention: MetricDelta;
  evidenceLevel: 'insufficient' | 'emerging' | 'usable';
  caveats: string[];
}

const isCorrect = (item: HistoryItem): boolean => item.correct ?? item.score >= 8;

export function defaultEffectivenessWindows(now = Date.now()): EffectivenessWindow[] {
  const day = (n: number) => n * DAY_MS;
  return [
    { id: 'baseline', label: 'Baseline · D-28 → D-15', start: now - day(28), end: now - day(14) },
    { id: 'training', label: 'Training · D-14 → D-8', start: now - day(14), end: now - day(7) },
    { id: 'followup', label: 'Follow-up · D-7 → Today', start: now - day(7), end: now + 1 },
  ];
}

function accuracy(items: HistoryItem[]): number | undefined {
  if (!items.length) return undefined;
  return items.filter(isCorrect).length / items.length * 100;
}

function isHoldout(item: HistoryItem): boolean {
  return item.trainingType === 'benchmark' || item.trainingType === 'solver-benchmark' || item.solverCorpusRole === 'holdout';
}

function isTransfer(item: HistoryItem): boolean {
  return Boolean(item.isTransferTest) || item.trainingType === 'transfer' || item.trainingType === 'counterfactual' || item.trainingType === 'solver-benchmark' || item.trainingType === 'contrastive';
}

function isTrainingDecision(item: HistoryItem): boolean {
  return item.trainingType !== 'custom' && !isHoldout(item);
}

export function effectivenessWindowMetrics(history: HistoryItem[], window: EffectivenessWindow): EffectivenessWindowMetrics {
  const items = history.filter(item => item.timestamp >= window.start && item.timestamp < window.end && item.trainingType !== 'custom');
  const holdout = items.filter(isHoldout);
  const transfer = items.filter(isTransfer);
  const delayed = items.filter(item => item.isDelayedReview);
  return {
    window,
    decisions: items.length,
    trainingDecisions: items.filter(isTrainingDecision).length,
    holdoutAttempts: holdout.length,
    holdoutAccuracy: accuracy(holdout),
    transferAttempts: transfer.length,
    transferAccuracy: accuracy(transfer),
    delayedAttempts: delayed.length,
    delayedRetention: accuracy(delayed),
  };
}

function delta(baseline: number | undefined, followup: number | undefined, direction: MetricDelta['direction']): MetricDelta {
  const value = baseline === undefined || followup === undefined ? undefined : followup - baseline;
  return {
    baseline,
    followup,
    delta: value,
    direction,
    improved: value === undefined ? undefined : direction === 'higher-is-better' ? value > 0 : value < 0,
  };
}

export function evaluateLearningEffectiveness(
  history: HistoryItem[],
  windows = defaultEffectivenessWindows(),
): EffectivenessReport {
  if (windows.length !== 3 || windows[0].id !== 'baseline' || windows[1].id !== 'training' || windows[2].id !== 'followup') {
    throw new Error('Effectiveness evaluation requires baseline, training and followup windows in order.');
  }
  windows.forEach((window, index) => {
    if (!Number.isFinite(window.start) || !Number.isFinite(window.end) || window.end <= window.start) throw new Error(`${window.id} window is invalid.`);
    if (index > 0 && window.start < windows[index - 1].end) throw new Error('Effectiveness windows must not overlap.');
  });
  const metrics = windows.map(window => effectivenessWindowMetrics(history, window));
  const baseline = metrics[0];
  const followup = metrics[2];
  const evaluationEvidence = baseline.holdoutAttempts + followup.holdoutAttempts + baseline.transferAttempts + followup.transferAttempts;
  const evidenceLevel: EffectivenessReport['evidenceLevel'] = evaluationEvidence >= 30 && (baseline.holdoutAttempts >= 5 || baseline.transferAttempts >= 8) && (followup.holdoutAttempts >= 5 || followup.transferAttempts >= 8)
    ? 'usable'
    : evaluationEvidence >= 10
      ? 'emerging'
      : 'insufficient';
  const caveats = [
    '這是單一玩家的 observational before/after report，不是隨機對照實驗，不能單獨證明訓練造成改善。',
    'Holdout 必須保持未洩漏；兩個時窗都有足夠樣本時才適合比較，樣本太少只視為方向訊號。',
    'Transfer 與 delayed retention 只來自訓練機 History；外部真實牌局資料不再是此產品的證據來源。',
  ];
  return {
    observationalOnly: true,
    windows: metrics,
    holdout: delta(baseline.holdoutAccuracy, followup.holdoutAccuracy, 'higher-is-better'),
    transfer: delta(baseline.transferAccuracy, followup.transferAccuracy, 'higher-is-better'),
    delayedRetention: delta(baseline.delayedRetention, followup.delayedRetention, 'higher-is-better'),
    evidenceLevel,
    caveats,
  };
}
