import { useEffect, useMemo, useRef, useState } from 'react';
import { Database, Infinity as InfinityIcon, ShieldCheck, Target } from 'lucide-react';
import { HistoryItem, PlayerProfile, Scenario } from '../../types';
import { DEFAULT_PLAYER_PROFILE } from '../../domain/playerProfile';
import { TrainingTrack, pokerBenchMatchesTrainingTrack, scenarioMatchesTrainingTrack, trainingTrackLabel } from '../../domain/trainingTrack';
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

type AttemptLearningAnnotation = Pick<HistoryItem, 'predictedSuccessProbability' | 'learningPriorityScore'>;

export function InfiniteTrainingTable({ scenarioBank, history, onRecord, onExit, track = 'cash', profile = DEFAULT_PLAYER_PROFILE }: {
  scenarioBank: Scenario[];
  history: HistoryItem[];
  onRecord: (item: HistoryItem) => void;
  onExit: () => void;
  track?: TrainingTrack;
  profile?: PlayerProfile;
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
  const attemptLearningAnnotations = useRef(new Map<string, AttemptLearningAnnotation>());

  const [presentation, setPresentation] = useState(0);

  const pool = useMemo(
    () => buildInfiniteCandidatePool(scenarioBank, safeVariants, pokerBenchRows, history).filter(item => item.kind === 'scenario'
      ? scenarioMatchesTrainingTrack(item.scenario, track, profile)
      : pokerBenchMatchesTrainingTrack(item.row, track, profile)),
    [scenarioBank, safeVariants, pokerBenchRows, history, track, profile],
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
    const priorPersisted = item.attemptId ? history.find(existing => existing.attemptId === item.attemptId) : undefined;
    const cachedAnnotation = item.attemptId ? attemptLearningAnnotations.current.get(item.attemptId) : undefined;
    const signal = candidate ? candidateLearningSignal(candidate, history) : undefined;
    const stableAnnotation: AttemptLearningAnnotation = {
      predictedSuccessProbability: item.predictedSuccessProbability
        ?? cachedAnnotation?.predictedSuccessProbability
        ?? priorPersisted?.predictedSuccessProbability
        ?? signal?.predictedSuccessProbability,
      learningPriorityScore: item.learningPriorityScore
        ?? cachedAnnotation?.learningPriorityScore
        ?? priorPersisted?.learningPriorityScore
        ?? signal?.priorityScore,
    };
    if (item.attemptId) {
      attemptLearningAnnotations.current.set(item.attemptId, stableAnnotation);
      if (attemptLearningAnnotations.current.size > 256) {
        const oldestAttemptId = attemptLearningAnnotations.current.keys().next().value as string | undefined;
        if (oldestAttemptId) attemptLearningAnnotations.current.delete(oldestAttemptId);
      }
    }
    let annotated: HistoryItem = {
      ...item,
      ...stableAnnotation,
    };
    if (candidate?.kind === 'scenario' && item.stepId) {
      const step = candidate.scenario.steps.find(candidateStep => candidateStep.id === item.stepId);
      if (step) annotated = { ...annotated, skillIds: inferScenarioStepSkillIds(candidate.scenario, step) };
    }
    // TrainingSession and SolverDecisionSession both measure submit latency and complete
    // dwell from the same question-activation clock. Once explicit Next supplies dwell,
    // these two persisted endpoints are therefore exactly reconstructible rather than
    // approximated from the later record callback wall clock.
    if (typeof annotated.trainingDwellMs === 'number' && typeof annotated.durationMs === 'number') {
      const trainingDwellStartedAt = annotated.trainingDwellStartedAt
        ?? annotated.timestamp - Math.max(0, annotated.durationMs);
      const trainingDwellCompletedAt = annotated.trainingDwellCompletedAt
        ?? trainingDwellStartedAt + Math.max(0, annotated.trainingDwellMs);
      annotated = { ...annotated, trainingDwellStartedAt, trainingDwellCompletedAt };
    }
    onRecord(annotated);

    // Timing/reasoning upserts reuse the annotation cached on the first answer callback.
    // Never recompute prediction from history after the observed outcome is already known.
    if (typeof annotated.trainingDwellMs === 'number') return;

    const needsRepair = annotated.correct === false || annotated.reasoningProbeResult === 'fail';
    if (!needsRepair || !candidate) return;
    const repair = selectTargetedReviewCandidates(pool, candidate, [...recentCandidateIds, candidate.id], 3);
    setTargetedQueue(repair);
    const repairReason = annotated.reasoningProbeResult === 'fail' ? 'fragile-reasoning-review' : 'targeted-review';
    appendReliabilityEvent(localStorage, { schemaVersion: 1, timestamp: Date.now(), operation: 'candidate-select', outcome: repair.length ? 'success' : 'unknown', reasonCode: repair.length ? repairReason : 'no-structural-siblings', dimension: `${candidate.street.toLowerCase()}:${candidate.actionClass}`, value: repair.length });
  }

  function advance() {
    if (!candidate) return;
    const nextIds = [...recentCandidateIds, candidate.id].slice(-64);
    const nextFamilies = [...recentFamilyIds, candidate.familyId].slice(-12);
    setPresentation(value => value + 1);
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
    if (pool.length || (track === 'cash' && pokerBenchState === 'loading')) return <div className="grid min-h-[60vh] place-items-center text-sm text-slate-500">正在建立符合偏好的牌局池…<button type="button" onClick={onExit} className="rounded-xl border border-slate-700 px-4 py-2">離開</button></div>;
    return <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-amber-500/25 bg-slate-900 p-6 text-sm text-slate-300" data-testid="training-track-empty"><h2 className="text-xl font-semibold">目前沒有符合 {trainingTrackLabel(track)} 偏好的題目</h2><p>請返回設定，調整桌型、籌碼深度或學習重點。系統不會混入其他賽制；缺少桌型或籌碼資訊的題目也不會通過偏好篩選。</p><button onClick={onExit} className="rounded-xl border border-slate-700 px-4 py-2">返回並調整偏好</button></div>;
  }

  const sourceLabel = candidate.source === 'pokerbench'
    ? 'PokerBench solver'
    : candidate.source === 'safe-variant'
      ? '策略等價變式'
      : '驗證題庫';

  return <div data-testid="infinite-training-table" className="space-y-3">
    <section className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 text-xs text-slate-400">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 font-semibold text-emerald-300"><InfinityIcon className="h-4 w-4" />{trainingTrackLabel(track)}</span>
        <span data-testid="infinite-source" className="rounded-full border border-slate-700 bg-slate-950/45 px-2.5 py-1">{sourceLabel}</span>
        <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />{candidate.truthLabel}</span>
        <span data-testid="infinite-dimensions" className="font-mono text-[11px] text-slate-500">{candidate.street} · {candidate.position || '?'} · {candidate.stackBand}</span>
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
    {candidate.kind === 'solver' && <p className="mx-auto max-w-5xl px-2 text-xs leading-5 text-slate-400">PokerBench：6-Max、起始 100BB 現金桌基準。此筆資料未提供抽水與當前剩餘有效籌碼；僅核對資料集動作標籤，不代表你的牌局設定下的完整 solver 解。</p>}

    {candidate.kind === 'scenario'
      ? <TrainingSession
          key={`${candidate.id}:${presentation}`}
          title={targetedActive ? '針對複習 · 自動決策訓練' : '無限牌局 · 自動決策訓練'}
          scenarios={[candidate.scenario]}
          history={history}
          autoComplete
          onRecord={record}
          onExit={onExit}
          onComplete={advance}
        />
      : <SolverDecisionSession
          key={`${candidate.id}:${presentation}`}
          title={targetedActive ? '針對複習 · 資料集動作練習' : '無限牌局 · 資料集動作練習'}
          rows={[candidate.row]}
          reviewOnly={candidate.reviewOnly}
          history={history}
          autoComplete
          onRecord={record}
          onExit={onExit}
          onComplete={advance}
        />}
  </div>;
}
