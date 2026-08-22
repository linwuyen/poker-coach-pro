import type { HistoryItem } from '../types';
import type { InfiniteHandCandidate } from './infiniteHandGenerator';
import { calculateSkillMastery, getSkillNode, inferScenarioSkillIds, inferSkillIds, SKILL_GRAPH } from './skillGraph';

const DAY_MS = 86400000;

export interface VerifiedEvNorthStar {
  samples: number;
  averageEvLossBB?: number;
  previousSamples: number;
  previousAverageEvLossBB?: number;
  recentSamples: number;
  recentAverageEvLossBB?: number;
  deltaBBPerDecision?: number;
  trainingHours: number;
  learningRoiBBPerHour?: number;
  highCostMistakes: number;
}

export interface SkillKnowledgeState {
  skillId: string;
  label: string;
  understanding: number;
  retention?: number;
  transfer?: number;
  calibration?: number;
  reasoning?: number;
  evidenceCount: number;
  sampleConfidence: number;
  uncertainty: number;
  averageEvLossBB: number;
  priority: number;
  dataGap: boolean;
}

export interface CandidateLearningSignal {
  predictedSuccessProbability: number;
  uncertainty: number;
  duePressure: number;
  evSeverity: number;
  transferGap: number;
  reasoningGap: number;
  spotFrequency: number;
  priorityScore: number;
  weight: number;
}

export interface CalibrationBin {
  min: number;
  max: number;
  samples: number;
  predicted: number;
  observed: number;
}

export interface AdaptiveCalibrationReport {
  samples: number;
  brierScore?: number;
  calibrationError?: number;
  bins: CalibrationBin[];
}

function correct(item: HistoryItem): boolean {
  return item.correct ?? item.score >= 8;
}

function understood(item: HistoryItem): boolean {
  return correct(item) && item.reasoningProbeResult !== 'fail';
}

