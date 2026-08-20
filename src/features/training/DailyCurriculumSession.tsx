import { useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { HistoryItem, PlayerProfile, Scenario } from '../../types';
import { buildDailyTrainingPlan, getDueScenarioIds } from './sessionPlanner';
import { TrainingSession } from './TrainingSession';
import { SemanticCounterfactualSession } from './SemanticCounterfactualTrainer';
import { SolverDecisionSession } from './SolverDecisionSession';
import { dailyCurriculumQuota, rebalanceDailyCurriculumQuota, selectDailyGeneralizationRows, selectDailySemanticPairs } from '../../learning-engine/dailySolverPlan';
import { SemanticDecisionPair } from '../../learning-engine/semanticPairs';
import { loadPokerBenchSplit, PokerBenchRow } from '../../solver-data/pokerbench';

export function DailyCurriculumSession({ scenarios, history, profile, onRecord, onExit, onComplete }: {
  scenarios: Scenario[];
  history: HistoryItem[];
  profile: PlayerProfile;
  onRecord: (item: HistoryItem) => void;
  onExit: () => void;
  onComplete: () => void;
}) {
  const baseQuota = useMemo(() => dailyCurriculumQuota(profile.dailyQuestions), [profile.dailyQuestions]);
  const dueCount = useMemo(() => getDueScenarioIds(history).length, [history]);
  const quota = useMemo(() => rebalanceDailyCurriculumQuota(baseQuota, dueCount), [baseQuota, dueCount]);
  const [rows, setRows] = useState<PokerBenchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [solverError, setSolverError] = useState('');
  const [phase, setPhase] = useState<'curated' | 'semantic' | 'solver'>('curated');
  const [pairs, setPairs] = useState<SemanticDecisionPair[]>([]);
  const [generalizationRows, setGeneralizationRows] = useState<PokerBenchRow[]>([]);
  const [generalizationTarget, setGeneralizationTarget] = useState(quota.generalization);

  useEffect(() => {
    let alive = true;
    setLoading(true); setSolverError('');
    Promise.all([loadPokerBenchSplit('preflop'), loadPokerBenchSplit('postflop')])
      .then(([preflop, postflop]) => { if (alive) setRows([...preflop, ...postflop]); })
      .catch(reason => { if (alive) setSolverError(reason instanceof Error ? reason.message : 'PokerBench 載入失敗'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const curatedSize = solverError ? profile.dailyQuestions : quota.curated;
  const curatedPlan = useMemo(() => buildDailyTrainingPlan(scenarios, history, curatedSize, Date.now(), profile), [curatedSize, history, profile, scenarios]);

  const afterCurated = () => {
    if (!rows.length) { onComplete(); return; }
    const selectedPairs = selectDailySemanticPairs(rows, history, quota.semanticPairs, profile);
    const missingSemanticDecisions = Math.max(0, quota.semanticDecisions - selectedPairs.length * 2);
    setPairs(selectedPairs);
    setGeneralizationTarget(quota.generalization + missingSemanticDecisions);
    if (selectedPairs.length) {
      setPhase('semantic');
      return;
    }
    startSolver([], quota.generalization + missingSemanticDecisions);
  };

  const startSolver = (completedPairs: SemanticDecisionPair[], target = generalizationTarget) => {
    const excluded = new Set(completedPairs.flatMap(pair => [pair.left.id, pair.right.id]));
    const selected = selectDailyGeneralizationRows(rows, history, target, profile, { excludeIds: excluded });
    setGeneralizationRows(selected);
    if (!selected.length) { onComplete(); return; }
    setPhase('solver');
  };

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-slate-300"><div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5"><Loader2 className="h-5 w-5 animate-spin" />載入今日 verified-solver curriculum…</div></div>;

  if (solverError && phase === 'curated') return <div className="space-y-4"><div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/7 p-4 text-sm leading-6 text-amber-100"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><b>Solver corpus 暫時不可用，今日自動降級成完整 curated plan。</b><div className="mt-1 text-amber-200/70">{solverError}。不會用 heuristic 題冒充 solver-backed transfer。</div></div></div><TrainingSession title="今日自動教練 · Curated fallback" scenarios={curatedPlan.items.map(item => item.scenario)} history={history} onRecord={onRecord} onExit={onExit} onComplete={onComplete} /></div>;

  if (phase === 'semantic') return <SemanticCounterfactualSession pairs={pairs} history={history} onRecord={onRecord} onExit={onExit} onComplete={() => startSolver(pairs)} title="今日訓練 · Solver 語義反事實" />;
  if (phase === 'solver') return <SolverDecisionSession rows={generalizationRows} history={history} onRecord={onRecord} onExit={onExit} onComplete={onComplete} title="今日訓練 · Unseen Solver 泛化" />;

  return <div className="space-y-4"><div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-4 py-3 text-xs leading-5 text-slate-400"><span className="font-semibold text-cyan-200">今日 {quota.total} 決策：</span> curated / due {quota.curated} + semantic counterfactual {quota.semanticDecisions} + unseen solver {quota.generalization}。到期複習先吃 quota；Sibling / Holdout 永不進 Daily。</div><TrainingSession title="今日訓練 · Curated 修復" scenarios={curatedPlan.items.map(item => item.scenario)} history={history} onRecord={onRecord} onExit={onExit} onComplete={afterCurated} /></div>;
}
