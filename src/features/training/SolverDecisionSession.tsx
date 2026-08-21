import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { HistoryItem } from '../../types';
import { classifyDecisionError } from '../../learning-engine/errorModel';
import { getDifficultyWeight, isDelayedReview, makeMasteryKey } from '../../learning-engine';
import { historyDecisionFamilyId } from '../../learning-engine/contextIdentity';
import { solverDecisionFamilyId } from '../../learning-engine/semanticPairs';
import { solverCorpusRole, solverCurriculum } from '../../learning-engine/solverCurriculum';
import { fingerprintPokerBenchRow } from '../../solver-data/contextFingerprint';
import { decisionsMatch, parsePokerDecision, POKERBENCH_FILES, POKERBENCH_SOURCE, PokerBenchRow } from '../../solver-data/pokerbench';
import { createAttemptId, getReviewSchedule } from '../../utils/history';

export function SolverDecisionSession({ rows, history, onRecord, onExit, onComplete, title = '自動訓練桌', autoComplete = false }: {
  rows: PokerBenchRow[];
  history: HistoryItem[];
  onRecord: (item: HistoryItem) => void;
  onExit: () => void;
  onComplete: () => void;
  title?: string;
  autoComplete?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const startedAt = useRef(Date.now());
  const completionSent = useRef(false);
  const row = rows[index];

  useEffect(() => {
    if (row || !autoComplete || completionSent.current) return;
    completionSent.current = true;
    onComplete();
  }, [row, autoComplete, onComplete]);

  useEffect(() => {
    if (!submitted || !correct) return;
    const timer = window.setTimeout(() => next(), 650);
    return () => window.clearTimeout(timer);
  }, [submitted, correct, index]);

  if (!row) {
    if (autoComplete) return <div className="grid min-h-[45vh] place-items-center text-sm text-slate-500">正在自動切換下一批牌局…</div>;
    return <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-500/20 bg-emerald-500/6 p-8 text-center text-slate-100"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" /><h2 className="mt-4 text-2xl font-bold">這批決策完成</h2><p className="mt-2 text-sm text-slate-400">完成 {rows.length} 個可驗證策略決策。</p><div className="mt-6 flex justify-center gap-3"><button onClick={onComplete} className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-emerald-950">繼續</button><button onClick={onExit} className="rounded-xl border border-slate-700 px-5 py-3 text-slate-300">離開</button></div></div>;
  }

  function submit(move: string) {
    if (submitted) return;
    const now = Date.now();
    const family = solverDecisionFamilyId(row);
    const previous = history.filter(item => historyDecisionFamilyId(item) === family).sort((a, b) => b.timestamp - a.timestamp)[0];
    const selected = parsePokerDecision(move);
    const best = parsePokerDecision(row.correctDecision);
    const isCorrect = decisionsMatch(move, row.correctDecision);
    const fingerprint = fingerprintPokerBenchRow(row);
    const curriculum = solverCurriculum(row);
    const split = row.split;
    const item: HistoryItem = {
      schemaVersion: 6,
      attemptId: createAttemptId(),
      trainingType: 'solver-corpus',
      scenarioId: `daily-solver:${POKERBENCH_FILES[split].split}:${row.id}`,
      decisionFamilyId: family,
      stepId: 'solver-decision',
      masteryKey: makeMasteryKey(family, 'solver-decision'),
      skillIds: [split === 'preflop' ? 'preflop.solver-decision' : 'postflop.solver-decision'],
      situationIds: [`situation.position.${row.heroPosition.toLowerCase()}`, ...(split === 'postflop' ? [`situation.street.${row.evaluationAt.toLowerCase()}`] : ['situation.street.preflop'])],
      category: ['PokerBench', 'Daily Generalization', split === 'preflop' ? 'Preflop' : row.evaluationAt],
      score: isCorrect ? 10 : 0,
      judgment: isCorrect ? '正確' : '錯誤',
      timestamp: now,
      selectedAction: move,
      bestAction: row.correctDecision,
      selectedDecision: selected.action,
      bestDecision: best.action,
      street: split === 'preflop' ? 'Preflop' : row.evaluationAt,
      position: row.heroPosition,
      durationMs: now - startedAt.current,
      correct: isCorrect,
      feedbackQuality: isCorrect ? 'best' : 'major-error',
      truthTier: 'verified-solver',
      truthSourceId: POKERBENCH_SOURCE.id,
      truthSourceRef: POKERBENCH_SOURCE.dataset,
      truthSourceLicense: POKERBENCH_SOURCE.license,
      truthSourceRevision: POKERBENCH_SOURCE.revision,
      datasetSplit: POKERBENCH_FILES[split].split,
      datasetRowId: row.id,
      difficultyWeight: getDifficultyWeight(curriculum.level >= 4 ? '進階' : curriculum.level >= 2 ? '中階' : '新手'),
      isReview: Boolean(previous),
      isDelayedReview: isDelayedReview(previous, now),
      isUnseen: !previous,
      isTransferTest: true,
      transferLevel: 'structural',
      contextFingerprint: fingerprint.id,
      contextMatchStatus: 'exact',
      errorType: classifyDecisionError({ correct: isCorrect, selectedDecision: selected.action, bestDecision: best.action }),
      solverCorpusRole: solverCorpusRole(row),
      curriculumLevel: curriculum.level,
      questionLabel: `自動變化題 · ${row.holding}`,
      notes: `${POKERBENCH_SOURCE.label}. Training partition only; optimal action comes from the pinned dataset. Missing per-action EV/mixed frequency is intentionally not fabricated.`,
      ...getReviewSchedule(isCorrect ? 10 : 0, previous, undefined, now),
    };
    setChoice(move);
    setCorrect(isCorrect);
    setSubmitted(true);
    onRecord(item);
  }

  function next() {
    setIndex(value => value + 1);
    setChoice(null);
    setCorrect(false);
    setSubmitted(false);
    startedAt.current = Date.now();
  }

  const board = row.split === 'postflop' ? `${row.boardFlop}${row.boardTurn || ''}${row.boardRiver || ''}` : '';
  const progress = Math.round(index / Math.max(1, rows.length) * 100);
  return <div className="mx-auto max-w-5xl space-y-5 text-slate-100" data-testid="solver-decision-session">
    <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center gap-3"><button onClick={onExit} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-400 hover:bg-slate-800"><ArrowLeft className="h-4 w-4" />離開</button><div className="flex-1"><div className="flex justify-between text-sm"><b>{title}</b><span className="font-mono text-slate-500">{index + 1}/{rows.length}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-emerald-400" style={{ width: `${progress}%` }} /></div></div></div></div></header>
    <section className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 md:p-8"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">自動插入的陌生 spot</div><h2 className="mt-3 font-mono text-3xl font-bold">{row.holding} · {row.heroPosition}</h2><div className="mt-4 grid gap-2 text-sm text-slate-400 sm:grid-cols-3"><span>Pot {row.potSize} BB</span><span>{row.split === 'preflop' ? `Players ${row.numPlayers}` : row.evaluationAt}</span><span>{row.split === 'postflop' ? `Board ${board}` : `Bet depth ${row.numBets}`}</span></div><div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4 text-sm leading-6 text-slate-300">{row.split === 'preflop' ? row.prevLine || 'First in' : <><div>Preflop: {row.preflopAction || '-'}</div><div>Postflop: {row.postflopAction || '-'}</div></>}</div><div className="mt-5 grid gap-2 sm:grid-cols-2">{row.availableMoves.map(move => <button data-testid="solver-action" key={move} disabled={submitted} onClick={() => submit(move)} className={`rounded-xl border p-4 text-left text-sm font-semibold ${choice === move ? 'border-emerald-400/60 bg-emerald-500/12' : 'border-slate-700 bg-slate-950/35 hover:border-emerald-500/40'}`}>{move}</button>)}</div></section>
    {submitted && (correct ? <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/6 p-4"><div className="flex items-center gap-3"><CheckCircle2 className="h-6 w-6 text-emerald-400" /><div><div className="font-semibold text-emerald-100">正確 · 自動下一手</div><div className="text-xs text-slate-500">{row.correctDecision}</div></div></div></section> : <section className="rounded-2xl border border-red-500/25 bg-red-500/6 p-5"><div className="flex gap-3"><XCircle className="h-6 w-6 text-red-400" /><div><div className="font-semibold text-red-100">這手需要修正</div><div className="mt-2 text-sm">你：<b>{choice}</b></div><div className="mt-1 text-sm">最佳線：<b>{row.correctDecision}</b></div><p className="mt-3 text-xs leading-6 text-slate-400">系統已自動記錄這個錯誤，後續會增加同類與相近變化題。這份資料只提供 optimal label，沒有 per-action EV 時不會補假數字。</p><button onClick={next} className="mt-4 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-emerald-950">下一個決策</button></div></div></section>)}
  </div>;
}
