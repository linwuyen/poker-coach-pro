import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, GitCompareArrows, Loader2, ShieldCheck } from 'lucide-react';
import { ConfidenceLevel, HistoryItem } from '../../types';
import { classifyDecisionError } from '../../learning-engine/errorModel';
import { getDifficultyWeight, isDelayedReview, makeMasteryKey } from '../../learning-engine';
import { historyDecisionFamilyId } from '../../learning-engine/contextIdentity';
import {
  buildSemanticDecisionPairs,
  describeSemanticChange,
  SemanticDecisionPair,
  semanticDimensionLabel,
  solverDecisionFamilyId,
} from '../../learning-engine/semanticPairs';
import { solverCorpusRole } from '../../learning-engine/solverCurriculum';
import { fingerprintPokerBenchRow } from '../../solver-data/contextFingerprint';
import {
  decisionsMatch,
  loadPokerBenchSplit,
  parsePokerDecision,
  POKERBENCH_FILES,
  POKERBENCH_SOURCE,
  PokerBenchRow,
  PokerBenchSplit,
} from '../../solver-data/pokerbench';
import { createAttemptId, getReviewSchedule, loadHistory, saveHistory } from '../../utils/history';

const CONFIDENCE: Array<{ value: ConfidenceLevel; label: string }> = [
  { value: 1, label: '猜測' }, { value: 2, label: '不太確定' }, { value: 3, label: '大致確定' }, { value: 4, label: '非常確定' },
];

type Side = 'left' | 'right';

interface PairAnswers {
  left?: { choice: string; confidence: ConfidenceLevel; durationMs: number };
  right?: { choice: string; confidence: ConfidenceLevel; durationMs: number };
}

interface SessionProps {
  pairs: SemanticDecisionPair[];
  history: HistoryItem[];
  onRecord: (item: HistoryItem) => void;
  onExit: () => void;
  onComplete: () => void;
  title?: string;
}

export function SemanticCounterfactualSession({ pairs, history, onRecord, onExit, onComplete, title = 'Solver 語義反事實' }: SessionProps) {
  const [index, setIndex] = useState(0);
  const [side, setSide] = useState<Side>('left');
  const [choice, setChoice] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [answers, setAnswers] = useState<PairAnswers>({});
  const [revealed, setRevealed] = useState(false);
  const startedAt = useRef(Date.now());
  const pair = pairs[index];
  const row = pair ? pair[side] : undefined;

  const resetDecision = () => {
    setChoice(null);
    setConfidence(null);
    startedAt.current = Date.now();
  };

  if (!pair || !row) {
    return <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-500/20 bg-emerald-500/6 p-8 text-center text-slate-100"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" /><h2 className="mt-4 text-2xl font-bold">今日語義 transfer 完成</h2><p className="mt-2 text-sm text-slate-400">你完成了 {pairs.length} 組、{pairs.length * 2} 個 solver-backed 決策。</p><div className="mt-6 flex justify-center gap-3"><button onClick={onComplete} className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-emerald-950">完成</button><button onClick={onExit} className="rounded-xl border border-slate-700 px-5 py-3 text-slate-300">離開</button></div></div>;
  }

  const lockDecision = () => {
    if (!choice || !confidence || revealed) return;
    const durationMs = Date.now() - startedAt.current;
    if (side === 'left') {
      setAnswers({ left: { choice, confidence, durationMs } });
      setSide('right');
      resetDecision();
      return;
    }

    const completed: PairAnswers = { ...answers, right: { choice, confidence, durationMs } };
    if (!completed.left || !completed.right) return;
    const now = Date.now();
    const leftItem = makeHistoryItem(pair, pair.left, completed.left, history, now, 0);
    const rightItem = makeHistoryItem(pair, pair.right, completed.right, history, now, 1);
    onRecord(leftItem);
    onRecord(rightItem);
    setAnswers(completed);
    setRevealed(true);
  };

  const next = () => {
    setIndex(value => value + 1);
    setSide('left');
    setAnswers({});
    setRevealed(false);
    resetDecision();
  };

  const progress = pairs.length ? Math.round(index / pairs.length * 100) : 0;
  return <div className="mx-auto max-w-5xl space-y-5 text-slate-100">
    <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex flex-wrap items-center gap-3"><button onClick={onExit} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-400 hover:bg-slate-800"><ArrowLeft className="h-4 w-4" />離開</button><div className="flex-1"><div className="flex justify-between text-sm"><b>{title}</b><span className="font-mono text-slate-500">PAIR {index + 1}/{pairs.length}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-cyan-400" style={{ width: `${progress}%` }} /></div></div></div></div></header>

    {!revealed ? <>
      <section className="rounded-3xl border border-cyan-500/20 bg-[linear-gradient(135deg,rgba(6,182,212,0.12),rgba(15,23,42,0.82))] p-6 md:p-8"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300"><ShieldCheck className="h-4 w-4" />verified-solver · {side === 'left' ? 'A' : 'B'}</div><h2 className="mt-3 text-2xl font-bold">{side === 'left' ? '先做原始決策' : '現在只改一個語義條件，再做一次'}</h2><p className="mt-2 text-sm leading-6 text-slate-400">答案與改變的維度在兩題都鎖定前不揭露，避免提示污染 transfer 測試。</p>{side === 'right' && <div className="mt-4 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/7 px-4 py-3 text-sm text-fuchsia-200">A 已鎖定。B 和 A 只有一個可觀測語義維度不同，而且兩列都有 PokerBench solver label。</div>}</section>
      <SolverSpot row={row} choice={choice} onChoice={setChoice} />
      <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="text-sm font-semibold">你有多確定？</div><div className="mt-3 grid gap-2 sm:grid-cols-4">{CONFIDENCE.map(item => <button key={item.value} onClick={() => setConfidence(item.value)} className={`rounded-xl border px-3 py-3 text-sm ${confidence === item.value ? 'border-amber-400/60 bg-amber-400/10 text-amber-200' : 'border-slate-700 text-slate-400'}`}>{item.label}</button>)}</div><button disabled={!choice || !confidence} onClick={lockDecision} className="mt-4 w-full rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-cyan-950 disabled:opacity-40">{side === 'left' ? '鎖定 A，不看答案 →' : '鎖定 B 並揭曉'}</button></section>
    </> : <SemanticReveal pair={pair} answers={answers} onNext={next} />}
  </div>;
}

