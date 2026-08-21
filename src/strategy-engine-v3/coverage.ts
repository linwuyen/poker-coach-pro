import { canonicalHoleCombo, postflopContextKey } from './context';
import { PostflopAction, PostflopTruthNode, PostflopVerifiedRegret } from './types';

const ACTIONS: PostflopAction[] = ['check','bet','call','raise','fold','allIn'];

export interface PostflopCoverageReport {
  nodes: number;
  contexts: number;
  comboFrequencyRows: number;
  comboEvRows: number;
  mixedComboRows: number;
  fullEvComboRows: number;
  streets: Record<'Flop' | 'Turn' | 'River', number>;
}

export function buildPostflopCoverageReport(nodes: PostflopTruthNode[]): PostflopCoverageReport {
  const verified = nodes.filter(node => node.source.trustTier === 'verified-solver');
  let comboFrequencyRows = 0;
  let comboEvRows = 0;
  let mixedComboRows = 0;
  let fullEvComboRows = 0;
  const streets = { Flop: 0, Turn: 0, River: 0 };
  for (const node of verified) {
    streets[node.context.street] += 1;
    for (const frequency of Object.values(node.strategyByCombo || {})) {
      comboFrequencyRows += 1;
      if (ACTIONS.filter(action => (frequency[action] || 0) >= 0.05).length > 1) mixedComboRows += 1;
    }
    for (const ev of Object.values(node.evByCombo || {})) {
      comboEvRows += 1;
      if (ACTIONS.filter(action => typeof ev[action] === 'number' && Number.isFinite(ev[action])).length >= 2) fullEvComboRows += 1;
    }
  }
  return {
    nodes: verified.length,
    contexts: new Set(verified.map(node => postflopContextKey(node.context))).size,
    comboFrequencyRows,
    comboEvRows,
    mixedComboRows,
    fullEvComboRows,
    streets,
  };
}

export function verifiedPostflopRegret(node: PostflopTruthNode, heroCards: string[], chosenAction: PostflopAction): PostflopVerifiedRegret | undefined {
  if (node.source.trustTier !== 'verified-solver') return undefined;
  let combo: string;
  try { combo = canonicalHoleCombo(heroCards); } catch { return undefined; }
  const ev = node.evByCombo?.[combo];
  const chosen = ev?.[chosenAction];
  if (typeof chosen !== 'number' || !Number.isFinite(chosen)) return undefined;
  const available = ACTIONS
    .map(action => [action, ev?.[action]] as const)
    .filter((entry): entry is readonly [PostflopAction, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]));
  if (available.length < 2) return undefined;
  available.sort((a, b) => b[1] - a[1]);
  const [bestAction, bestEvBB] = available[0];
  return { combo, chosenAction, bestAction, chosenEvBB: chosen, bestEvBB, evLossBB: Math.max(0, bestEvBB - chosen) };
}
