import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Database, Loader2, RefreshCw, Ruler, ShieldCheck, XCircle } from 'lucide-react';
import { ConfidenceLevel, HistoryItem, Street } from '../../types';
import { getDifficultyWeight, isDelayedReview, makeMasteryKey } from '../../learning-engine';
import { createAttemptId, getReviewSchedule, loadHistory, saveHistory } from '../../utils/history';
import {
  decisionsMatch,
  deterministicSample,
  isSizingDecisionRow,
  loadPokerBenchSplit,
  parsePokerDecision,
  POKERBENCH_FILES,
  POKERBENCH_SOURCE,
  PokerBenchPostflopRow,
  PokerBenchRow,
  PokerBenchSplit,
} from '../../solver-data/pokerbench';

const CONFIDENCE: Array<{ value: ConfidenceLevel; label: string }> = [
  { value: 1, label: '猜測' },
  { value: 2, label: '不太確定' },
  { value: 3, label: '大致確定' },
  { value: 4, label: '非常確定' },
];

type TrainerMode = 'all' | 'sizing';

export function PokerBenchTrainer({ onExit, mode = 'all' }: { onExit: () => void; mode?: TrainerMode }) {
  const [split, setSplit] = useState<PokerBenchSplit>(mode === 'sizing' ? 'postflop' : 'preflop');
  const [rows, setRows] = useState<PokerBenchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [position, setPosition] = useState('all');
  const [street, setStreet] = useState<'all' | Street>('all');
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [seed, setSeed] = useState(() => new Date().toISOString().slice(0, 10));
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    loadPokerBenchSplit(split)
      .then(result => { if (alive) setRows(result); })
      .catch(reason => { if (alive) setError(reason instanceof Error ? reason.message : 'PokerBench 載入失敗。'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [split]);

  const positions = useMemo(() => [...new Set(rows.map(row => row.heroPosition).filter(Boolean))].sort(), [rows]);
  const pool = useMemo(() => rows.filter(row => {
    if (row.availableMoves.length < 2 || !row.correctDecision) return false;
    if (mode === 'sizing' && !isSizingDecisionRow(row)) return false;
    if (position !== 'all' && row.heroPosition !== position) return false;
    if (street !== 'all' && (row.split !== 'postflop' || row.evaluationAt !== street)) return false;
    return true;
  }), [mode, position, rows, street]);
  const session = useMemo(() => deterministicSample(pool, Math.min(40, pool.length), `${seed}:${split}:${mode}:${position}:${street}`), [mode, pool, position, seed, split, street]);
  const row = session.length ? session[index % session.length] : null;
  const correct = Boolean(row && selected && decisionsMatch(selected, row.correctDecision));

  useEffect(() => {
    setIndex(0);
    setSelected(null);
    setConfidence(null);
    setSubmitted(false);
    startedAt.current = Date.now();
  }, [position, split, street, seed]);

  const submit = () => {
    if (!row || !selected || !confidence) return;
    const history = loadHistory();
    const now = Date.now();
    const scenarioId = `pokerbench:${POKERBENCH_FILES[split].split}:${row.id}`;
    const previous = history.filter(item => item.scenarioId === scenarioId).sort((a, b) => b.timestamp - a.timestamp)[0];
    const isCorrect = decisionsMatch(selected, row.correctDecision);
    const score = isCorrect ? 10 : 0;
    const selectedDecision = parsePokerDecision(selected);
    const bestDecision = parsePokerDecision(row.correctDecision);
    const item: HistoryItem = {
      schemaVersion: 4,
      attemptId: createAttemptId(),
      trainingType: 'solver-corpus',
      scenarioId,
      stepId: 'solver-decision',
      masteryKey: makeMasteryKey(scenarioId, 'solver-decision'),
      transferGroupId: `pokerbench-${row.split}`,
      skillIds: mode === 'sizing' ? ['postflop.bet-sizing', 'decision.boundary'] : row.split === 'preflop' ? ['preflop.solver-decision'] : ['postflop.solver-decision'],
      situationIds: [`situation.street.${row.split === 'preflop' ? 'preflop' : row.evaluationAt.toLowerCase()}`, `situation.position.${row.heroPosition.toLowerCase()}`],
      category: ['PokerBench', 'Solver Corpus', row.split === 'preflop' ? 'Preflop' : row.evaluationAt, ...(mode === 'sizing' ? ['Bet Sizing'] : [])],
      score,
      judgment: isCorrect ? '正確' : '錯誤',
      timestamp: now,
      selectedAction: selected,
      bestAction: row.correctDecision,
      selectedDecision: selectedDecision.action,
      bestDecision: bestDecision.action,
      street: row.split === 'preflop' ? 'Preflop' : row.evaluationAt,
      position: row.heroPosition,
      durationMs: now - startedAt.current,
      confidence,
      correct: isCorrect,
      feedbackQuality: isCorrect ? 'best' : 'major-error',
      truthTier: 'verified-solver',
      truthSourceId: POKERBENCH_SOURCE.id,
      truthSourceRef: POKERBENCH_SOURCE.dataset,
      truthSourceLicense: POKERBENCH_SOURCE.license,
      truthSourceRevision: POKERBENCH_SOURCE.revision,
      datasetSplit: POKERBENCH_FILES[split].split,
      datasetRowId: row.id,
      difficultyWeight: getDifficultyWeight(mode === 'sizing' || row.split === 'postflop' ? '進階' : '中階'),
      isReview: Boolean(previous),
      isDelayedReview: isDelayedReview(previous, now),
      isUnseen: !previous,
      isTransferTest: true,
      questionLabel: `PokerBench · ${row.split === 'preflop' ? 'Preflop' : row.evaluationAt} · ${row.holding}`,
      notes: `${POKERBENCH_SOURCE.label}. Optimal action comes from the pinned dataset row. The dataset does not publish per-action EV for this row, so EV regret is intentionally left undefined.`,
      ...getReviewSchedule(score, confidence, previous, now),
    };
    saveHistory([...history, item]);
    setAttempts(value => value + 1);
    setSubmitted(true);
  };

  const next = () => {
    if (!session.length) return;
    setIndex(value => (value + 1) % session.length);
    setSelected(null);
    setConfidence(null);
    setSubmitted(false);
    startedAt.current = Date.now();
  };

  const reload = async () => {
    setLoading(true);
    setError('');
    try { setRows(await loadPokerBenchSplit(split, true)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'PokerBench 載入失敗。'); }
    finally { setLoading(false); }
  };

  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8"><div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" onClick={onExit} className="pc-interactive flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
      <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1.5 text-xs text-emerald-200"><ShieldCheck className="h-3.5 w-3.5" />verified-solver · {POKERBENCH_SOURCE.license}</div>
    </header>

    <section className="pc-hero-glow mt-6 rounded-3xl border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(15,23,42,0.78))] p-6 md:p-8">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">{mode === 'sizing' ? <Ruler className="h-4 w-4" /> : <Database className="h-4 w-4" />}{mode === 'sizing' ? 'Solver Bet Sizing' : 'PokerBench Solver Corpus'}</div>
      <h1 className="mt-3 text-3xl font-bold">{mode === 'sizing' ? '下注尺寸直接用 Solver Label 訓練' : '把 Heuristic 降級，Solver Label 升成主真值'}</h1>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">來源固定在 PokerBench revision <span className="font-mono text-emerald-200">{POKERBENCH_SOURCE.revision.slice(0, 12)}</span>。這裡只使用資料集實際提供的 optimal decision；沒有 action EV 就不顯示 EV regret，也不推測 mixed frequency。</p>
    </section>

    {mode === 'all' && <section className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => setSplit('preflop')} className={`rounded-xl border px-4 py-2 text-sm ${split === 'preflop' ? 'border-emerald-400/50 bg-emerald-500/12 text-emerald-200' : 'border-slate-800 text-slate-400'}`}>Preflop · 1,000</button><button type="button" onClick={() => setSplit('postflop')} className={`rounded-xl border px-4 py-2 text-sm ${split === 'postflop' ? 'border-emerald-400/50 bg-emerald-500/12 text-emerald-200' : 'border-slate-800 text-slate-400'}`}>Postflop · 10,000</button></section>}

    <section className="mt-5 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/55 p-4 md:grid-cols-4">
      <label className="text-xs text-slate-500">位置<select value={position} onChange={event => setPosition(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100"><option value="all">全部</option>{positions.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      {split === 'postflop' && <label className="text-xs text-slate-500">Street<select value={street} onChange={event => setStreet(event.target.value as 'all' | Street)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100"><option value="all">全部</option><option value="Flop">Flop</option><option value="Turn">Turn</option><option value="River">River</option></select></label>}
      <label className="text-xs text-slate-500">Session seed<input value={seed} onChange={event => setSeed(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 font-mono text-sm text-slate-100" /></label>
      <div className="flex items-end"><button type="button" onClick={reload} className="pc-interactive flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300"><RefreshCw className="h-4 w-4" />重新抓取 pinned source</button></div>
    </section>

    {loading && <div className="mt-6 flex min-h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/45 text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" />載入 PokerBench {POKERBENCH_FILES[split].label}…</div>}
    {!loading && error && <div className="mt-6 rounded-2xl border border-red-500/25 bg-red-500/7 p-5 text-sm text-red-200"><div className="flex items-center gap-2 font-semibold"><XCircle className="h-5 w-5" />外部 solver corpus 載入失敗</div><p className="mt-2 leading-6">{error}</p><p className="mt-2 text-xs text-red-200/70">網站仍可使用 Exact Equity、ICM 與本地 fallback；系統不會在下載失敗時偷偷改用 heuristic 冒充 solver。</p></div>}
    {!loading && !error && !row && <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/7 p-5 text-sm text-amber-100">目前篩選條件沒有可作答的 solver row。</div>}

    {!loading && !error && row && <section className="pc-enter mt-6 rounded-3xl border border-slate-800 bg-slate-900/55 p-5 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs uppercase tracking-[0.18em] text-slate-500">{row.split === 'preflop' ? 'Preflop' : row.evaluationAt} · {row.heroPosition}</div><h2 className="mt-2 font-mono text-2xl font-bold">Hero {row.holding}</h2></div><div className="text-right text-xs text-slate-500">Pool {pool.length.toLocaleString()} · Session {session.length} · 已作答 {attempts}</div></div>
      <Context row={row} />
      <div className="mt-6"><div className="mb-3 text-sm font-semibold">最佳決策是？</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{row.availableMoves.map(move => <button key={move} type="button" disabled={submitted} onClick={() => setSelected(move)} className={`pc-card-lift rounded-2xl border p-4 text-left font-semibold ${selected === move ? 'border-emerald-400 bg-emerald-500/12 text-emerald-100' : 'border-slate-800 bg-slate-950/40 text-slate-300'}`}>{move}</button>)}</div></div>

      {!submitted ? <><div className="mt-6 grid gap-2 sm:grid-cols-4">{CONFIDENCE.map(item => <button key={item.value} type="button" onClick={() => setConfidence(item.value)} className={`rounded-xl border px-3 py-3 text-sm ${confidence === item.value ? 'border-amber-400/60 bg-amber-400/10 text-amber-200' : 'border-slate-700 text-slate-400'}`}>{item.label}</button>)}</div><button type="button" disabled={!selected || !confidence} onClick={submit} className="pc-interactive pc-shimmer mt-4 w-full rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-emerald-950 disabled:opacity-40">提交 Solver 決策</button></>
      : <div className={`mt-6 rounded-2xl border p-5 ${correct ? 'border-emerald-500/25 bg-emerald-500/7' : 'border-red-500/25 bg-red-500/7'}`}><div className="flex items-center gap-2 font-semibold">{correct ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-red-400" />}{correct ? '符合 Solver Label' : '與 Solver Label 不同'}</div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label="你的答案" value={selected || '-'} /><Metric label="Solver Label" value={row.correctDecision} /><Metric label="Truth" value="verified-solver" /></div><p className="mt-4 text-xs leading-6 text-slate-400">此資料列沒有公開每個 action 的 EV，因此不顯示假的 chosen EV / best EV / regret。History 會保存 dataset revision、split、row id 與 license，之後可完整追溯。</p><button type="button" onClick={next} className="mt-4 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950">下一題</button></div>}
    </section>}

    <section className="mt-6 grid gap-4 md:grid-cols-3"><SourceCard label="Dataset" value="RZ412/PokerBench" detail={`${POKERBENCH_FILES[split].rows.toLocaleString()} rows in this pinned slice`} /><SourceCard label="Revision" value={POKERBENCH_SOURCE.revision.slice(0, 12)} detail="immutable source pin" /><SourceCard label="License" value={POKERBENCH_SOURCE.license} detail="solver-computed decisions" /></section>
  </div></div>;
}

function Context({ row }: { row: PokerBenchRow }) {
  if (row.split === 'preflop') return <div className="mt-5 grid gap-3 md:grid-cols-3"><Metric label="Action line" value={row.prevLine || 'First in'} wide /><Metric label="Pot" value={`${row.potSize}bb`} /><Metric label="Players / bets" value={`${row.numPlayers} / ${row.numBets}`} /></div>;
  const postflop = row as PokerBenchPostflopRow;
  const board = `${postflop.boardFlop}${postflop.boardTurn || ''}${postflop.boardRiver || ''}`;
  return <div className="mt-5 grid gap-3 md:grid-cols-3"><Metric label="Board" value={board || '-'} /><Metric label="Pot" value={`${postflop.potSize}bb`} /><Metric label="Aggressor" value={postflop.aggressorPosition || '-'} /><Metric label="Preflop" value={postflop.preflopAction || '-'} wide /><Metric label="Postflop line" value={postflop.postflopAction || '-'} wide /></div>;
}

function Metric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={`rounded-xl border border-slate-800 bg-slate-950/45 p-4 ${wide ? 'md:col-span-2' : ''}`}><div className="text-xs text-slate-500">{label}</div><div className="mt-2 break-all font-mono text-sm font-semibold text-slate-200">{value}</div></div>; }
function SourceCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="pc-card-lift rounded-2xl border border-slate-800 bg-slate-900/55 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-sm font-bold text-slate-200">{value}</div><div className="mt-1 text-xs text-slate-600">{detail}</div></div>; }