function average(values: number[]): number | undefined {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function percent(items: HistoryItem[], predicate: (item: HistoryItem) => boolean = correct): number | undefined {
  if (!items.length) return undefined;
  return items.filter(predicate).length / items.length * 100;
}

export function isEvaluationAttempt(item: HistoryItem): boolean {
  return item.trainingType === 'benchmark'
    || item.trainingType === 'solver-benchmark'
    || item.trainingType === 'transfer'
    || item.trainingType === 'counterfactual'
    || item.trainingType === 'contrastive'
    || Boolean(item.isTransferTest)
    || item.solverCorpusRole === 'holdout';
}

export function isVerifiedEvaluationEv(item: HistoryItem): boolean {
  return isEvaluationAttempt(item)
    && (item.truthTier === 'verified-solver' || item.truthTier === 'exact-math')
    && item.gameFormat === 'Cash'
    && item.utilityUnit === 'bb'
    && item.utilityModel === 'cash-chip-ev'
    && typeof item.evLossBB === 'number'
    && Number.isFinite(item.evLossBB);
}

export function verifiedEvNorthStar(history: HistoryItem[], now = Date.now()): VerifiedEvNorthStar {
  const verified = history.filter(isVerifiedEvaluationEv);
  const recentStart = now - 7 * DAY_MS;
  const previousStart = now - 14 * DAY_MS;
  const recent = verified.filter(item => item.timestamp >= recentStart && item.timestamp <= now);
  const previous = verified.filter(item => item.timestamp >= previousStart && item.timestamp < recentStart);
  const allAverage = average(verified.map(item => Math.max(0, item.evLossBB || 0)));
  const recentAverage = average(recent.map(item => Math.max(0, item.evLossBB || 0)));
  const previousAverage = average(previous.map(item => Math.max(0, item.evLossBB || 0)));
  const delta = recentAverage === undefined || previousAverage === undefined ? undefined : recentAverage - previousAverage;
  const trainingMs = history
    .filter(item => item.timestamp >= recentStart && item.timestamp <= now && item.trainingType !== 'custom' && !isEvaluationAttempt(item))
    .reduce((sum, item) => sum + Math.max(0, item.durationMs || 0), 0);
  const trainingHours = trainingMs / 3600000;
  const learningRoi = delta === undefined || trainingHours <= 0 ? undefined : Math.max(0, -delta) / trainingHours;
  return {
    samples: verified.length,
    averageEvLossBB: allAverage,
    previousSamples: previous.length,
    previousAverageEvLossBB: previousAverage,
    recentSamples: recent.length,
    recentAverageEvLossBB: recentAverage,
    deltaBBPerDecision: delta,
    trainingHours,
    learningRoiBBPerHour: learningRoi,
    highCostMistakes: verified.filter(item => (item.evLossBB || 0) >= 0.5).length,
  };
}

function skillIdsForItem(item: HistoryItem): string[] {
  return item.skillIds?.length ? item.skillIds : inferSkillIds(item.category || [], item.street);
}

export function buildKnowledgeStates(history: HistoryItem[]): SkillKnowledgeState[] {
  const mastery = new Map(calculateSkillMastery(history).map(item => [item.skillId, item]));
  return SKILL_GRAPH.map(node => {
    const items = history.filter(item => item.trainingType !== 'custom' && skillIdsForItem(item).includes(node.id));
    const recent = [...items].sort((a, b) => b.timestamp - a.timestamp).slice(0, 12);
    const delayed = items.filter(item => item.isDelayedReview);
    const transfer = items.filter(item => item.isTransferTest || item.trainingType === 'transfer' || item.trainingType === 'counterfactual' || item.trainingType === 'contrastive' || item.solverCorpusRole === 'holdout');
    const confidence = items.filter(item => item.confidence);
    const probes = items.filter(item => item.reasoningProbeResult && item.reasoningProbeResult !== 'skipped');
    const record = mastery.get(node.id);
    const understanding = percent(recent, understood) ?? record?.score ?? 0;
    const retention = percent(delayed, understood);
    const transferScore = percent(transfer);
    const calibration = confidence.length ? 100 - average(confidence.map(item => {
      const predicted = ({ 1: 0.35, 2: 0.55, 3: 0.75, 4: 0.9 } as const)[item.confidence!];
      return Math.abs(predicted - (correct(item) ? 1 : 0)) * 100;
    }))! : undefined;
    const reasoning = probes.length ? probes.filter(item => item.reasoningProbeResult === 'pass').length / probes.length * 100 : undefined;
    const sampleConfidence = record?.sampleConfidence ?? 0;
    const uncertainty = 100 - sampleConfidence;
    const averageEvLossBB = record?.averageEvLossBB ?? 0;
    const retentionGap = retention === undefined ? 0.5 : 1 - retention / 100;
    const transferGap = transferScore === undefined ? 0.65 : 1 - transferScore / 100;
    const understandingGap = 1 - understanding / 100;
    const reasoningGap = reasoning === undefined ? 0.5 : 1 - reasoning / 100;
    const severity = clamp01(averageEvLossBB / 1.5);
    const priority = Math.round(clamp01(
      0.24 * (uncertainty / 100)
      + 0.22 * transferGap
      + 0.17 * retentionGap
      + 0.17 * understandingGap
      + 0.10 * reasoningGap
      + 0.10 * severity,
    ) * node.evImportance / 1.5 * 100);
    return {
      skillId: node.id,
      label: node.label,
      understanding: Math.round(understanding),
      retention: retention === undefined ? undefined : Math.round(retention),
      transfer: transferScore === undefined ? undefined : Math.round(transferScore),
      calibration: calibration === undefined ? undefined : Math.round(calibration),
      reasoning: reasoning === undefined ? undefined : Math.round(reasoning),
      evidenceCount: items.length,
      sampleConfidence,
      uncertainty,
      averageEvLossBB,
      priority,
      dataGap: items.length < 3 || sampleConfidence < 35,
    };
  }).sort((left, right) => right.priority - left.priority || right.uncertainty - left.uncertainty);
}

function historyMatchesCandidate(candidate: InfiniteHandCandidate, item: HistoryItem): boolean {
  if (item.decisionFamilyId === candidate.familyId || item.contextFamilyId === candidate.familyId) return true;
  if (candidate.kind === 'scenario') return item.scenarioId === candidate.scenario.id;
  return item.datasetRowId === candidate.row.id;
}

function scenarioImportance(candidate: InfiniteHandCandidate): number {
  if (candidate.kind !== 'scenario') return 1;
  const ids = inferScenarioSkillIds(candidate.scenario);
  const values = ids.map(id => getSkillNode(id)?.evImportance).filter((value): value is number => typeof value === 'number');
  return average(values) ?? 1;
}

export function candidateLearningSignal(candidate: InfiniteHandCandidate, history: HistoryItem[], now = Date.now()): CandidateLearningSignal {
  const relevant = history.filter(item => historyMatchesCandidate(candidate, item)).sort((a, b) => a.timestamp - b.timestamp).slice(-40);
  const successes = relevant.filter(correct).length;
  const failures = relevant.length - successes;
  const predictedSuccessProbability = (2 + successes) / (4 + successes + failures);
  const uncertainty = 1 - Math.abs(predictedSuccessProbability - 0.5) * 2;
  const dueCount = relevant.filter(item => typeof item.nextReviewAt === 'number' && item.nextReviewAt <= now).length;
  const duePressure = clamp01(dueCount / 2);
  const losses = relevant
    .filter(item => typeof item.evLossBB === 'number' && Number.isFinite(item.evLossBB))
    .map(item => Math.max(0, item.evLossBB || 0));
  const empiricalSeverity = clamp01((average(losses) ?? 0) / 1.5);
  const evSeverity = clamp01(Math.max(empiricalSeverity, (scenarioImportance(candidate) - 0.8) / 0.7));
  const transfers = relevant.filter(item => item.isTransferTest || item.trainingType === 'transfer' || item.trainingType === 'counterfactual' || item.trainingType === 'contrastive');
  const transferRate = transfers.length ? transfers.filter(correct).length / transfers.length : 0.5;
  const transferGap = 1 - transferRate;
  const probes = relevant.filter(item => item.reasoningProbeResult && item.reasoningProbeResult !== 'skipped');
  const reasoningRate = probes.length ? probes.filter(item => item.reasoningProbeResult === 'pass').length / probes.length : 0.5;
  const reasoningGap = 1 - reasoningRate;
  const spotFrequency = candidate.kind === 'scenario' && typeof candidate.scenario.spotFrequencyPer100Hands === 'number'
    ? clamp01(candidate.scenario.spotFrequencyPer100Hands / 10)
    : 0.5;
  const priorityScore = clamp01(
    0.30 * uncertainty
    + 0.20 * evSeverity
    + 0.15 * duePressure
    + 0.13 * transferGap
    + 0.12 * reasoningGap
    + 0.10 * spotFrequency,
  );
  return {
    predictedSuccessProbability,
    uncertainty,
    duePressure,
    evSeverity,
    transferGap,
    reasoningGap,
    spotFrequency,
    priorityScore,
    weight: 0.75 + priorityScore * 2.75,
  };
}

export function adaptiveCalibrationReport(history: HistoryItem[]): AdaptiveCalibrationReport {
  const items = history.filter(item => typeof item.predictedSuccessProbability === 'number' && Number.isFinite(item.predictedSuccessProbability));
  const bins: CalibrationBin[] = [];
  for (let start = 0; start < 1; start += 0.2) {
    const end = Math.min(1, start + 0.2);
    const bucket = items.filter(item => {
      const p = item.predictedSuccessProbability!;
      return p >= start && (end === 1 ? p <= end : p < end);
    });
    if (!bucket.length) continue;
    bins.push({
      min: start,
      max: end,
      samples: bucket.length,
      predicted: average(bucket.map(item => item.predictedSuccessProbability!))!,
      observed: bucket.filter(correct).length / bucket.length,
    });
  }
  const brier = average(items.map(item => {
    const error = item.predictedSuccessProbability! - (correct(item) ? 1 : 0);
    return error * error;
  }));
  const calibrationError = bins.length
    ? bins.reduce((sum, bin) => sum + Math.abs(bin.predicted - bin.observed) * bin.samples, 0) / items.length
    : undefined;
  return { samples: items.length, brierScore: brier, calibrationError, bins };
}
