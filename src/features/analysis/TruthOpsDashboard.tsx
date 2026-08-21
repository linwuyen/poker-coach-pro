import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpenCheck, Database, FileUp, ShieldCheck } from 'lucide-react';
import {
  STRATEGY_PROFILES_V2,
  PopulationCohort,
  StrategyProfile,
  buildTruthCoverageReport,
  importPopulationRegistry,
  mergeImmutableProfiles,
  populationRegistryReport,
} from '../../strategy-engine-v2';
import {
  ReviewedStrategyExplanation,
  importExplanationRegistry,
} from '../../teaching/explanationRegistry';

const CUSTOM_PROFILES_KEY = 'poker_strategy_profiles_v2';
const POPULATION_COHORTS_KEY = 'poker_population_cohorts_v1';
const EXPLANATIONS_KEY = 'poker_reviewed_explanations_v1';

function loadArray<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function TruthOpsDashboard({ onExit }: { onExit: () => void }) {
  const [customProfiles] = useState<StrategyProfile[]>(() => loadArray(CUSTOM_PROFILES_KEY));
  const [cohorts, setCohorts] = useState<PopulationCohort[]>(() => loadArray(POPULATION_COHORTS_KEY));
  const [explanations, setExplanations] = useState<ReviewedStrategyExplanation[]>(() => loadArray(EXPLANATIONS_KEY));
  const [populationMessage, setPopulationMessage] = useState('');
  const [explanationMessage, setExplanationMessage] = useState('');
  const cohortFile = useRef<HTMLInputElement>(null);
  const explanationFile = useRef<HTMLInputElement>(null);
  const profiles = useMemo(() => mergeImmutableProfiles(STRATEGY_PROFILES_V2, customProfiles), [customProfiles]);
  const coverage = useMemo(() => buildTruthCoverageReport(profiles), [profiles]);
  const population = useMemo(() => cohorts.length ? populationRegistryReport(cohorts) : null, [cohorts]);

  const loadPopulation = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = importPopulationRegistry(await file.text(), cohorts);
      const next = [...cohorts, ...imported.cohorts];
      localStorage.setItem(POPULATION_COHORTS_KEY, JSON.stringify(next));
      setCohorts(next);
      setPopulationMessage(`新增 ${imported.cohorts.length} cohort${imported.warnings.length ? ` · ${imported.warnings.join(' ')}` : ''}`);
    } catch (error) { setPopulationMessage(error instanceof Error ? error.message : 'Population cohort 匯入失敗'); }
    finally { event.currentTarget.value = ''; }
  };

  const loadExplanations = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = importExplanationRegistry(await file.text(), explanations);
      const next = [...explanations, ...imported.explanations];
      localStorage.setItem(EXPLANATIONS_KEY, JSON.stringify(next));
      setExplanations(next);
      setExplanationMessage(`新增 ${imported.explanations.length} reviewed explanations${imported.warnings.length ? ` · ${imported.warnings.join(' ')}` : ''}`);
    } catch (error) { setExplanationMessage(error instanceof Error ? error.message : 'Reviewed explanation 匯入失敗'); }
    finally { event.currentTarget.value = ''; }
  };

  return <div data-testid="truth-ops" className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-6xl">
      <button type="button" onClick={onExit} className="pc-interactive flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
      <section className="pc-hero-glow mt-6 rounded-3xl border border-blue-500/20 bg-[linear-gradient(135deg,rgba(59,130,246,0.12),rgba(15,23,42,0.82))] p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300"><ShieldCheck className="h-4 w-4" />P9 · Truth Operations</div>
        <h1 className="mt-3 text-3xl font-bold">知道「哪裡真的有 truth」，也知道哪裡仍然 Unknown</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">Solver coverage、population cohort 與 reviewed teaching explanation 分開管理。缺一層就顯示缺一層，不因為 UI 想顯示答案就提升 trust tier。</p>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Verified solver profiles" value={String(coverage.verifiedSolverProfiles)} />
        <Metric label="Verified contexts" value={String(coverage.contexts)} />
        <Metric label="Frequency hand rows" value={String(coverage.frequencyHands)} />
        <Metric label="Full per-action EV rows" value={String(coverage.fullEvHands)} />
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
        <div className="flex items-center gap-2 font-semibold"><Database className="h-4 w-4 text-blue-300" />Solver Truth Coverage</div>
        <p className="mt-2 text-xs leading-6 text-slate-500">只有 `verified-solver` 計入 coverage。Heuristic/expert/population profile 即使有漂亮數字也不會灌進 solver truth coverage。</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-slate-500"><tr><th className="pb-2">Profile</th><th>Verified</th><th>Freq</th><th>Mixed</th><th>EV</th><th>Full EV</th><th>Context</th></tr></thead><tbody className="divide-y divide-slate-800">{coverage.rows.map(row => <tr key={row.profileKey}><td className="py-3 font-mono">{row.profileKey}</td><td>{row.verified ? 'yes' : 'no'}</td><td>{row.frequencyHands}</td><td>{row.mixedHands}</td><td>{row.evHands}</td><td>{row.fullEvHands}</td><td className="max-w-xs truncate font-mono text-slate-500">{row.contextKey}</td></tr>)}</tbody></table></div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center justify-between gap-3"><div><div className="font-semibold">Population cohort registry</div><p className="mt-1 text-xs text-slate-500">site / stake / time window / sample / raw numerator-denominator</p></div><button type="button" onClick={() => cohortFile.current?.click()} className="flex items-center gap-2 rounded-xl border border-emerald-500/25 px-3 py-2 text-xs text-emerald-200"><FileUp className="h-4 w-4" />匯入 JSON</button><input ref={cohortFile} className="hidden" type="file" accept="application/json,.json" onChange={loadPopulation} /></div>
          <div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Cohorts" value={String(population?.cohorts || 0)} /><Metric label="Total sample" value={String(population?.totalSampleSize || 0)} /><Metric label="Measured metrics" value={String(population?.metricRows || 0)} /><Metric label="Linked exploit profiles" value={String(population?.linkedExploitProfiles || 0)} /></div>
          {populationMessage && <p data-testid="population-import-message" className="mt-3 text-xs text-emerald-200">{populationMessage}</p>}
        </div>
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
          <div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 font-semibold"><BookOpenCheck className="h-4 w-4" />Reviewed explanation registry</div><p className="mt-1 text-xs text-slate-500">Human interpretation ≠ raw solver output</p></div><button type="button" onClick={() => explanationFile.current?.click()} className="flex items-center gap-2 rounded-xl border border-violet-500/25 px-3 py-2 text-xs text-violet-200"><FileUp className="h-4 w-4" />匯入 JSON</button><input ref={explanationFile} className="hidden" type="file" accept="application/json,.json" onChange={loadExplanations} /></div>
          <div className="mt-4"><Metric label="Reviewed explanations" value={String(explanations.length)} /></div>
          <div className="mt-3 space-y-2">{explanations.slice(-5).reverse().map(item => <div key={`${item.id}@${item.version}`} className="rounded-xl border border-slate-800 bg-slate-950/35 p-3"><div className="text-sm font-semibold">{item.title}</div><div className="mt-1 text-[11px] text-slate-500">{item.id}@{item.version} · reviewed {item.reviewedBy.join(', ')}</div></div>)}</div>
          {explanationMessage && <p data-testid="explanation-import-message" className="mt-3 text-xs text-violet-200">{explanationMessage}</p>}
        </div>
      </section>
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-[11px] text-slate-500">{label}</div><div className="mt-2 break-all font-mono text-lg font-bold">{value}</div></div>;
}
