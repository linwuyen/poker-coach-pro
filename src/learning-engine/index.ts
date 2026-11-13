import { ConfidenceLevel, Feedback, FeedbackQuality, HistoryItem, MasteryStatus, Scenario } from '../types';
import { calculateSkillMastery } from './skillGraph';
import { canonicalDecisionFamilyId, historyContextFamilyId, historyDecisionFamilyId } from './contextIdentity';
import { hasValidTransferEvidence, transferBenchmarkReport } from './transferBenchmark';
export { hasValidTransferEvidence } from './transferBenchmark';

const DAY = 86400000;
const CONFIDENCE_PROBABILITY: Record<ConfidenceLevel, number> = { 1: 0.35, 2: 0.55, 3: 0.75, 4: 0.9 };

export interface MasteryRecord {
  key: string;
  scenarioId: string;
  stepId?: string;
  attempts: number;
  delayedAttempts: number;
  score: number;
  status: MasteryStatus;
  nextReviewAt?: number;
  lastAttemptAt: number;
}

export interface WeaknessInsight {
  key: string;
  total: number;
  rawAccuracy: number;
  adjustedAccuracy: number;
  mastery: number;
  sampleConfidence: number;
  recentTrend: number;
}

export interface LearningMetrics {
  transferSamples: number;
  delayedSamples: number;
  totalDecisions: number;
  unseenAccuracy: number;
  delayedRetention: number;
  confidenceCalibration: number;
  averageEvLossBB: number;
  transferScore: number;
  masteredNodes: number;
}

export interface SessionLearningSummary {
  decisions: number;
  accuracy: number;
  unseenAccuracy: number;
  delayedRetention: number;
  averageEvLossBB: number;
  queuedReviews: number;
  topLeak?: string;
  strongestConcept?: string;
}

export function makeMasteryKey(scenarioId: string, stepId?: string): string {
  return `${canonicalDecisionFamilyId(scenarioId)}::${stepId || 'root'}`;
}

export function getHistoryMasteryKey(item: Pick<HistoryItem, 'scenarioId' | 'decisionFamilyId' | 'stepId' | 'masteryKey'>): string {
  if (item.masteryKey) {
    const separator = item.masteryKey.indexOf('::');
    const prefix = separator >= 0 ? item.masteryKey.slice(0, separator) : item.masteryKey;
    const suffix = separator >= 0 ? item.masteryKey.slice(separator + 2) : (item.stepId || 'root');
    const family = item.decisionFamilyId || canonicalDecisionFamilyId(prefix);
    return `${canonicalDecisionFamilyId(family)}::${suffix || 'root'}`;
  }
  return makeMasteryKey(historyDecisionFamilyId(item), item.stepId);
}

export function getDifficultyWeight(difficulty?: Scenario['difficulty']): number {
  return difficulty === '進階' ? 1.2 : difficulty === '中階' ? 1 : 0.85;
}

export function isHistoryCorrect(item: HistoryItem): boolean {
  return item.correct ?? item.score >= 8;
}

export function isDue(item: HistoryItem, now = Date.now()): boolean {
  return typeof item.nextReviewAt === 'number' && item.nextReviewAt <= now;
}

export function isDelayedReview(previous: HistoryItem | undefined, now = Date.now()): boolean {
  return Boolean(previous && now - previous.timestamp >= 4 * 60 * 60 * 1000);
}

export function latestByMasteryKey(history: HistoryItem[]): Map<string, HistoryItem> {
  const latest = new Map<string, HistoryItem>();
  history.filter(isLearningAttempt).forEach(item => {
    const key = getHistoryMasteryKey(item);
    const current = latest.get(key);
    if (!current || current.timestamp < item.timestamp) latest.set(key, item);
  });
  return latest;
}

export function latestByScenario(history: HistoryItem[]): Map<string, HistoryItem> {
  const latest = new Map<string, HistoryItem>();
  history.filter(isLearningAttempt).forEach(item => {
    const key = historyDecisionFamilyId(item);
    const current = latest.get(key);
    if (!current || current.timestamp < item.timestamp) latest.set(key, item);
  });
  return latest;
}

