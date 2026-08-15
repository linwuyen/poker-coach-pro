import { HistoryItem, MasteryStatus, Scenario, Street, TruthTier } from '../types';
import { effectiveEvLoss, evRegretScore } from './ev';
import { historyContextFamilyId, inferSituationIdsFromHistory } from './contextIdentity';

export interface SkillNode {
  id: string;
  label: string;
  parent?: string;
  evImportance: number;
  patterns: RegExp[];
}

export interface SkillMastery {
  skillId: string;
  label: string;
  attempts: number;
  distinctScenarios: number;
  contextFamilies: number;
  effectiveSampleSize: number;
  delayedAttempts: number;
  transferAttempts: number;
  score: number;
  averageEvLossBB: number;
  status: MasteryStatus;
  sampleConfidence: number;
}

export const SKILL_GRAPH: SkillNode[] = [
  { id: 'preflop.rfi', label: 'Preflop · RFI', parent: 'preflop', evImportance: 1.0, patterns: [/RFI|開池|open/i] },
  { id: 'preflop.bb-defense', label: 'Preflop · BB Defense', parent: 'preflop', evImportance: 1.15, patterns: [/BB.*防守|大盲|盲注戰/i] },
  { id: 'preflop.3bet', label: 'Preflop · 3-Bet', parent: 'preflop', evImportance: 1.2, patterns: [/3-?Bet|擠壓|Squeeze/i] },
  { id: 'preflop.4bet', label: 'Preflop · 4-Bet', parent: 'preflop', evImportance: 1.25, patterns: [/4-?Bet/i] },
  { id: 'tournament.push-fold', label: 'Tournament · Push/Fold', parent: 'tournament', evImportance: 1.35, patterns: [/Push|Fold|短碼|shove|全下/i] },
  { id: 'tournament.icm', label: 'Tournament · ICM / $EV', parent: 'tournament', evImportance: 1.5, patterns: [/ICM|泡沫|決賽桌|衛星|獎金/i] },
  { id: 'math.pot-odds', label: 'Math · Pot Odds', parent: 'math', evImportance: 1.25, patterns: [/Pot Odds|底池賠率|賠率/i] },
  { id: 'math.equity', label: 'Math · Equity', parent: 'math', evImportance: 1.2, patterns: [/Equity|勝率|outs/i] },
  { id: 'math.spr', label: 'Math · SPR', parent: 'math', evImportance: 1.25, patterns: [/SPR/i] },
  { id: 'range.construction', label: 'Range · 範圍建構', parent: 'range', evImportance: 1.3, patterns: [/範圍建構|range construction|對抗範圍/i] },
  { id: 'range.combo-counting', label: 'Range · Combo Counting', parent: 'range', evImportance: 1.25, patterns: [/組合|combo/i] },
  { id: 'range.blockers', label: 'Range · Blocker', parent: 'range', evImportance: 1.3, patterns: [/Blocker|阻擋/i] },
  { id: 'postflop.value', label: 'Postflop · Value Bet', parent: 'postflop', evImportance: 1.25, patterns: [/Value Bet|價值|薄價值/i] },
  { id: 'postflop.bluff', label: 'Postflop · Bluff', parent: 'postflop', evImportance: 1.25, patterns: [/詐唬|Bluff(?! Catch)/i] },
  { id: 'postflop.bluff-catch', label: 'Postflop · Bluff Catch', parent: 'postflop', evImportance: 1.45, patterns: [/Bluff Catch|抓雞|抓詐唬/i] },
  { id: 'postflop.bet-sizing', label: 'Postflop · Bet Sizing', parent: 'postflop', evImportance: 1.2, patterns: [/尺寸|Bet Sizing|overbet|超額下注/i] },
  { id: 'postflop.board-texture', label: 'Postflop · Board Texture', parent: 'postflop', evImportance: 1.15, patterns: [/濕牌|乾面|牌面|texture/i] },
  { id: 'postflop.multiway', label: 'Postflop · Multiway', parent: 'postflop', evImportance: 1.2, patterns: [/多人|Multiway/i] },
  { id: 'decision.boundary', label: 'Decision · Boundary', parent: 'decision', evImportance: 1.4, patterns: [/decision boundary|反轉|敏感度|counterfactual/i] },
];

function textFor(category: string[], street?: Street): string {
  return `${category.join(' ')} ${street || ''}`;
}

export function inferSkillIds(category: string[] = [], street?: Street): string[] {
  const text = textFor(category, street);
  const ids = SKILL_GRAPH.filter(skill => skill.patterns.some(pattern => pattern.test(text))).map(skill => skill.id);
  if (street === 'Preflop' && !ids.some(id => id.startsWith('preflop.') || id.startsWith('tournament.'))) ids.push('preflop.rfi');
  if (street && street !== 'Preflop' && !ids.some(id => id.startsWith('postflop.'))) ids.push('postflop.board-texture');
  return [...new Set(ids)];
}

export function inferScenarioSkillIds(scenario: Scenario): string[] {
  const categories = [...(scenario.category || []), ...scenario.steps.flatMap(step => step.conceptIds || [])];
  const ids = new Set<string>();
  scenario.steps.forEach(step => inferSkillIds(categories, step.street).forEach(id => ids.add(id)));
  return [...ids];
}

export function getSkillNode(skillId: string): SkillNode | undefined {
  return SKILL_GRAPH.find(skill => skill.id === skillId);
}

