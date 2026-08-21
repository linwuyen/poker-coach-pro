import { useEffect, useMemo, useState } from 'react';
import { Database, Infinity as InfinityIcon, ShieldCheck } from 'lucide-react';
import { HistoryItem, Scenario } from '../../types';
import { coreScenarios } from '../../teaching/scenarioCatalog';
import { buildGeneratedVariantPool } from '../../learning-engine/variantGenerator';
import {
  buildInfiniteCandidatePool,
  InfiniteHandCandidate,
  selectNextInfiniteCandidate,
  summarizeInfinitePool,
} from '../../learning-engine/infiniteHandGenerator';
import { loadPokerBenchSplit, PokerBenchRow } from '../../solver-data/pokerbench';
import { TrainingSession } from './TrainingSession';
import { SolverDecisionSession } from './SolverDecisionSession';

export function InfiniteTrainingTable({ scenarioBank, history, onRecord, onExit }: {
  scenarioBank: Scenario[];
  history: HistoryItem[];
  onRecord: (item: HistoryItem) => void;
  onExit: () => void;
}) {
  const safeVariants = useMemo(() => buildGeneratedVariantPool(coreScenarios, 6), []);
  const [pokerBenchRows, setPokerBenchRows] = useState<PokerBenchRow[]>([]);
  const [pokerBenchState, setPokerBenchState] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [candidate, setCandidate] = useState<InfiniteHandCandidate>();
  const [recentCandidateIds, setRecentCandidateIds] = useState<string[]>([]);
  const [recentFamilyIds, setRecentFamilyIds] = useState<string[]>([]);

  const pool = useMemo(
    () => buildInfiniteCandidatePool(scenarioBank, safeVariants, pokerBenchRows),
    [scenarioBank, safeVariants, pokerBenchRows],
  );
  const summary = useMemo(
    () => summarizeInfinitePool(scenarioBank, safeVariants, pokerBenchRows, pool),
    [scenarioBank, safeVariants, pokerBenchRows, pool],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPokerBenchSplit('preflop'), loadPokerBenchSplit('postflop')])
      .then(([preflop, postflop]) => {
        if (cancelled) return;
        setPokerBenchRows([...preflop, ...postflop]);
        setPokerBenchState('ready');
      })
      .catch(() => {
        if (!cancelled) setPokerBenchState('offline');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (candidate || !pool.length) return;
    setCandidate(selectNextInfiniteCandidate(pool, history, recentCandidateIds, recentFamilyIds));
  }, [candidate, pool, history, recentCandidateIds, recentFamilyIds]);

  function advance() {
    if (!candidate) return;
    const nextIds = [...recentCandidateIds, candidate.id].slice(-64);
    const nextFamilies = [...recentFamilyIds, candidate.familyId].slice(-12);
    setRecentCandidateIds(nextIds);
    setRecentFamilyIds(nextFamilies);
    setCandidate(selectNextInfiniteCandidate(pool, history, nextIds, nextFamilies));
  }

  if (!candidate) {
    return <div className="grid min-h-[60vh] place-items-center text-sm text-slate-500">正在建立 truth-backed 牌局池…</div>;
  }

  const sourceLabel = candidate.source === 'pokerbench'
    ? 'PokerBench solver'
    : candidate.source === 'safe-variant'
      ? '策略等價變式'
      : '驗證題庫';

  return <div data-testid="infinite-training-table" className="space-y-3">
    <section className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 text-xs text-slate-400">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 font-semibold text-emerald-300"><InfinityIcon className="h-4 w-4" />Infinite Hand Generator</span>
        <span data-testid="infinite-source" className="rounded-full border border-slate-700 bg-slate-950/45 px-2.5 py-1">{sourceLabel}</span>
        <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />{candidate.truthLabel}</span>
      </div>
      <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
        <span>{summary.usable.toLocaleString()} usable</span>
        <span>{summary.deduplicated} deduped</span>
        <span className="flex items-center gap-1"><Database className="h-3.5 w-3.5" />PB {pokerBenchState === 'ready' ? summary.bySource.pokerbench.toLocaleString() : pokerBenchState}</span>
      </div>
    </section>

    {candidate.kind === 'scenario'
      ? <TrainingSession
          key={candidate.id}
          title="無限牌局 · 自動最佳解訓練"
          scenarios={[candidate.scenario]}
          history={history}
          autoComplete
          onRecord={onRecord}
          onExit={onExit}
          onComplete={advance}
        />
      : <SolverDecisionSession
          key={candidate.id}
          title="無限牌局 · Solver 最佳解"
          rows={[candidate.row]}
          history={history}
          autoComplete
          onRecord={onRecord}
          onExit={onExit}
          onComplete={advance}
        />}
  </div>;
}
