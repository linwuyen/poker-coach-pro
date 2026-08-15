import { HistoryItem, Scenario } from '../types';
import { classifyHistoryError } from './errorModel';
import { inferScenarioSkillIds } from './skillGraph';

export type InterventionType = 'retrieval' | 'boundary' | 'range' | 'equity' | 'icm' | 'contrastive' | 'solver';

export interface TrainingIntervention {
  type: InterventionType;
  label: string;
  hash?: string;
  reason: string;
}

const INTERVENTIONS: Record<InterventionType, Omit<TrainingIntervention, 'type' | 'reason'>> = {
  retrieval: { label: '延遲提取' },
  boundary: { label: 'Boundary Drill', hash: 'boundary-map' },
  range: { label: 'Range Drill', hash: 'range-reading' },
  equity: { label: 'Equity / Pot Odds', hash: 'equity-workbench' },
  icm: { label: 'ICM / $EV', hash: 'icm-workbench' },
  contrastive: { label: 'Contrastive Drill', hash: 'contrastive-trainer' },
  solver: { label: 'Solver Curriculum', hash: 'solver-corpus' },
};

function build(type: InterventionType, reason: string): TrainingIntervention {
  return { type, ...INTERVENTIONS[type], reason };
}

export function recommendIntervention(scenario: Scenario, history: HistoryItem[], now = Date.now()): TrainingIntervention {
  const related = history.filter(item => item.scenarioId === scenario.id).sort((a, b) => b.timestamp - a.timestamp);
  const latest = related[0];
  const skills = inferScenarioSkillIds(scenario);
  const text = `${scenario.title} ${(scenario.category || []).join(' ')} ${scenario.preAction}`;

  if (latest?.nextReviewAt && latest.nextReviewAt <= now) return build('retrieval', '這個 decision 已到期，先測 retention，不先給提示。');
  if (latest) {
    const error = classifyHistoryError(latest);
    if (error === 'sizing-boundary' || error === 'action-boundary') return build('boundary', '錯誤集中在 action / sizing 反轉點，直接練 decision boundary。');
    if (error === 'mental-model' && (latest.confidence || 0) >= 3) return build('contrastive', '高信心錯誤代表 mental model 需要用近似情境對照拆掉。');
  }
  if (skills.includes('tournament.icm') || /ICM|泡沫|衛星|PKO|獎金/i.test(text)) return build('icm', '這個 spot 的核心 utility 是 tournament $EV / seat equity。');
  if (skills.some(id => id.startsWith('math.'))) return build('equity', '主要瓶頸是 odds / equity / SPR 的數學判斷。');
  if (skills.some(id => id.startsWith('range.'))) return build('range', '主要瓶頸是 range construction / blocker / combo。');
  return build('solver', '沒有更窄的錯誤診斷時，使用 solver curriculum 建立基準 policy。');
}
