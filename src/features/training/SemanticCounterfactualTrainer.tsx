import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, GitCompareArrows, Loader2, XCircle } from 'lucide-react';
import { HistoryItem } from '../../types';
import { classifyDecisionError } from '../../learning-engine/errorModel';
import { getDifficultyWeight, isDelayedReview, makeMasteryKey } from '../../learning-engine';
import { historyDecisionFamilyId } from '../../learning-engine/contextIdentity';
import { buildSemanticDecisionPairs, describeSemanticChange, SemanticDecisionPair, semanticDimensionLabel, solverDecisionFamilyId } from '../../learning-engine/semanticPairs';
import { solverCorpusRole } from '../../learning-engine/solverCurriculum';
import { fingerprintPokerBenchRow } from '../../solver-data/contextFingerprint';
import { decisionsMatch, loadPokerBenchSplit, parsePokerDecision, POKERBENCH_FILES, POKERBENCH_SOURCE, PokerBenchRow, PokerBenchSplit } from '../../solver-data/pokerbench';
import { createAttemptId, getReviewSchedule, loadHistory, saveHistory } from '../../utils/history';

type Side = 'left' | 'right';
type LockedAnswer = { choice: string; durationMs: number };
interface PairAnswers { left?: LockedAnswer; right?: LockedAnswer; }

interface SessionProps {
  pairs: SemanticDecisionPair[];
  history: HistoryItem[];
  onRecord: (item: HistoryItem) => void;
  onExit: () => void;
  onComplete: () => void;
  title?: string;
  autoComplete?: boolean;
}

