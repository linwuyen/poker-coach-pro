import { useEffect, useMemo, useRef, useState } from 'react';
import { Database, Infinity as InfinityIcon, ShieldCheck, Target } from 'lucide-react';
import { HistoryItem, Scenario } from '../../types';
import { coreScenarios } from '../../teaching/scenarioCatalog';
import { candidateLearningSignal } from '../../learning-engine/closedLoop';
import { inferScenarioStepSkillIds } from '../../learning-engine/skillGraph';
import { buildGeneratedVariantPool } from '../../learning-engine/variantGenerator';
import {
  buildInfiniteCandidatePool,
  InfiniteHandCandidate,
  selectNextInfiniteCandidate,
  summarizeInfinitePool,
} from '../../learning-engine/infiniteHandGenerator';
import { selectTargetedReviewCandidates, targetedReviewReason } from '../../learning-engine/targetedReview';
import { appendReliabilityEvent } from '../../observability/reliability';
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
  const [targetedQueue, setTargetedQueue] = useState<InfiniteHandCandidate[]>([]);
  const [targetedActive, setTargetedActive] = useState(false);
  const [targetedReason, setTargetedReason] = useState('');
  const candidateStartedAt = useRef(Date.now());
  const lastAttempt = useRef<HistoryItem | null>(null);

  const pool = useMemo(
    () => buildInfiniteCandidatePool(scenarioBank, safeVariants, pokerBenchRows),
    [scenarioBank, safeVariants, pokerBenchRows],
  );
  const summary = useMemo(
    () => summarizeInfinitePool(scenarioBank, safeVariants, pokerBenchRows, pool),
    [scenarioBank, safeVariants, pokerBenchRows, pool],
  );
  const learningSignal = useMemo(() => candidate ? candidateLearningSignal(candidate, history) : undefined, [candidate, history]);

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();
    Promise.all([loadPokerBenchSplit('preflop'), loadPokerBenchSplit('postflop')])
      .then(([preflop, postflop]) => {
        if (cancelled) return;
        setPokerBenchRows([...preflop, ...postflop]);
        setPokerBenchState('ready');
        appendReliabilityEvent(localStorage, { schemaVersion: 1, timestamp: Date.now(), operation: 'pokerbench-load', outcome: 'success', durationMs: performance.now() - started, dimension: 'preflop-postflop', value: preflop.length + postflop.length });
      })
      .catch(() => {
        if (cancelled) return;
        setPokerBenchState('offline');
        appendReliabilityEvent(localStorage, { schemaVersion: 1, timestamp: Date.now(), operation: 'pokerbench-load', outcome: 'error', reasonCode: 'load-failed', durationMs: performance.now() - started });
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    appendReliabilityEvent(localStorage, { schemaVersion: 1, timestamp: Date.now(), operation: 'generator-pool', outcome: pool.length ? 'success' : 'unknown', reasonCode: pool.length ? undefined : 'truth-gate-empty', dimension: pokerBenchState, value: pool.length });
  }, [pool.length, pokerBenchState]);

  useEffect(() => {
    if (!candidate) return;
    candidateStartedAt.current = Date.now();
    lastAttempt.current = null;
  }, [candidate?.id]);

  function choose(ids: string[], families: string[]) {
    const started = performance.now();
    const next = selectNextInfiniteCandidate(pool, history, ids, families);
    appendReliabilityEvent(localStorage, { schemaVersion: 1, timestamp: Date.now(), operation: 'candidate-select', outcome: next ? 'success' : 'unknown', reasonCode: next ? undefined : 'empty-pool', durationMs: performance.now() - started, dimension: next ? `${next.street.toLowerCase()}:${next.actionClass}` : 'none' });
    return next;
  }

  useEffect(() => {
    if (candidate || !pool.length) return;
    setCandidate(choose(recentCandidateIds, recentFamilyIds));
  }, [candidate, pool, history, recentCandidateIds, recentFamilyIds]);

  function record(item: HistoryItem) {
    const signal = candidate ? candidateLearningSignal(candidate, history) : undefined;
    let annotated: HistoryItem = {
      ...item,
      predictedSuccessProbability: item.predictedSuccessProbability ?? signal?.predictedSuccessProbability,
      learningPriorityScore: item.learningPriorityScore ?? signal?.priorityScore,
    };
    if (candidate?.kind === 'scenario' && item.stepId) {
      const step = candidate.scenario.steps.find(candidateStep => candidateStep.id === item.stepId);
      if (step) annotated = { ...annotated, skillIds: inferScenarioStepSkillIds(candidate.scenario, step) };
    }
    lastAttempt.current = annotated;
    onRecord(annotated);
    const needsRepair = annotated.correct === false || annotated.reasoningProbeResult === 'fail';
    if (!needsRepair || !candidate) return;
    const repair = selectTargetedReviewCandidates(pool, candidate, [...recentCandidateIds, candidate.id], 3);
    setTargetedQueue(repair);
    const repairReason = annotated.reasoningProbeResult === 'fail' ? 'fragile-reasoning-review' : 'targeted-review';
    appendReliabilityEvent(localStorage, { schemaVersion: 1, timestamp: Date.now(), operation: 'candidate-select', outcome: repair.length ? 'success' : 'unknown', reasonCode: repair.length ? repairReason : 'no-structural-siblings', dimension: `${candidate.street.toLowerCase()}:${candidate.actionClass}`, value: repair.length });
  }

  function finalizeTrainingDwell() {
    if (!lastAttempt.current?.attemptId) return;
    const finalized: HistoryItem = {
      ...lastAttempt.current,
      trainingDwellMs: Math.max(0, Date.now() - candidateStartedAt.current),
    };
    lastAttempt.current = finalized;
    // Bypass `record`: this is an upsert of timing evidence, not a new learning event,
    // so it must not enqueue a second targeted-repair burst.
    onRecord(finalized);
  }

  function advance() {
    if (!candidate) return;
    finalizeTrainingDwell();
    const nextIds = [...recentCandidateIds, candidate.id].slice(-64);
    const nextFamilies = [...recentFamilyIds, candidate.familyId].slice(-12);
    setRecentCandidateIds(nextIds);
    setRecentFamilyIds(nextFamilies);
    if (targetedQueue.length) {
      const [next, ...rest] = targetedQueue;
      setTargetedQueue(rest);
      setTargetedActive(true);
      setTargetedReason(targetedReviewReason(next, candidate));
      setCandidate(next);
      return;
    }
    setTargetedActive(false);
    setTargetedReason('');
    setCandidate(choose(nextIds, nextFamilies));
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
        <span data-testid="infinite-dimensions" className="font-mono text-[11px] text-slate-500">{candidate.street} · {candidate.position || '?'} · {candidate.actionClass} · {candidate.stackBand}</span>
        {learningSignal && <span data-testid="active-learning-signal" className="rounded-full border border-cyan-500/20 bg-cyan-500/8 px-2.5 py-1 text-cyan-200">Learning priority {Math.round(learningSignal.priorityScore * 100)}% · uncertainty {Math.round(learningSignal.uncertainty * 100)}%</span>}
        {(targetedActive || targetedQueue.length > 0) && <span data-testid="targeted-review-status" className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/8 px-2.5 py-1 text-amber-200"><Target className="h-3.5 w-3.5" />針對複習 · 尚有 {targetedQueue.length + (targetedActive ? 1 : 0)} 題{targetedReason ? ` · ${targetedReason}` : ''}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-500">
        <span>{summary.usable.toLocaleString()} usable</span>
        <span>P/F/T/R {summary.byStreet.Preflop}/{summary.byStreet.Flop}/{summary.byStreet.Turn}/{summary.byStreet.River}</span>
        <span>{summary.distinctPositions} positions</span>
        <span>{summary.deduplicated} deduped</span>
        <span className="flex items-center gap-1"><Database className="h-3.5 w-3.5" />PB {pokerBenchState === 'ready' ? summary.bySource.pokerbench.toLocaleString() : pokerBenchState}</span>
      </div>
    </section>

    {candidate.kind === 'scenario'
      ? <TrainingSession
          key={candidate.id}
          title={targetedActive ? '針對複習 · 自動最佳解訓練' : '無限牌局 · 自動最佳解訓練'}
          scenarios={[candidate.scenario]}
          history={history}
          autoComplete
          onRecord={record}
          onExit={onExit}
          onComplete={advance}
        />
      : <SolverDecisionSession
          key={candidate.id}
          title={targetedActive ? '針對複習 · Solver 最佳解' : '無限牌局 · Solver 最佳解'}
          rows={[candidate.row]}
          history={history}
          autoComplete
          onRecord={record}
          onExit={onExit}
          onComplete={advance}
        />}
  </div>;
}