/** One schedule per decision; old attempts never remain independently overdue. */
export function currentDueReviews(history: HistoryItem[], now = Date.now()): HistoryItem[] {
  const practice = history.filter(item => isLearningAttempt(item) && !item.examMode && item.trainingType !== 'benchmark' && item.trainingType !== 'solver-benchmark');
  // Dataset rows remain the same question when a corrected context changes its
  // fingerprint/mastery key. Old corpus records implicitly used PokerBench.
  const datasetBase = (item: HistoryItem) => JSON.stringify([item.truthSourceId || 'pokerbench-aaai2025', item.datasetRowId]);
  const knownSplits = new Map<string, Set<string>>();
  for (const item of practice) {
    if (!item.datasetRowId || !item.datasetSplit) continue;
    const base = datasetBase(item);
    const splits = knownSplits.get(base) || new Set<string>();
    splits.add(item.datasetSplit);
    knownSplits.set(base, splits);
  }
  const latest = new Map<string, HistoryItem>();
  for (const item of practice) {
    let key = getHistoryMasteryKey(item);
    if (item.datasetRowId) {
      const splits = knownSplits.get(datasetBase(item));
      // Missing legacy splits join only an unambiguous source+row; distinct
      // known splits never clear one another's schedules.
      const split = item.datasetSplit || (splits?.size === 1 ? [...splits][0] : '');
      key = JSON.stringify(['dataset', datasetBase(item), split]);
    }
    const previous = latest.get(key);
    if (!previous || previous.timestamp < item.timestamp) latest.set(key, item);
  }
  return [...latest.values()].filter(item => isDue(item, now));
}

export function calculateMastery(history: HistoryItem[], now = Date.now()): MasteryRecord[] {
  const groups = new Map<string, HistoryItem[]>();
  history.filter(isLearningAttempt).forEach(item => {
    const key = getHistoryMasteryKey(item);
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  });

  return [...groups.entries()].map(([key, attempts]) => {
    const ordered = [...attempts].sort((a, b) => a.timestamp - b.timestamp);
    let weightedCorrect = 0;
    let totalWeight = 0;
    let calibrationTotal = 0;
    let calibrationWeight = 0;
    let delayedCorrect = 0;
    let delayedTotal = 0;

    ordered.forEach(item => {
      const ageDays = Math.max(0, (now - item.timestamp) / DAY);
      const recency = Math.exp(-ageDays / 45);
      const difficulty = item.difficultyWeight || 1;
      const delayedBoost = item.isDelayedReview ? 1.25 : 1;
      const transferBoost = hasValidTransferEvidence(item) ? 1.2 : 1;
      const weight = recency * difficulty * delayedBoost * transferBoost;
      const correct = isHistoryCorrect(item) ? 1 : 0;
      weightedCorrect += correct * weight;
      totalWeight += weight;
      if (item.confidence) {
        calibrationTotal += (1 - Math.abs(CONFIDENCE_PROBABILITY[item.confidence] - correct)) * weight;
        calibrationWeight += weight;
      }
      if (item.isDelayedReview) {
        delayedCorrect += correct;
        delayedTotal += 1;
      }
    });

    const correctness = totalWeight ? weightedCorrect / totalWeight : 0;
    const retention = delayedTotal ? delayedCorrect / delayedTotal : Math.min(0.7, correctness);
    const calibration = calibrationWeight ? calibrationTotal / calibrationWeight : 0.6;
    const recent = ordered.slice(-3);
    const stability = recent.length ? recent.filter(isHistoryCorrect).length / recent.length : 0;
    const difficultyAdjusted = Math.min(1, correctness * average(ordered.map(item => item.difficultyWeight || 1)));
    const score = clamp01(correctness * 0.35 + retention * 0.25 + calibration * 0.15 + difficultyAdjusted * 0.15 + stability * 0.1);
    const latest = ordered[ordered.length - 1];
    const status: MasteryStatus = ordered.length < 2 ? 'new' : score >= 0.82 && delayedTotal >= 1 ? 'mastered' : isDue(latest, now) ? 'review' : 'learning';
    const [scenarioId, rawStep] = key.split('::');
    return {
      key,
      scenarioId,
      stepId: rawStep === 'root' ? undefined : rawStep,
      attempts: ordered.length,
      delayedAttempts: delayedTotal,
      score: Math.round(score * 100),
      status,
      nextReviewAt: latest.nextReviewAt,
      lastAttemptAt: latest.timestamp,
    };
  }).sort((a, b) => a.score - b.score || b.attempts - a.attempts);
}

function effectiveSampleCount(items: HistoryItem[]): number {
  const contexts = new Set(items.map(item => historyContextFamilyId(item) || `scenario:${historyDecisionFamilyId(item)}`)).size;
  const days = new Set(items.map(item => new Date(item.timestamp).toISOString().slice(0, 10))).size;
  const delayed = items.filter(item => item.isDelayedReview).length;
  const transfer = items.filter(hasValidTransferEvidence).length;
  return Math.min(items.length, contexts * 1.4 + days * 0.45 + delayed * 0.35 + transfer * 0.45);
}

