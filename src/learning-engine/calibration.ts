import { ConfidenceLevel, HistoryItem } from '../types';

export interface CalibrationBin {
  confidence: ConfidenceLevel;
  expectedProbability: number;
  observedAccuracy: number;
  count: number;
  gap: number;
}

export interface CalibrationReport {
  bins: CalibrationBin[];
  expectedCalibrationError: number;
  overconfidence: number;
  underconfidence: number;
  label: 'well-calibrated' | 'overconfident' | 'underconfident' | 'insufficient-data';
}

export const CONFIDENCE_PROBABILITY: Record<ConfidenceLevel, number> = {
  1: 0.35,
  2: 0.55,
  3: 0.75,
  4: 0.9,
};

export function buildCalibrationReport(history: HistoryItem[]): CalibrationReport {
  const usable = history.filter(item => item.confidence && typeof item.correct === 'boolean');
  const bins = ([1, 2, 3, 4] as ConfidenceLevel[]).map(confidence => {
    const items = usable.filter(item => item.confidence === confidence);
    const observedAccuracy = items.length ? items.filter(item => item.correct).length / items.length : 0;
    const expectedProbability = CONFIDENCE_PROBABILITY[confidence];
    return {
      confidence,
      expectedProbability,
      observedAccuracy,
      count: items.length,
      gap: items.length ? observedAccuracy - expectedProbability : 0,
    };
  });

  if (!usable.length) return { bins, expectedCalibrationError: 0, overconfidence: 0, underconfidence: 0, label: 'insufficient-data' };
  const expectedCalibrationError = bins.reduce((sum, bin) => sum + Math.abs(bin.gap) * bin.count / usable.length, 0);
  const overconfidence = bins.reduce((sum, bin) => sum + Math.max(0, -bin.gap) * bin.count / usable.length, 0);
  const underconfidence = bins.reduce((sum, bin) => sum + Math.max(0, bin.gap) * bin.count / usable.length, 0);
  const label = expectedCalibrationError <= 0.08
    ? 'well-calibrated'
    : overconfidence > underconfidence * 1.2
      ? 'overconfident'
      : underconfidence > overconfidence * 1.2
        ? 'underconfident'
        : 'well-calibrated';
  return {
    bins,
    expectedCalibrationError: Math.round(expectedCalibrationError * 1000) / 1000,
    overconfidence: Math.round(overconfidence * 1000) / 1000,
    underconfidence: Math.round(underconfidence * 1000) / 1000,
    label,
  };
}
