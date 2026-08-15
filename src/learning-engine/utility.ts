import { HistoryItem, Scenario, TruthTier, UtilityModel, UtilityUnit } from '../types';
import { effectiveEvLoss } from './ev';
import { evidenceMatchesScenario, historyFormat, scenarioFormat } from './contextIdentity';

export interface UtilityObservation {
  loss: number;
  unit: UtilityUnit;
  model: UtilityModel;
  truthTier?: TruthTier;
  reportable: boolean;
}

function verifiedTruth(tier?: TruthTier): boolean {
  return tier === 'verified-solver' || tier === 'exact-math';
}

export function utilityObservation(item: HistoryItem): UtilityObservation | undefined {
  if (typeof item.utilityLoss === 'number' && Number.isFinite(item.utilityLoss) && item.utilityLoss >= 0 && item.utilityUnit && item.utilityModel) {
    return {
      loss: item.utilityLoss,
      unit: item.utilityUnit,
      model: item.utilityModel,
      truthTier: item.truthTier,
      reportable: verifiedTruth(item.truthTier),
    };
  }

  // Backward-compatible cash evidence only. Tournament chip BB loss is never
  // silently converted into prize equity.
  const format = historyFormat(item);
  const evLoss = effectiveEvLoss(item);
  if (format === 'Cash' && typeof evLoss === 'number' && Number.isFinite(evLoss) && evLoss >= 0) {
    return {
      loss: evLoss,
      unit: 'bb',
      model: 'cash-chip-ev',
      truthTier: item.truthTier,
      reportable: verifiedTruth(item.truthTier),
    };
  }
  return undefined;
}

export function utilityCompatibleWithScenario(observation: UtilityObservation, scenario: Scenario): boolean {
  if (scenarioFormat(scenario) === 'Cash') return observation.unit === 'bb' && observation.model === 'cash-chip-ev';
  return observation.unit !== 'bb' && observation.model !== 'cash-chip-ev' && observation.model !== 'priority-only';
}

export function matchingUtilityEvidence(history: HistoryItem[], scenario: Scenario): Array<{ item: HistoryItem; observation: UtilityObservation }> {
  return history.flatMap(item => {
    if (!evidenceMatchesScenario(item, scenario)) return [];
    const observation = utilityObservation(item);
    return observation && utilityCompatibleWithScenario(observation, scenario) ? [{ item, observation }] : [];
  });
}

export function scenarioUtilityMode(scenario: Scenario, evidence: Array<{ observation: UtilityObservation }>): 'cash-bb' | 'tournament-dollar' | 'tournament-priority' {
  if (scenarioFormat(scenario) === 'Cash') return 'cash-bb';
  return evidence.length ? 'tournament-dollar' : 'tournament-priority';
}

export function utilityDisplayUnit(unit?: UtilityUnit): string {
  if (unit === 'bb') return 'BB/100';
  if (unit === 'dollar-ev') return '$EV/100';
  if (unit === 'prize-pool-share') return 'Prize-pool share/100';
  if (unit === 'seat-equity') return 'Seat equity/100';
  return 'Priority';
}
