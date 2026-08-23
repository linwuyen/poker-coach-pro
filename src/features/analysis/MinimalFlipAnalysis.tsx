import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, GitCompareArrows, ShieldCheck } from 'lucide-react';
import { scenarios } from '../../data';
import { exactScenarioMinimalFlip, MinimalFlipEvidence, verifiedSolverMinimalFlip } from '../../learning-engine/minimalFlip';
import { loadPokerBenchSplit } from '../../solver-data/pokerbench';
import { humanizeSolverMove } from '../training/SolverDecisionSession';
import { AnalysisContextBanner } from './AnalysisContextBanner';
import { readAnalysisContextFromHash } from './analysisContext';

export function MinimalFlipAnalysis({ onExit }: { onExit: () => void }) {
  const context = readAnalysisContextFromHash();
  const scenarioFlip = useMemo(() => {
    if (context?.source !== 'scenario' || !context.scenarioId) return undefined;
    const scenario = scenarios.find(item => item.id === context.scenarioId);
    return scenario ? exactScenarioMinimalFlip(scenario, context.stepId) : undefined;
  }, [context]);
  const [solverFlip, setSolverFlip] = useState<MinimalFlipEvidence>();
  const [solverDone, setSolverDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (context?.source !== 'pokerbench' || !context.datasetRowId) { setSolverDone(true); return; }
    setSolverDone(false);
    Promise.all([loadPokerBenchSplit('preflop'), loadPokerBenchSplit('postflop')]).then(([preflop, postflop]) => {
      if (cancelled) return;
      const rows = [...preflop, ...postflop];
      const row = rows.find(item => item.id === context.datasetRowId);
      setSolverFlip(row ? verifiedSolverMinimalFlip(row, rows) : undefined);
      setSolverDone(true);
    }).catch(() => { if (!cancelled) setSolverDone(true); });
    return () => { cancelled = true; };
  }, [context?.source, context?.datasetRowId]);

  const flip = scenarioFlip || solverFlip;
  const action = (value: string) => context?.source === 'pokerbench' ? humanizeSolverMove(value) : value;

  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-5xl">
      <button type="button" onClick={onExit} className="flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
      <div className="mt-5"><AnalysisContextBanner context={context} /></div>
      <section className="mt-5 rounded-3xl border border-fuchsia-500/20 bg-[linear-gradient(135deg,rgba(217,70,239,0.12),rgba(15,23,42,0.78))] p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300"><GitCompareArrows className="h-4 w-4" />Minimal Flip Engine</div>
        <h1 className="mt-3 text-3xl font-bold">不要只背答案：找出最小的答案翻轉條件</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">只接受兩種證據：題目本身的 exact-math reversal，或 PokerBench 中只改一個 semantic dimension 且 optimal label 真正翻轉的 verified pair。找不到就顯示 Unknown。</p>
      </section>

      {!context && <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/55 p-6 text-sm text-slate-400">沒有上一題 context；請從答題後的「最小翻轉」入口開啟。</section>}
      {context && !flip && !(context.source === 'pokerbench' && !solverDone) && <section data-testid="minimal-flip-unknown" className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/55 p-6"><div className="font-semibold">Unknown</div><p className="mt-2 text-sm leading-6 text-slate-500">目前沒有足夠的 exact reversal 或 verified one-variable solver sibling。系統不會用相似牌面猜一個翻轉點。</p></section>}
      {context?.source === 'pokerbench' && !solverDone && <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/55 p-6 text-sm text-slate-400">正在搜尋 verified semantic sibling…</section>}
      {flip && <section data-testid="minimal-flip-result" className="mt-5 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-fuchsia-200"><ShieldCheck className="h-4 w-4" />{flip.source === 'exact-math' ? 'Exact Math' : 'Verified Solver Pair'}</div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Metric label="目前最佳解" value={action(flip.fromAction)} />
          <Metric label="控制變數" value={flip.dimension} />
          <Metric label="翻轉後最佳解" value={action(flip.toAction)} />
        </div>
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4"><div className="text-xs text-slate-500">最小翻轉證據</div><p className="mt-2 text-sm leading-7 text-slate-200">{flip.change}</p></div>
        <div className="mt-3 text-[11px] leading-5 text-slate-500">Provenance：{flip.provenance}</div>
      </section>}
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-semibold text-slate-100">{value}</div></div>;
}
