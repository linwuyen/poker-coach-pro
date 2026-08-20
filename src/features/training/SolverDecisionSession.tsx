import { useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { ConfidenceLevel, HistoryItem } from '../../types';
import { classifyDecisionError } from '../../learning-engine/errorModel';
import { getDifficultyWeight, isDelayedReview, makeMasteryKey } from '../../learning-engine';
import { historyDecisionFamilyId } from '../../learning-engine/contextIdentity';
import { solverDecisionFamilyId } from '../../learning-engine/semanticPairs';
import { solverCorpusRole, solverCurriculum } from '../../learning-engine/solverCurriculum';
import { fingerprintPokerBenchRow } from '../../solver-data/contextFingerprint';
import {
  decisionsMatch,
  parsePokerDecision,
  POKERBENCH_FILES,
  POKERBENCH_SOURCE,
  PokerBenchRow,
} from '../../solver-data/pokerbench';
import { createAttemptId, getReviewSchedule } from '../../utils/history';

const CONFIDENCE: Array<{ value: ConfidenceLevel; label: string }> = [
  { value: 1, label: '猜測' }, { value: 2, label: '不太確定' }, { value: 3, label: '大致確定' }, { value: 4, label: '非常確定' },
];

export function SolverDecisionSession({ rows, history, onRecord, onExit, onComplete, title = 'Solver 泛化驗證' }: {
  rows: PokerBenchRow[];
  history: HistoryItem[];
  onRecord: (item: HistoryItem) => void;
  onExit: () => void;
  onComplete: () => void;
  title?: string;
}) {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const startedAt = useRef(Date.now());
  const row = rows[index];

  if (!row) return <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-500/20 bg-emerald-500/6 p-8 text-center text-slate-100"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" /><h2 className="mt-4 text-2xl font-bold">Solver 泛化完成</h2><p className="mt-2 text-sm text-slate-400">完成 {rows.length} 個 training-partition solver decisions。</p><div className="mt-6 flex justify-center gap-3"><button onClick={onComplete} className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-emerald-950">完成今日訓練</button><button onClick={onExit} className="rounded-xl border border-slate-700 px-5 py-3 text-slate-300">離開</button></div></div>;

  const submit = () => {
    if (!choice || !confidence || submitted) return;
    const now = Date.now();
    const family = solverDecisionFamilyId(row);
    const previous = history.filter(item => historyDecisionFamilyId(item) === family).sort((a, b) => b.timestamp - a.timestamp)[0];
    const selected = parsePokerDecision(choice);
    const best = parsePokerDecision(row.correctDecision);
    const correct = decisionsMatch(choice, row.correctDecision);
    const fingerprint = fingerprintPokerBenchRow(row);
    const curriculum = solverCurriculum(row);
    const split = row.split;
    const item: HistoryItem = {
      schemaVersion: 5,
      attemptId: createAttemptId(),
      trainingType: 'solver-corpus',
      scenarioId: `daily-solver:${POKERBENCH_FILES[split].split}:${row.id}`,
      decisionFamilyId: family,
      stepId: 'solver-decision',
      masteryKey: makeMasteryKey(family, 'solver-decision'),
      skillIds: [split === 'preflop' ? 'preflop.solver-decision' : 'postflop.solver-decision'],
      situationIds: [`situation.position.${row.heroPosition.toLowerCase()}`, ...(split === 'postflop' ? [`situation.street.${row.evaluationAt.toLowerCase()}`] : ['situation.street.preflop'])],
      category: ['PokerBench', 'Daily Generalization', split === 'preflop' ? 'Preflop' : row.evaluationAt],
      score: correct ? 10 : 0,
      judgment: correct ? '正確' : '錯誤',
      timestamp: now,
      selectedAction: choice,
      bestAction: row.correctDecision,
      selectedDecision: selected.action,
      bestDecision: best.action,
      street: split === 'preflop' ? 'Preflop' : row.evaluationAt,
      position: row.heroPosition,
      durationMs: now - startedAt.current,
      confidence,
      correct,
      feedbackQuality: correct ? 'best' : 'major-error',
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
      errorType: classifyDecisionError({ correct, confidence, selectedDecision: selected.action, bestDecision: best.action }),
      solverCorpusRole: solverCorpusRole(row),
      curriculumLevel: curriculum.level,
      questionLabel: `Daily Solver · ${row.holding}`,
      notes: `${POKERBENCH_SOURCE.label}. Training partition only; optimal action comes from the pinned dataset. Missing per-action EV/mixed frequency is intentionally not fabricated.`,
      ...getReviewSchedule(correct ? 10 : 0, confidence, previous, now),
    };
    onRecord(item);
    setSubmitted(true);
  };

  const next = () => {
    setIndex(value => value + 1);
    setChoice(null); setConfidence(null); setSubmitted(false); startedAt.current = Date.now();
  };

  const board = row.split === 'postflop' ? `${row.boardFlop}${row.boardTurn || ''}${row.boardRiver || ''}` : '';
  return <div className="mx-auto max-w-5xl space-y-5 text-slate-100"><header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center gap-3"><button onClick={onExit} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-400 hover:bg-slate-800"><ArrowLeft className="h-4 w-4" />離開</button><div className="flex-1"><div className="flex justify-between text-sm"><b>{title}</b><span className="font-mono text-slate-500">{index + 1}/{rows.length}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-blue-400" style={{ width: `${Math.round(index / Math.max(1, rows.length) * 100)}%` }} /></div></div></div></div></header><section className="rounded-3xl border border-blue-500/20 bg-[linear-gradient(135deg,rgba(59,130,246,0.12),rgba(15,23,42,0.82))] p-6 md:p-8"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300"><ShieldCheck className="h-4 w-4" />verified-solver · training partition</div><h2 className="mt-3 font-mono text-3xl font-bold">{row.holding} · {row.heroPosition}</h2><div className="mt-4 grid gap-2 text-sm text-slate-400 sm:grid-cols-3"><span>Pot {row.potSize} BB</span><span>{row.split === 'preflop' ? `Players ${row.numPlayers}` : row.evaluationAt}</span><span>{row.split === 'postflop' ? `Board ${board}` : `Bet depth ${row.numBets}`}</span></div><div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4 text-sm leading-6 text-slate-300">{row.split === 'preflop' ? row.prevLine || 'First in' : <><div>Preflop: {row.preflopAction || '-'}</div><div>Postflop: {row.postflopAction || '-'}</div></>}</div><div className="mt-5 grid gap-2 sm:grid-cols-2">{row.availableMoves.map(move => <button key={move} disabled={submitted} onClick={() => setChoice(move)} className={`rounded-xl border p-3 text-left text-sm ${choice === move ? 'border-blue-400/60 bg-blue-500/12' : 'border-slate-700 bg-slate-950/35'}`}>{move}</button>)}</div></section>{!submitted ? <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="text-sm font-semibold">你有多確定？</div><div className="mt-3 grid gap-2 sm:grid-cols-4">{CONFIDENCE.map(item => <button key={item.value} onClick={() => setConfidence(item.value)} className={`rounded-xl border px-3 py-3 text-sm ${confidence === item.value ? 'border-amber-400/60 bg-amber-400/10 text-amber-200' : 'border-slate-700 text-slate-400'}`}>{item.label}</button>)}</div><button disabled={!choice || !confidence} onClick={submit} className="mt-4 w-full rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white disabled:opacity-40">提交</button></section> : <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/6 p-5"><div className="text-sm">你的答案：<b>{choice}</b></div><div className="mt-1 text-sm">Solver label：<b>{row.correctDecision}</b></div><p className="mt-3 text-xs leading-6 text-slate-400">PokerBench 未提供此列的 per-action EV 或 mixed frequency，因此只評 optimal decision label，不補假數字。</p><button onClick={next} className="mt-4 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-emerald-950">下一題</button></section>}</div>;
}