export function SemanticCounterfactualSession({ pairs, history, onRecord, onExit, onComplete, title = '自動訓練桌', autoComplete = false }: SessionProps) {
  const [index, setIndex] = useState(0);
  const [side, setSide] = useState<Side>('left');
  const [answers, setAnswers] = useState<PairAnswers>({});
  const [revealed, setRevealed] = useState(false);
  const startedAt = useRef(Date.now());
  const completionSent = useRef(false);
  const pair = pairs[index];
  const row = pair ? pair[side] : undefined;
  const pairCorrect = Boolean(pair && answers.left && answers.right && decisionsMatch(answers.left.choice, pair.left.correctDecision) && decisionsMatch(answers.right.choice, pair.right.correctDecision));

  useEffect(() => {
    if (pair || !autoComplete || completionSent.current) return;
    completionSent.current = true;
    onComplete();
  }, [pair, autoComplete, onComplete]);

  useEffect(() => {
    if (!revealed || !pairCorrect) return;
    const timer = window.setTimeout(() => next(), 900);
    return () => window.clearTimeout(timer);
  }, [revealed, pairCorrect, index]);

  if (!pair || !row) {
    if (autoComplete) return <div className="grid min-h-[45vh] place-items-center text-sm text-slate-500">正在自動切換下一批牌局…</div>;
    return <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-500/20 bg-emerald-500/6 p-8 text-center text-slate-100"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" /><h2 className="mt-4 text-2xl font-bold">這批變化題完成</h2><p className="mt-2 text-sm text-slate-400">完成 {pairs.length} 組、{pairs.length * 2} 個決策。</p><div className="mt-6 flex justify-center gap-3"><button onClick={onComplete} className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-emerald-950">繼續</button><button onClick={onExit} className="rounded-xl border border-slate-700 px-5 py-3 text-slate-300">離開</button></div></div>;
  }

  function choose(move: string) {
    if (revealed) return;
    const locked: LockedAnswer = { choice: move, durationMs: Date.now() - startedAt.current };
    if (side === 'left') {
      setAnswers({ left: locked });
      setSide('right');
      startedAt.current = Date.now();
      return;
    }
    const completed: PairAnswers = { ...answers, right: locked };
    if (!completed.left || !completed.right) return;
    const now = Date.now();
    onRecord(makeHistoryItem(pair, pair.left, completed.left, history, now, 0));
    onRecord(makeHistoryItem(pair, pair.right, completed.right, history, now, 1));
    setAnswers(completed);
    setRevealed(true);
  }

  function next() {
    setIndex(value => value + 1);
    setSide('left');
    setAnswers({});
    setRevealed(false);
    startedAt.current = Date.now();
  }

  const progress = pairs.length ? Math.round(index / pairs.length * 100) : 0;
  return <div className="mx-auto max-w-5xl space-y-5 text-slate-100" data-testid="semantic-auto-session">
    <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex flex-wrap items-center gap-3"><button onClick={onExit} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-400 hover:bg-slate-800"><ArrowLeft className="h-4 w-4" />離開</button><div className="flex-1"><div className="flex justify-between text-sm"><b>{title}</b><span className="font-mono text-slate-500">{index + 1}/{pairs.length}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-emerald-400" style={{ width: `${progress}%` }} /></div></div></div></div></header>
    {!revealed ? <><section className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 md:p-8"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">自動插入的變化題 · {side === 'left' ? 'A' : 'B'}</div><h2 className="mt-3 text-2xl font-bold">{side === 'left' ? '先做這個決策' : '現在只改一個重要條件，再做一次'}</h2>{side === 'right' && <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/7 px-4 py-3 text-sm text-emerald-100">A 已鎖定。B 只改一個可觀測策略條件，不需要你另外開任何工具。</div>}</section><SolverSpot row={row} onChoice={choose} /></> : <SemanticReveal pair={pair} answers={answers} onNext={next} autoAdvance={pairCorrect} />}
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
    loadPokerBenchSplit(split).then(result => { if (alive) setRows(result); }).catch(reason => { if (alive) setError(reason instanceof Error ? reason.message : 'PokerBench 載入失敗'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [split]);

  const allPairs = useMemo(() => buildSemanticDecisionPairs(rows, { role: 'training', limit: 10000 }), [rows]);
  const pairs = useMemo(() => shuffle(allPairs).slice(0, 20), [allPairs]);
  const record = (item: HistoryItem) => setHistory(previous => { const next = [...previous, item]; saveHistory(next); return next; });
  if (loading) return <FullScreenMessage><Loader2 className="h-5 w-5 animate-spin" />建立變化題…</FullScreenMessage>;
  if (error) return <FullScreenMessage>{error}<button onClick={onExit} className="rounded-lg border border-slate-700 px-3 py-2">返回</button></FullScreenMessage>;
  return <div className="min-h-screen bg-slate-950 px-4 py-6 md:px-8"><div className="mx-auto mb-5 flex max-w-5xl flex-wrap gap-2"><button onClick={() => setSplit('preflop')} className={`rounded-xl border px-4 py-2 text-sm ${split === 'preflop' ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200' : 'border-slate-700 text-slate-400'}`}>Preflop</button><button onClick={() => setSplit('postflop')} className={`rounded-xl border px-4 py-2 text-sm ${split === 'postflop' ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200' : 'border-slate-700 text-slate-400'}`}>Postflop</button><span className="self-center text-xs text-slate-500">找到 {allPairs.length} 組單一條件翻轉題</span></div><SemanticCounterfactualSession pairs={pairs} history={history} onRecord={record} onExit={onExit} onComplete={onExit} /></div>;
}

function SolverSpot({ row, onChoice }: { row: PokerBenchRow; onChoice: (choice: string) => void }) {
  const board = row.split === 'postflop' ? `${row.boardFlop}${row.boardTurn || ''}${row.boardRiver || ''}` : '';
  return <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6"><div className="font-mono text-2xl font-bold">{row.holding} · {row.heroPosition}</div><div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-3"><span>Pot {row.potSize} BB</span><span>{row.split === 'preflop' ? `${row.numPlayers} 人桌 · bet depth ${row.numBets}` : row.evaluationAt}</span><span>{row.split === 'postflop' ? `Board ${board}` : 'Preflop'}</span></div><div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4 text-sm leading-6 text-slate-300">{row.split === 'preflop' ? row.prevLine || 'First in' : <><div>Preflop: {row.preflopAction || '-'}</div><div>Postflop: {row.postflopAction || '-'}</div></>}</div><div className="mt-5 grid gap-2 sm:grid-cols-2">{row.availableMoves.map(move => <button data-testid="semantic-action" key={move} onClick={() => onChoice(move)} className="rounded-xl border border-slate-700 bg-slate-950/35 p-4 text-left text-sm font-semibold text-slate-300 hover:border-emerald-500/40">{move}</button>)}</div></section>;
}

function SemanticReveal({ pair, answers, onNext, autoAdvance }: { pair: SemanticDecisionPair; answers: PairAnswers; onNext: () => void; autoAdvance: boolean }) {
  const left = answers.left!;
  const right = answers.right!;
  return <section className={`rounded-3xl border p-6 md:p-8 ${autoAdvance ? 'border-emerald-500/20 bg-emerald-500/6' : 'border-red-500/20 bg-red-500/6'}`}><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300"><GitCompareArrows className="h-4 w-4" />決策邊界</div><h2 className="mt-3 text-2xl font-bold">只改「{semanticDimensionLabel(pair.dimension)}」，最佳動作就翻轉</h2><p className="mt-3 rounded-xl border border-slate-800 bg-slate-950/35 p-4 text-sm text-slate-300">{describeSemanticChange(pair)}</p><div className="mt-5 grid gap-4 md:grid-cols-2"><RevealCard label="A" choice={left.choice} best={pair.left.correctDecision} /><RevealCard label="B" choice={right.choice} best={pair.right.correctDecision} /></div><p className="mt-5 text-xs leading-6 text-slate-500">系統只使用已驗證的 optimal labels。沒有 action EV、mixed frequency 或因果資料時，不補假精度。</p>{autoAdvance ? <div className="mt-4 flex items-center gap-2 text-sm text-emerald-200"><CheckCircle2 className="h-5 w-5" />兩題都對，自動下一組</div> : <button onClick={onNext} className="mt-5 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-emerald-950">下一組</button>}</section>;
}

function RevealCard({ label, choice, best }: { label: string; choice: string; best: string }) {
  const correct = decisionsMatch(choice, best);
  return <div className={`rounded-xl border p-4 ${correct ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}><div className="flex items-center gap-2 text-xs text-slate-500">Spot {label}{correct ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-red-400" />}</div><div className="mt-2 text-sm">你：<b>{choice}</b></div><div className="mt-1 text-sm">最佳線：<b>{best}</b></div></div>;
}

function makeHistoryItem(pair: SemanticDecisionPair, row: PokerBenchRow, answer: LockedAnswer, history: HistoryItem[], now: number, offset: number): HistoryItem {
  const split = row.split;
  const family = solverDecisionFamilyId(row);
  const previous = history.filter(item => historyDecisionFamilyId(item) === family).sort((a, b) => b.timestamp - a.timestamp)[0];
  const selected = parsePokerDecision(answer.choice);
  const best = parsePokerDecision(row.correctDecision);
  const correct = decisionsMatch(answer.choice, row.correctDecision);
  const fingerprint = fingerprintPokerBenchRow(row);
  return {
    schemaVersion: 6,
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
    errorType: classifyDecisionError({ correct, selectedDecision: selected.action, bestDecision: best.action }),
    solverCorpusRole: solverCorpusRole(row),
    contrastivePairId: pair.id,
    questionLabel: `自動變化題 · ${row.holding}`,
    notes: `${describeSemanticChange(pair)}. Both rows are pinned PokerBench solver labels; no per-action EV/frequency or causal explanation is fabricated.`,
    ...getReviewSchedule(correct ? 10 : 0, previous, undefined, now),
  };
}

function shuffle<T>(items: T[]): T[] { const copy = [...items]; for (let index = copy.length - 1; index > 0; index -= 1) { const swap = Math.floor(Math.random() * (index + 1)); [copy[index], copy[swap]] = [copy[swap], copy[index]]; } return copy; }
function FullScreenMessage({ children }: { children: ReactNode }) { return <div className="grid min-h-screen place-items-center bg-slate-950 px-4 text-slate-300"><div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">{children}</div></div>; }
