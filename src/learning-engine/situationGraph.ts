import { HistoryItem, Scenario, StackBand, Street } from '../types';
import { getStackBand } from '../domain/playerProfile';
import { effectiveEvLoss, evRegretScore } from './ev';
import { historyContextFamilyId } from './contextIdentity';

export interface SituationNode {
  id: string;
  label: string;
  axis: 'format' | 'stack' | 'position' | 'pot' | 'street' | 'size' | 'texture';
}

export interface SituationLeak {
  situationId: string;
  label: string;
  attempts: number;
  contextFamilies: number;
  sampleConfidence: number;
  score: number;
  averageEvLossBB: number;
  totalEvLossBB: number;
}

const stackLabel: Record<StackBand, string> = {
  '10-20': '10–20BB', '20-40': '20–40BB', '40-100': '40–100BB', '100+': '100BB+',
};

function normalizePosition(position?: string): string | null {
  if (!position) return null;
  const value = position.toUpperCase().replace(/\s+/g, '');
  return /^(UTG|UTG\+1|UTG\+2|MP|HJ|CO|BTN|SB|BB)$/.test(value) ? value : null;
}

function streetNode(street: Street): SituationNode {
  return { id: `situation.street.${street.toLowerCase()}`, label: street, axis: 'street' };
}

export function inferScenarioSituationNodes(scenario: Scenario): SituationNode[] {
  const text = `${scenario.title} ${scenario.preAction} ${(scenario.category || []).join(' ')} ${scenario.steps.map(step => `${step.description} ${step.potOdds || ''}`).join(' ')}`;
  const nodes: SituationNode[] = [];
  const format = scenario.type === 'Tournament' ? 'tournament' : 'cash';
  nodes.push({ id: `situation.format.${format}`, label: format === 'tournament' ? 'Tournament' : 'Cash', axis: 'format' });
  const stack = getStackBand(scenario.userBB);
  nodes.push({ id: `situation.stack.${stack}`, label: stackLabel[stack], axis: 'stack' });
  const position = normalizePosition(scenario.position);
  if (position) nodes.push({ id: `situation.position.${position.toLowerCase().replace('+', 'p')}`, label: position, axis: 'position' });
  scenario.steps.forEach(step => nodes.push(streetNode(step.street)));

  if (/4-?bet/i.test(text)) nodes.push({ id: 'situation.pot.4bet', label: '4-Bet Pot', axis: 'pot' });
  else if (/3-?bet|squeeze|擠壓/i.test(text)) nodes.push({ id: 'situation.pot.3bet', label: '3-Bet Pot', axis: 'pot' });
  else if (/多人|multiway/i.test(text)) nodes.push({ id: 'situation.pot.multiway', label: 'Multiway', axis: 'pot' });
  else nodes.push({ id: 'situation.pot.srp', label: 'Single-Raised Pot', axis: 'pot' });

  if (/overbet|超額下注|150%|125%/i.test(text)) nodes.push({ id: 'situation.size.overbet', label: 'Overbet', axis: 'size' });
  else if (/75%|大注|big bet/i.test(text)) nodes.push({ id: 'situation.size.large', label: 'Large Bet', axis: 'size' });
  else if (/50%|半池|half pot/i.test(text)) nodes.push({ id: 'situation.size.medium', label: 'Medium Bet', axis: 'size' });
  else if (/33%|25%|小注|small bet/i.test(text)) nodes.push({ id: 'situation.size.small', label: 'Small Bet', axis: 'size' });

  if (/同花|flush|♥|♠|♦|♣/i.test(text)) nodes.push({ id: 'situation.texture.flush-relevant', label: 'Flush-Relevant', axis: 'texture' });
  if (/順子|straight|connected|連張/i.test(text)) nodes.push({ id: 'situation.texture.connected', label: 'Connected', axis: 'texture' });
  if (/paired|成對|對子面/i.test(text)) nodes.push({ id: 'situation.texture.paired', label: 'Paired Board', axis: 'texture' });
  (scenario.situationIds || []).forEach(id => nodes.push({ id, label: id, axis: 'pot' }));
  return [...new Map(nodes.map(node => [node.id, node])).values()];
}

export function inferSituationIdsFromHistory(item: HistoryItem): string[] {
  if (item.situationIds?.length) return [...new Set(item.situationIds)];
  const ids: string[] = [];
  if (item.gameFormat === 'Cash' || item.category.includes('Cash')) ids.push('situation.format.cash');
  if (item.gameFormat === 'MTT' || item.category.includes('MTT')) ids.push('situation.format.tournament');
  if (item.street) ids.push(`situation.street.${item.street.toLowerCase()}`);
  const position = normalizePosition(item.position);
  if (position) ids.push(`situation.position.${position.toLowerCase().replace('+', 'p')}`);
  const text = `${item.questionLabel || ''} ${(item.category || []).join(' ')} ${item.notes || ''}`;
  if (/4-?bet/i.test(text)) ids.push('situation.pot.4bet');
  else if (/3-?bet|squeeze|擠壓/i.test(text)) ids.push('situation.pot.3bet');
  else if (/多人|multiway/i.test(text)) ids.push('situation.pot.multiway');
  if (/overbet|超額下注|150%|125%/i.test(text)) ids.push('situation.size.overbet');
  if (item.boardTextureId) ids.push(`situation.texture.${item.boardTextureId}`);
  return [...new Set(ids)];
}

const labelFromId = (id: string) => id.split('.').slice(2).join(' · ').replace(/-/g, ' ');

export function calculateSituationLeaks(history: HistoryItem[]): SituationLeak[] {
  const groups = new Map<string, HistoryItem[]>();
  history.filter(item => item.trainingType !== 'custom').forEach(item => {
    inferSituationIdsFromHistory(item).forEach(id => groups.set(id, [...(groups.get(id) || []), item]));
  });
  return [...groups.entries()].map(([situationId, attempts]) => {
    const losses = attempts
      .filter(item => item.utilityUnit === 'bb' || (!item.utilityUnit && !item.category.includes('MTT')))
      .map(effectiveEvLoss)
      .filter((value): value is number => typeof value === 'number');
    const performances = attempts.map(item => {
      const loss = item.utilityUnit === 'bb' || (!item.utilityUnit && !item.category.includes('MTT')) ? effectiveEvLoss(item) : undefined;
      return typeof loss === 'number' ? evRegretScore(loss) : (item.correct ?? item.score >= 8) ? 100 : item.score * 10;
    });
    const totalEvLossBB = losses.reduce((sum, value) => sum + value, 0);
    const contextFamilies = new Set(attempts.map(item => historyContextFamilyId(item) || `scenario:${item.scenarioId}`)).size;
    const days = new Set(attempts.map(item => new Date(item.timestamp).toISOString().slice(0, 10))).size;
    const effectiveSamples = Math.min(attempts.length, contextFamilies * 1.5 + days * 0.5);
    return {
      situationId,
      label: labelFromId(situationId),
      attempts: attempts.length,
      contextFamilies,
      sampleConfidence: Math.round((1 - Math.exp(-effectiveSamples / 6)) * 100),
      score: performances.length ? Math.round(performances.reduce((sum, value) => sum + value, 0) / performances.length) : 0,
      averageEvLossBB: losses.length ? totalEvLossBB / losses.length : 0,
      totalEvLossBB,
    };
  }).sort((a, b) => b.totalEvLossBB - a.totalEvLossBB || a.score - b.score || b.sampleConfidence - a.sampleConfidence);
}