export function SemanticCounterfactualTrainer({ onExit }: { onExit: () => void }) {
  const [split, setSplit] = useState<PokerBenchSplit>('postflop');
  const [rows, setRows] = useState<PokerBenchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    loadPokerBenchSplit(split)
      .then(result => { if (alive) setRows(result); })
      .catch(reason => { if (alive) setError(reason instanceof Error ? reason.message : 'PokerBench 載入失敗'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [split]);

  const pairs = useMemo(() => shuffle(buildSemanticDecisionPairs(rows, { role: 'training', limit: 80 })).slice(0, 20), [rows]);
  const record = (item: HistoryItem) => setHistory(previous => { const next = [...previous, item]; saveHistory(next); return next; });

  if (loading) return <FullScreenMessage><Loader2 className="h-5 w-5 animate-spin" />建立 solver-backed semantic pairs…</FullScreenMessage>;
  if (error) return <FullScreenMessage>{error}<button onClick={onExit} className="rounded-lg border border-slate-700 px-3 py-2">返回</button></FullScreenMessage>;
  return <div className="min-h-screen bg-slate-950 px-4 py-6 md:px-8"><div className="mx-auto mb-5 flex max-w-5xl gap-2"><button onClick={() => setSplit('preflop')} className={`rounded-xl border px-4 py-2 text-sm ${split === 'preflop' ? 'border-cyan-400/50 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>Preflop</button><button onClick={() => setSplit('postflop')} className={`rounded-xl border px-4 py-2 text-sm ${split === 'postflop' ? 'border-cyan-400/50 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>Postflop</button><span className="self-center text-xs text-slate-500">找到 {buildSemanticDecisionPairs(rows, { role: 'training', limit: 10000 }).length} 組 one-variable solver flips</span></div><SemanticCounterfactualSession pairs={pairs} history={history} onRecord={record} onExit={onExit} onComplete={onExit} /></div>;
}

function SolverSpot({ row, choice, onChoice }: { row: PokerBenchRow; choice: string | null; onChoice: (choice: string) => void }) {
  const board = row.split === 'postflop' ? `${row.boardFlop}${row.boardTurn || ''}${row.boardRiver || ''}` : '';
  return <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6"><div className="font-mono text-2xl font-bold">{row.holding} · {row.heroPosition}</div><div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-3"><span>Pot {row.potSize} BB</span><span>{row.split === 'preflop' ? `${row.numPlayers} 人桌 · bet depth ${row.numBets}` : row.evaluationAt}</span><span>{row.split === 'postflop' ? `Board ${board}` : 'Preflop'}</span></div><div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4 text-sm leading-6 text-slate-300">{row.split === 'preflop' ? row.prevLine || 'First in' : <><div>Preflop: {row.preflopAction || '-'}</div><div>Postflop: {row.postflopAction || '-'}</div></>}</div><div className="mt-5 grid gap-2 sm:grid-cols-2">{row.availableMoves.map(move => <button key={move} onClick={() => onChoice(move)} className={`rounded-xl border p-3 text-left text-sm ${choice === move ? 'border-cyan-400/60 bg-cyan-500/12 text-cyan-100' : 'border-slate-700 bg-slate-950/35 text-slate-300'}`}>{move}</button>)}</div></section>;
}

function SemanticReveal({ pair, answers, onNext }: { pair: SemanticDecisionPair; answers: PairAnswers; onNext: () => void }) {
  const left = answers.left!; const right = answers.right!;
  return <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/6 p-6 md:p-8"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300"><GitCompareArrows className="h-4 w-4" />True counterfactual reveal</div><h2 className="mt-3 text-2xl font-bold">答案真的翻了，差的是：{semanticDimensionLabel(pair.dimension)}</h2><p className="mt-3 rounded-xl border border-slate-800 bg-slate-950/35 p-4 text-sm text-slate-300">{describeSemanticChange(pair)}</p><div className="mt-5 grid gap-4 md:grid-cols-2"><RevealCard label="A" choice={left.choice} best={pair.left.correctDecision} /><RevealCard label="B" choice={right.choice} best={pair.right.correctDecision} /></div><div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/7 p-4 text-sm leading-6 text-amber-100">這裡只聲稱「這一個可觀測維度改變，而且 pinned PokerBench solver label 隨之改變」。PokerBench 沒有發布每個 action EV、mixed frequency 或因果解釋，所以系統不會捏造原因。</div><button onClick={onNext} className="mt-5 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-emerald-950">下一組</button></section>;
}

function RevealCard({ label, choice, best }: { label: string; choice: string; best: string }) {
  const correct = decisionsMatch(choice, best);
  return <div className={`rounded-xl border p-4 ${correct ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}><div className="text-xs text-slate-500">Spot {label}</div><div className="mt-2 text-sm">你：<b>{choice}</b></div><div className="mt-1 text-sm">Solver：<b>{best}</b></div></div>;
}

function makeHistoryItem(pair: SemanticDecisionPair, row: PokerBenchRow, answer: NonNullable<PairAnswers['left']>, history: HistoryItem[], now: number, offset: number): HistoryItem {
  const split = row.split;
  const family = solverDecisionFamilyId(row);
  const previous = history.filter(item => historyDecisionFamilyId(item) === family).sort((a, b) => b.timestamp - a.timestamp)[0];
  const selected = parsePokerDecision(answer.choice);
  const best = parsePokerDecision(row.correctDecision);
  const correct = decisionsMatch(answer.choice, row.correctDecision);
  const fingerprint = fingerprintPokerBenchRow(row);
  const role = solverCorpusRole(row);
  return {
    schemaVersion: 5,
    attemptId: createAttemptId(),
    trainingType: 'counterfactual',
    scenarioId: `semantic:${POKERBENCH_FILES[split].split}:${row.id}`,
    decisionFamilyId: family,
    stepId: 'solver-decision',
    masteryKey: makeMasteryKey(family, 'solver-decision'),
    transferGroupId: pair.id,
    skillIds: ['decision.boundary', split === 'preflop' ? 'preflop.solver-decision' : 'postflop.solver-decision'],
    situationIds: [`situation.position.${row.heroPosition.toLowerCase()}`, `semantic.dimension.${pair.dimension}`, ...(split === 'postflop' ? [`situation.street.${row.evaluationAt.toLowerCase()}`] : ['situation.street.preflop'])],
    category: ['PokerBench', 'Semantic Counterfactual', semanticDimensionLabel(pair.dimension), split === 'preflop' ? 'Preflop' : row.evaluationAt],
    score: correct ? 10 : 0,
    judgment: correct ? '正確' : '錯誤',
    timestamp: now + offset,
    selectedAction: answer.choice,
    bestAction: row.correctDecision,
    selectedDecision: selected.action,
    bestDecision: best.action,
    street: split === 'preflop' ? 'Preflop' : row.evaluationAt,
    position: row.heroPosition,
    durationMs: answer.durationMs,
    confidence: answer.confidence,
    correct,
    feedbackQuality: correct ? 'best' : 'major-error',
    truthTier: 'verified-solver',
    truthSourceId: POKERBENCH_SOURCE.id,
    truthSourceRef: POKERBENCH_SOURCE.dataset,
    truthSourceLicense: POKERBENCH_SOURCE.license,
    truthSourceRevision: POKERBENCH_SOURCE.revision,
    datasetSplit: POKERBENCH_FILES[split].split,
    datasetRowId: row.id,
    difficultyWeight: getDifficultyWeight('進階'),
    isReview: Boolean(previous),
    isDelayedReview: isDelayedReview(previous, now),
    isUnseen: !previous,
    isTransferTest: true,
    transferLevel: 'context',
    contextFingerprint: fingerprint.id,
    contextMatchStatus: 'exact',
    errorType: classifyDecisionError({ correct, confidence: answer.confidence, selectedDecision: selected.action, bestDecision: best.action }),
    solverCorpusRole: role,
    contrastivePairId: pair.id,
    questionLabel: `Semantic ${pair.dimension} · ${row.holding}`,
    notes: `${describeSemanticChange(pair)}. Both rows are pinned PokerBench solver labels; no per-action EV/frequency or causal explanation is fabricated.`,
    ...getReviewSchedule(correct ? 10 : 0, answer.confidence, previous, now),
  };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-slate-950 px-4 text-slate-300"><div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">{children}</div></div>;
}