function truthWeight(tier?: TruthTier): number {
  if (tier === 'verified-solver' || tier === 'exact-math') return 1.2;
  if (tier === 'population-exploit' || tier === 'expert-baseline') return 1;
  if (tier === 'derived-interpolation') return 0.85;
  if (tier === 'heuristic-estimate') return 0.65;
  return 0.8;
}

function contextKey(item: HistoryItem): string {
  return historyContextFamilyId(item) || `scenario:${item.scenarioId}`;
}

function evidenceSampleSize(items: HistoryItem[]): number {
  const seenContexts = new Set<string>();
  const seenDays = new Set<string>();
  let ess = 0;
  items.forEach(item => {
    const context = contextKey(item);
    const day = new Date(item.timestamp).toISOString().slice(0, 10);
    const contextNovelty = seenContexts.has(context) ? 0.32 : 1;
    const temporalNovelty = seenDays.has(day) ? 0.85 : 1.12;
    const delayed = item.isDelayedReview ? 1.2 : 1;
    const transfer = item.isTransferTest || item.trainingType === 'transfer' || item.trainingType === 'counterfactual' || item.trainingType === 'solver-benchmark' ? 1.25 : 1;
    const situationBreadth = Math.min(1.15, 0.9 + inferSituationIdsFromHistory(item).length * 0.03);
    ess += contextNovelty * temporalNovelty * delayed * transfer * truthWeight(item.truthTier) * situationBreadth;
    seenContexts.add(context);
    seenDays.add(day);
  });
  return ess;
}

export function calculateSkillMastery(history: HistoryItem[], now = Date.now()): SkillMastery[] {
  const groups = new Map<string, HistoryItem[]>();
  history.filter(item => item.trainingType !== 'custom').forEach(item => {
    const skillIds = item.skillIds?.length ? item.skillIds : inferSkillIds(item.category, item.street);
    skillIds.forEach(skillId => groups.set(skillId, [...(groups.get(skillId) || []), item]));
  });

  return [...groups.entries()].map(([skillId, attempts]) => {
    const node = getSkillNode(skillId);
    const ordered = [...attempts].sort((a, b) => a.timestamp - b.timestamp);
    let totalWeight = 0;
    let totalPerformance = 0;
    let delayedAttempts = 0;
    let transferAttempts = 0;
    const losses: number[] = [];
    ordered.forEach(item => {
      const ageDays = Math.max(0, (now - item.timestamp) / 86400000);
      const recency = Math.exp(-ageDays / 60);
      const difficulty = item.difficultyWeight || 1;
      const weight = recency * difficulty * truthWeight(item.truthTier) * (item.isDelayedReview ? 1.2 : 1) * (item.isTransferTest ? 1.2 : 1);
      const loss = effectiveEvLoss(item);
      const performance = typeof loss === 'number' ? evRegretScore(loss) / 100 : (item.correct ?? item.score >= 8) ? 1 : Math.max(0, item.score / 10);
      totalPerformance += performance * weight;
      totalWeight += weight;
      const isCashLoss = item.utilityUnit === 'bb' || (!item.utilityUnit && !item.category.includes('MTT'));
      if (typeof loss === 'number' && isCashLoss) losses.push(loss);
      if (item.isDelayedReview) delayedAttempts += 1;
      if (item.isTransferTest || item.trainingType === 'transfer' || item.trainingType === 'counterfactual' || item.trainingType === 'solver-benchmark') transferAttempts += 1;
    });
    const distinctScenarios = new Set(ordered.map(item => item.scenarioId)).size;
    const contexts = new Set(ordered.map(contextKey)).size;
    const score = totalWeight ? Math.round(totalPerformance / totalWeight * 100) : 0;
    const effectiveSampleSize = evidenceSampleSize(ordered);
    const sampleConfidence = Math.round((1 - Math.exp(-effectiveSampleSize / 7)) * 100);
    const latest = ordered[ordered.length - 1];
    const trulyTransferred = transferAttempts > 0 || contexts >= 2;
    const status: MasteryStatus = ordered.length < 2
      ? 'new'
      : score >= 82 && delayedAttempts >= 1 && trulyTransferred && sampleConfidence >= 55
        ? 'mastered'
        : typeof latest.nextReviewAt === 'number' && latest.nextReviewAt <= now
          ? 'review'
          : 'learning';
    return {
      skillId,
      label: node?.label || skillId,
      attempts: ordered.length,
      distinctScenarios,
      contextFamilies: contexts,
      effectiveSampleSize: Math.round(effectiveSampleSize * 10) / 10,
      delayedAttempts,
      transferAttempts,
      score,
      averageEvLossBB: losses.length ? losses.reduce((sum, value) => sum + value, 0) / losses.length : 0,
      status,
      sampleConfidence,
    };
  }).sort((a, b) => b.averageEvLossBB - a.averageEvLossBB || a.score - b.score || b.effectiveSampleSize - a.effectiveSampleSize);
}

export function topEvLeaks(history: HistoryItem[], limit = 5): SkillMastery[] {
  return calculateSkillMastery(history)
    .filter(item => item.attempts >= 2)
    .sort((a, b) => {
      const aCost = a.averageEvLossBB * Math.max(0.25, a.effectiveSampleSize / 10) * (1 - a.score / 200);
      const bCost = b.averageEvLossBB * Math.max(0.25, b.effectiveSampleSize / 10) * (1 - b.score / 200);
      return bCost - aCost;
    })
    .slice(0, limit);
}
