import type { HistoryItem, Scenario } from '../types';
import { isHiddenBenchmarkScenario } from './benchmark';
import { inferSituationIdsFromHistory, inferSituationIdsFromScenario } from './contextIdentity';

export interface SituationCoverageState {
  situationId: string;
  label: string;
  availableScenarios: number;
  trainingScenarios: number;
  holdoutScenarios: number;
  attempts: number;
  accuracy?: number;
  transferAttempts: number;
  transferAccuracy?: number;
  verifiedEvSamples: number;
  averageVerifiedEvLossBB?: number;
  priority: number;
  dataGap: boolean;
}

function correct(item: HistoryItem): boolean {
  return item.correct ?? item.score >= 8;
}

function average(values: number[]): number | undefined {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

function accuracy(items: HistoryItem[]): number | undefined {
  return items.length ? items.filter(correct).length / items.length * 100 : undefined;
}

function isTransfer(item: HistoryItem): boolean {
  return Boolean(item.isTransferTest)
    || item.trainingType === 'transfer'
    || item.trainingType === 'counterfactual'
    || item.trainingType === 'contrastive'
    || item.trainingType === 'solver-benchmark'
    || item.solverCorpusRole === 'holdout';
}

function verifiedEv(item: HistoryItem): boolean {
  return (item.truthTier === 'exact-math' || item.truthTier === 'verified-solver')
    && item.gameFormat === 'Cash'
    && item.utilityUnit === 'bb'
    && item.utilityModel === 'cash-chip-ev'
    && typeof item.evLossBB === 'number'
    && Number.isFinite(item.evLossBB);
}

function labelForSituation(id: string): string {
  const [dimension, ...rest] = id.split('.');
  const value = rest.join(' · ') || id;
  const labels: Record<string, string> = {
    format: 'Format', position: 'Position', stack: 'Stack', table: 'Table', ante: 'Ante', street: 'Street',
    board: 'Board', boundary: 'Boundary', size: 'Sizing', math: 'Math', postflop: 'Postflop', preflop: 'Preflop',
  };
  return `${labels[dimension] || dimension} · ${value}`;
}

/**
 * Compare the scenario catalog's state-space with the player's actual evidence.
 * Zero-attempt states remain visible instead of disappearing from reports.
 */
export function buildSituationCoverage(scenarios: Scenario[], history: HistoryItem[]): SituationCoverageState[] {
  const universe = new Map<string, { available: number; training: number; holdout: number }>();
  scenarios.forEach(scenario => {
    const hidden = isHiddenBenchmarkScenario(scenario);
    inferSituationIdsFromScenario(scenario).forEach(id => {
      const row = universe.get(id) || { available: 0, training: 0, holdout: 0 };
      row.available += 1;
      if (hidden) row.holdout += 1;
      else row.training += 1;
      universe.set(id, row);
    });
  });

  // Preserve contexts discovered from solver/transfer evidence even if the curated
  // scenario catalog does not contain that situation id.
  history.forEach(item => inferSituationIdsFromHistory(item).forEach(id => {
    if (!universe.has(id)) universe.set(id, { available: 0, training: 0, holdout: 0 });
  }));

  return [...universe.entries()].map(([situationId, source]) => {
    const items = history.filter(item => item.trainingType !== 'custom' && inferSituationIdsFromHistory(item).includes(situationId));
    const transfer = items.filter(isTransfer);
    const evItems = items.filter(verifiedEv);
    const hitRate = accuracy(items);
    const transferRate = accuracy(transfer);
    const evLoss = average(evItems.map(item => Math.max(0, item.evLossBB || 0)));
    const evidenceGap = Math.max(0, 1 - Math.min(1, items.length / 8));
    const accuracyGap = hitRate === undefined ? 0.5 : 1 - hitRate / 100;
    const transferGap = transferRate === undefined ? 0.65 : 1 - transferRate / 100;
    const evSeverity = Math.min(1, (evLoss || 0) / 1.5);
    const catalogGap = source.training === 0 ? 1 : source.training <= 2 ? 0.55 : 0;
    const priority = Math.round(Math.min(1,
      0.28 * evidenceGap
      + 0.22 * accuracyGap
      + 0.24 * transferGap
      + 0.16 * evSeverity
      + 0.10 * catalogGap,
    ) * 100);
    return {
      situationId,
      label: labelForSituation(situationId),
      availableScenarios: source.available,
      trainingScenarios: source.training,
      holdoutScenarios: source.holdout,
      attempts: items.length,
      accuracy: hitRate === undefined ? undefined : Math.round(hitRate),
      transferAttempts: transfer.length,
      transferAccuracy: transferRate === undefined ? undefined : Math.round(transferRate),
      verifiedEvSamples: evItems.length,
      averageVerifiedEvLossBB: evLoss,
      priority,
      dataGap: items.length < 3 || source.training === 0,
    };
  }).sort((left, right) => right.priority - left.priority || Number(right.dataGap) - Number(left.dataGap) || left.label.localeCompare(right.label));
}
