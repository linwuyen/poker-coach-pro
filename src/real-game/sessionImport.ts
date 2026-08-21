import { GameFormatTag, HistoryItem, TruthTier, UtilityModel, UtilityUnit } from '../types';

export interface NormalizedSessionSpot {
  contextFamilyId: string;
  label?: string;
  scenarioId?: string;
  skillIds?: string[];
  situationIds?: string[];
  street?: HistoryItem['street'];
  position?: string;
  exposureCount: number;
  mistakeCount?: number;
  utilityLoss?: number;
  utilityUnit?: UtilityUnit;
  utilityModel?: UtilityModel;
  truthTier?: TruthTier;
  truthSourceId?: string;
}

export interface NormalizedSessionImport {
  schemaVersion: 1;
  session: {
    id: string;
    format: GameFormatTag;
    handsObserved: number;
    endedAt?: number;
  };
  spots: NormalizedSessionSpot[];
}

function finitePositive(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`${field} 必須是大於 0 的數字。`);
  return value;
}

export function parseNormalizedSessionImport(text: string): NormalizedSessionImport {
  const parsed = JSON.parse(text) as Partial<NormalizedSessionImport>;
  if (parsed.schemaVersion !== 1 || !parsed.session || !Array.isArray(parsed.spots)) throw new Error('不是支援的 Poker Coach Session v1 JSON。');
  if (!parsed.session.id || (parsed.session.format !== 'Cash' && parsed.session.format !== 'MTT')) throw new Error('session.id / session.format 不完整。');
  finitePositive(parsed.session.handsObserved, 'session.handsObserved');
  parsed.spots.forEach((spot, index) => {
    if (!spot.contextFamilyId) throw new Error(`spots[${index}].contextFamilyId 缺失。`);
    finitePositive(spot.exposureCount, `spots[${index}].exposureCount`);
    if (spot.exposureCount > parsed.session!.handsObserved) throw new Error(`spots[${index}].exposureCount 不可大於 session 手牌數。`);
    if (spot.mistakeCount !== undefined && (spot.mistakeCount < 0 || spot.mistakeCount > spot.exposureCount)) throw new Error(`spots[${index}].mistakeCount 不合法。`);
  });
  return parsed as NormalizedSessionImport;
}

export function sessionImportToHistory(payload: NormalizedSessionImport, importedAt = Date.now()): HistoryItem[] {
  const timestamp = payload.session.endedAt || importedAt;
  return payload.spots.map((spot, index) => {
    const mistakes = spot.mistakeCount ?? 0;
    const frequency = spot.exposureCount / payload.session.handsObserved * 100;
    const utilityReady = typeof spot.utilityLoss === 'number' && spot.utilityUnit && spot.utilityModel;
    return {
      schemaVersion: 6,
      attemptId: `session:${payload.session.id}:${index}`,
      trainingType: 'real-hand',
      scenarioId: spot.scenarioId || `session-${payload.session.id}-${spot.contextFamilyId}`,
      masteryKey: `real:${spot.contextFamilyId}`,
      skillIds: spot.skillIds,
      situationIds: spot.situationIds,
      category: ['真實牌局', payload.session.format],
      score: mistakes > 0 ? Math.max(0, Math.round((1 - mistakes / spot.exposureCount) * 10)) : 10,
      judgment: mistakes > 0 ? 'Session leak evidence' : 'Session exposure evidence',
      timestamp,
      correct: mistakes === 0,
      street: spot.street,
      position: spot.position,
      truthTier: spot.truthTier || (utilityReady ? 'exact-math' : 'heuristic-estimate'),
      truthSourceId: spot.truthSourceId,
      spotFrequencyPer100Hands: frequency,
      gameFormat: payload.session.format,
      sessionId: payload.session.id,
      sourceBatchId: payload.session.id,
      realGameSource: 'normalized-session',
      handsObserved: payload.session.handsObserved,
      spotExposureCount: spot.exposureCount,
      contextFamilyId: spot.contextFamilyId,
      evidenceFamilyId: `${payload.session.format}:${spot.contextFamilyId}`,
      utilityLoss: utilityReady ? spot.utilityLoss : undefined,
      utilityUnit: utilityReady ? spot.utilityUnit : undefined,
      utilityModel: utilityReady ? spot.utilityModel : undefined,
      questionLabel: spot.label || `${payload.session.format} · ${spot.contextFamilyId}`,
      notes: `Post-session import · ${spot.exposureCount}/${payload.session.handsObserved} hands = ${frequency.toFixed(2)} spots/100${mistakes ? ` · mistakes ${mistakes}` : ''}`,
    } satisfies HistoryItem;
  });
}

export function importPostSessionJson(text: string, importedAt = Date.now()): HistoryItem[] {
  return sessionImportToHistory(parseNormalizedSessionImport(text), importedAt);
}

export function postSessionTemplate(): NormalizedSessionImport {
  return {
    schemaVersion: 1,
    session: { id: 'session-YYYYMMDD-001', format: 'Cash', handsObserved: 500 },
    spots: [{
      contextFamilyId: 'ctx-example',
      label: 'BB vs BTN open · 100BB',
      skillIds: ['preflop.bb-defense'],
      situationIds: ['format.cash', 'position.bb', 'street.preflop', 'stack.80-125'],
      street: 'Preflop',
      position: 'BB',
      exposureCount: 35,
      mistakeCount: 4,
      utilityLoss: 0.18,
      utilityUnit: 'bb',
      utilityModel: 'cash-chip-ev',
      truthTier: 'verified-solver',
    }],
  };
}
