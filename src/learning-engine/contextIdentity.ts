import { GameFormatTag, HistoryItem, Scenario, ScenarioStep, Street } from '../types';

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stable(item)}`)
      .join(',')}}`;
  }
  return String(value ?? '');
}

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim().replace(/\d+(?:\.\d+)?bb/g, 'Xbb');
}

function stackBand(stackBB: number): string {
  if (stackBB < 15) return '<15';
  if (stackBB < 25) return '15-25';
  if (stackBB < 50) return '25-50';
  if (stackBB < 80) return '50-80';
  if (stackBB < 125) return '80-125';
  return '125+';
}

function potBucket(pot: number): string {
  if (pot < 5) return '<5';
  if (pot < 10) return '5-10';
  if (pot < 20) return '10-20';
  if (pot < 40) return '20-40';
  return '40+';
}

/**
 * Collapse cosmetic/isomorphic instance ids into one knowledge family.
 * This also migrates P1/P2 history that was recorded before decisionFamilyId existed.
 */
export function canonicalDecisionFamilyId(value: string): string {
  const match = value.match(/^(?:teach|gen)-(.+)-iso-\d+$/);
  return match?.[1] || value;
}

export function scenarioDecisionFamilyId(scenario: Pick<Scenario, 'id' | 'decisionFamilyId' | 'reviewSourceId'>): string {
  return canonicalDecisionFamilyId(scenario.decisionFamilyId || scenario.reviewSourceId || scenario.id);
}

export function historyDecisionFamilyId(item: Pick<HistoryItem, 'scenarioId' | 'decisionFamilyId'>): string {
  return canonicalDecisionFamilyId(item.decisionFamilyId || item.scenarioId);
}

export function scenarioFormat(scenario: Scenario): GameFormatTag {
  return scenario.type === 'Tournament' ? 'MTT' : 'Cash';
}

export function historyFormat(item: HistoryItem): GameFormatTag | undefined {
  if (item.gameFormat) return item.gameFormat;
  if (item.category.includes('MTT')) return 'MTT';
  if (item.category.includes('Cash')) return 'Cash';
  return undefined;
}

export function scenarioContextFamilyId(scenario: Scenario): string {
  const streets = [...new Set(scenario.steps.map(step => step.street))].sort().join('|');
  const potShape = scenario.steps.map(step => `${step.street}:${potBucket(step.potSize)}:${step.options.slice().sort().join('/')}`).join('|');
  const fields = {
    format: scenarioFormat(scenario),
    tableSize: scenario.tableSize || 'unknown',
    position: scenario.position.toUpperCase(),
    stackBand: stackBand(scenario.userBB),
    ante: scenario.ante,
    streets,
    line: normalize(scenario.preAction),
    potShape,
  };
  return `ctx-${hash(stable(fields))}`;
}

export function historyContextFamilyId(item: HistoryItem): string | undefined {
  return item.contextFamilyId || item.contextFingerprint;
}

export function evidenceFamilyId(item: HistoryItem): string | undefined {
  return item.evidenceFamilyId || historyContextFamilyId(item) || (item.scenarioId ? `scenario:${historyDecisionFamilyId(item)}` : undefined);
}

export function evidenceMatchesScenario(item: HistoryItem, scenario: Scenario): boolean {
  const format = historyFormat(item);
  if (format && format !== scenarioFormat(scenario)) return false;
  const family = historyContextFamilyId(item);
  if (family) return family === scenarioContextFamilyId(scenario);
  // Legacy evidence is intentionally strict: without a structured family id it
  // can only support the exact canonical decision family that produced it.
  return historyDecisionFamilyId(item) === scenarioDecisionFamilyId(scenario);
}

export function inferSituationIdsFromScenario(scenario: Scenario): string[] {
  const ids = new Set<string>();
  ids.add(`format.${scenarioFormat(scenario).toLowerCase()}`);
  ids.add(`position.${scenario.position.toLowerCase()}`);
  ids.add(`stack.${stackBand(scenario.userBB)}`);
  if (scenario.tableSize) ids.add(`table.${scenario.tableSize}`);
  if (scenario.ante) ids.add('ante.on');
  scenario.steps.forEach(step => ids.add(`street.${step.street.toLowerCase()}`));
  (scenario.situationIds || []).forEach(id => ids.add(id));
  return [...ids];
}

/**
 * Decision-local situation evidence. Scenario-wide structural dimensions remain,
 * but street evidence is replaced by exactly the step the player actually saw.
 */
export function inferSituationIdsFromScenarioStep(
  scenario: Scenario,
  step: Pick<ScenarioStep, 'street'>,
): string[] {
  const ids = new Set(inferSituationIdsFromScenario(scenario).filter(id => !id.startsWith('street.')));
  ids.add(`street.${step.street.toLowerCase()}`);
  return [...ids];
}

export function inferSituationIdsFromHistory(item: HistoryItem): string[] {
  if (item.situationIds?.length) return [...new Set(item.situationIds)];
  const ids = new Set<string>();
  const format = historyFormat(item);
  if (format) ids.add(`format.${format.toLowerCase()}`);
  if (item.position) ids.add(`position.${item.position.toLowerCase()}`);
  if (item.street) ids.add(`street.${item.street.toLowerCase()}`);
  if (item.boardTextureId) ids.add(`board.${item.boardTextureId}`);
  return [...ids];
}

export function transferDistance(item: HistoryItem): 0 | 1 | 2 | 3 {
  if (!item.isTransferTest && !item.transferLevel) return 0;
  if (item.transferLevel === 'near') return 1;
  if (item.transferLevel === 'context') return 2;
  if (item.transferLevel === 'structural') return 3;
  return item.trainingType === 'solver-benchmark' ? 3 : item.trainingType === 'counterfactual' ? 2 : 1;
}

export function streetFromScenario(scenario: Scenario): Street {
  return scenario.steps[scenario.steps.length - 1]?.street || 'Preflop';
}