export function getWeaknessInsights(history: HistoryItem[], now = Date.now()): WeaknessInsight[] {
  const groups = new Map<string, HistoryItem[]>();
  history.filter(isLearningAttempt).forEach(item => {
    (item.category || []).forEach(category => {
      const group = groups.get(category) || [];
      group.push(item);
      groups.set(category, group);
    });
  });

  return [...groups.entries()].map(([key, items]) => {
    const correct = items.filter(isHistoryCorrect).length;
    const rawAccuracy = items.length ? correct / items.length : 0;
    const adjustedAccuracy = (correct + 2) / (items.length + 4);
    const sampleConfidence = 1 - Math.exp(-effectiveSampleCount(items) / 8);
    const relevantMastery = calculateMastery(items, now);
    const mastery = relevantMastery.length ? average(relevantMastery.map(item => item.score / 100)) : adjustedAccuracy;
    const chronological = [...items].sort((a, b) => a.timestamp - b.timestamp);
    const recent = chronological.slice(-5);
    const earlier = chronological.slice(-10, -5);
    const recentRate = recent.length ? recent.filter(isHistoryCorrect).length / recent.length : rawAccuracy;
    const earlierRate = earlier.length ? earlier.filter(isHistoryCorrect).length / earlier.length : rawAccuracy;
    return {
      key,
      total: items.length,
      rawAccuracy: Math.round(rawAccuracy * 100),
      adjustedAccuracy: Math.round(adjustedAccuracy * 100),
      mastery: Math.round(mastery * 100),
      sampleConfidence: Math.round(sampleConfidence * 100),
      recentTrend: Math.round((recentRate - earlierRate) * 100),
    };
  }).sort((a, b) => a.mastery - b.mastery || b.sampleConfidence - a.sampleConfidence || b.total - a.total);
}

export function getLearningMetrics(history: HistoryItem[]): LearningMetrics {
  const items = history.filter(isLearningAttempt);
  const unseen = items.filter(item => item.isUnseen);
  const delayed = items.filter(item => item.isDelayedReview);
  const calibrated = items.filter(item => item.confidence);
  const evItems = items.filter(item => typeof item.evLossBB === 'number' && (item.utilityUnit === 'bb' || (!item.utilityUnit && !item.category.includes('MTT'))));
  const explicitTransfer = transferBenchmarkReport(items);
  const explicitAttempts = explicitTransfer.near.attempts + explicitTransfer.context.attempts + explicitTransfer.structural.attempts;

  let transferScore = 0;
  if (explicitAttempts) {
    const correct = explicitTransfer.near.correct + explicitTransfer.context.correct + explicitTransfer.structural.correct;
    transferScore = correct / explicitAttempts;
  }

  return {
    transferSamples: explicitAttempts,
    delayedSamples: delayed.length,
    totalDecisions: items.length,
    unseenAccuracy: percent(unseen),
    delayedRetention: percent(delayed),
    confidenceCalibration: calibrated.length ? Math.round(average(calibrated.map(item => {
      const probability = CONFIDENCE_PROBABILITY[item.confidence as ConfidenceLevel];
      return 1 - Math.abs(probability - (isHistoryCorrect(item) ? 1 : 0));
    })) * 100) : 0,
    averageEvLossBB: evItems.length ? round(average(evItems.map(item => item.evLossBB || 0)), 3) : 0,
    transferScore: Math.round(transferScore * 100),
    masteredNodes: calculateSkillMastery(items).filter(item => item.status === 'mastered').length,
  };
}

export function buildSessionLearningSummary(items: HistoryItem[]): SessionLearningSummary {
  const concepts = getWeaknessInsights(items);
  const strongest = [...concepts].sort((a, b) => b.mastery - a.mastery)[0];
  const metrics = getLearningMetrics(items);
  return {
    decisions: items.length,
    accuracy: percent(items),
    unseenAccuracy: metrics.unseenAccuracy,
    delayedRetention: metrics.delayedRetention,
    averageEvLossBB: metrics.averageEvLossBB,
    queuedReviews: items.filter(item => !isHistoryCorrect(item) || (item.confidence || 4) <= 2).length,
    topLeak: concepts[0]?.key,
    strongestConcept: strongest?.key,
  };
}

export function resolveFeedbackQuality(feedback: Feedback): FeedbackQuality {
  if (feedback.quality) return feedback.quality;
  const evLoss = feedback.evidence?.evLossBB;
  if (typeof evLoss === 'number') {
    if (evLoss <= 0.02) return 'best';
    if (evLoss <= 0.1) return 'acceptable';
    if (evLoss <= 0.35) return 'suboptimal';
    return 'major-error';
  }
  if (feedback.score >= 9) return 'best';
  if (feedback.score >= 8 || feedback.judgment === '可接受') return 'acceptable';
  return 'label-mismatch';
}

export function feedbackScoreFromEvLoss(evLossBB: number): number {
  if (evLossBB <= 0.02) return 10;
  if (evLossBB <= 0.05) return 9;
  if (evLossBB <= 0.1) return 8;
  if (evLossBB <= 0.25) return 6;
  if (evLossBB <= 0.5) return 4;
  return 1;
}

function isLearningAttempt(item: HistoryItem): boolean {
  return item.trainingType !== 'custom';
}

function percent(items: HistoryItem[]): number {
  return items.length ? Math.round(items.filter(isHistoryCorrect).length / items.length * 100) : 0;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round(value: number, digits: number): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}
