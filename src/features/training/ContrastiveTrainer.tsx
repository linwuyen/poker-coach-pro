import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, GitCompareArrows, Loader2 } from 'lucide-react';
import { ConfidenceLevel, HistoryItem } from '../../types';
import { analyzeBoardTexture, boardTextureDifference } from '../../learning-engine/boardTexture';
import { buildContrastivePairs } from '../../learning-engine/solverCurriculum';
import { classifyDecisionError } from '../../learning-engine/errorModel';
import { fingerprintPokerBenchRow } from '../../solver-data/contextFingerprint';
import { decisionsMatch, loadPokerBenchSplit, parsePokerDecision, POKERBENCH_FILES, POKERBENCH_SOURCE, PokerBenchRow, PokerBenchSplit } from '../../solver-data/pokerbench';
import { createAttemptId, getReviewSchedule, loadHistory, saveHistory } from '../../utils/history';
import { getDifficultyWeight, isDelayedReview, makeMasteryKey } from '../../learning-engine';

const CONFIDENCE: Array<{ value: ConfidenceLevel; label: string }> = [
  { value: 1, label: '猜測' }, { value: 2, label: '不太確定' }, { value: 3, label: '大致確定' }, { value: 4, label: '非常確定' },
];

export function ContrastiveTrainer({ onExit }: { onExit: () => void }) {
  const [split, setSplit] = useState<PokerBenchSplit>('postflop');
  const [rows, setRows] = useState<PokerBenchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [leftChoice, setLeftChoice] = useState<string | null>(null);
  const [rightChoice, setRightChoice] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadPokerBenchSplit(split).then(result => { if (alive) setRows(result); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [split]);

  const pairs = useMemo(() => buildContrastivePairs(rows, 40), [rows]);
  const pair = pairs.length ? pairs[index % pairs.length] : null;

  const reset = () => { setLeftChoice(null); setRightChoice(null); setConfidence(null); setSubmitted(false); startedAt.current = Date.now(); };
  const next = () => { setIndex(value => (value + 1) % Math.max(1, pairs.length)); reset(); };

  const submit = () => {
    if (!pair || !leftChoice || !rightChoice || !confidence) return;
    const history = loadHistory();
    const now = Date.now();
    const makeItem = (row: PokerBenchRow, choice: string, side: 'A' | 'B', offset: number): HistoryItem => {
      const scenarioId = `contrastive:${POKERBENCH_FILES[split].split}:${row.id}`;
      const previous = history.filter(item => item.scenarioId === scenarioId).sort((a, b) => b.timestamp - a.timestamp)[0];
      const selected = parsePokerDecision(choice);
      const best = parsePokerDecision(row.correctDecision);
      const correct = decisionsMatch(choice, row.correctDecision);
      const fingerprint = fingerprintPokerBenchRow(row);
      const texture = row.split === 'postflop' ? analyzeBoardTexture(`${row.boardFlop}${row.boardTurn || ''}${row.boardRiver || ''}`) : undefined;
      return {
        schemaVersion: 4,
        attemptId: createAttemptId(),
        trainingType: 'contrastive',
        scenarioId,
        stepId: `contrast-${side}`,
        masteryKey: makeMasteryKey(scenarioId, `contrast-${side}`),
        transferGroupId: pair.id,
        skillIds: ['decision.boundary', row.split === 'preflop' ? 'preflop.solver-decision' : 'postflop.solver-decision'],
        situationIds: [`situation.position.${row.heroPosition.toLowerCase()}`, `situation.street.${row.split === 'preflop' ? 'preflop' : row.evaluationAt.toLowerCase()}`],
        category: ['PokerBench', 'Contrastive', row.split === 'preflop' ? 'Preflop' : row.evaluationAt],
        score: correct ? 10 : 0,
        judgment: correct ? '正確' : '錯誤',
        timestamp: now + offset,
        selectedAction: choice,
        bestAction: row.correctDecision,
        selectedDecision: selected.action,
        bestDecision: best.action,
        street: row.split === 'preflop' ? 'Preflop' : row.evaluationAt,
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
        difficultyWeight: getDifficultyWeight('進階'),
        isReview: Boolean(previous),
        isDelayedReview: isDelayedReview(previous, now),
        isUnseen: !previous,
        isTransferTest: true,
        contextFingerprint: fingerprint.id,
        contextMatchStatus: 'exact',
        errorType: classifyDecisionError({ correct, confidence, selectedDecision: selected.action, bestDecision: best.action }),
        solverCorpusRole: 'sibling',
        contrastivePairId: pair.id,
        boardTextureId: texture?.textureId,
        questionLabel: `Contrastive ${side} · ${row.holding}`,
        notes: `Sibling partition only. Pair similarity=${pair.similarityScore}. Compare which material context variable changes the solver label.`,
        ...getReviewSchedule(correct ? 10 : 0, confidence, previous, now),
      };
    };
    saveHistory([...history, makeItem(pair.left, leftChoice, 'A', 0), makeItem(pair.right, rightChoice, 'B', 1)]);
    setSubmitted(true);
  };

  const differences = pair ? describeDifferences(pair.left, pair.right) : [];
  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8"><div className="mx-auto max-w-6xl">
    <button type="button" onClick={onExit} className="pc-interactive flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
    <section className="pc-hero-glow mt-6 rounded-3xl border border-fuchsia-500/20 bg-[linear-gradient(135deg,rgba(217,70,239,0.12),rgba(15,23,42,0.78))] p-6 md:p-8"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300"><GitCompareArrows className="h-4 w-4" />Contrastive Trainer</div><h1 className="mt-3 text-3xl font-bold">兩題看起來很像，哪個變數讓答案翻轉？</h1><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">只使用 Sibling 10% partition；正常 Solver Corpus 不會提前看過。配對會盡量保持手牌、位置、street、action set 相近，但要求 solver label 不同。</p><div className="mt-5 flex gap-2"><button onClick={() => { setSplit('preflop'); reset(); }} className={`rounded-xl border px-4 py-2 text-sm ${split === 'preflop' ? 'border-fuchsia-400/50 bg-fuchsia-500/12' : 'border-slate-700'}`}>Preflop</button><button onClick={() => { setSplit('postflop'); reset(); }} className={`rounded-xl border px-4 py-2 text-sm ${split === 'postflop' ? 'border-fuchsia-400/50 bg-fuchsia-500/12' : 'border-slate-700'}`}>Postflop</button></div></section>

    {loading ? <div className="mt-6 flex min-h-60 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />建立 sibling pairs…</div> : !pair ? <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/7 p-5 text-sm text-amber-100">目前 split 找不到足夠相似且 solver label 不同的 sibling pair。</div> : <>
      <section className="mt-6 grid gap-5 lg:grid-cols-2"><SpotCard label="A" row={pair.left} selected={leftChoice} onSelect={setLeftChoice} disabled={submitted} /><SpotCard label="B" row={pair.right} selected={rightChoice} onSelect={setRightChoice} disabled={submitted} /></section>
      {!submitted ? <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="text-sm font-semibold">你有多確定這兩個決策？</div><div className="mt-3 grid gap-2 sm:grid-cols-4">{CONFIDENCE.map(item => <button key={item.value} onClick={() => setConfidence(item.value)} className={`rounded-xl border px-3 py-3 text-sm ${confidence === item.value ? 'border-amber-400/60 bg-amber-400/10 text-amber-200' : 'border-slate-700 text-slate-400'}`}>{item.label}</button>)}</div><button disabled={!leftChoice || !rightChoice || !confidence} onClick={submit} className="pc-interactive pc-shimmer mt-4 w-full rounded-xl bg-fuchsia-500 px-5 py-3 font-semibold text-white disabled:opacity-40">提交兩題</button></section>
      : <section className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/6 p-5"><h2 className="font-semibold">Solver Labels</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Result label="A" selected={leftChoice!} best={pair.left.correctDecision} /><Result label="B" selected={rightChoice!} best={pair.right.correctDecision} /></div><div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Material differences</div><div className="mt-2 text-sm leading-7 text-slate-300">{differences.length ? differences.join(' · ') : '差異主要在 action history / range context；資料列沒有提供 solver 因果解釋，因此不捏造理由。'}</div></div><button onClick={next} className="mt-4 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950">下一組</button></section>}
    </>}
  </div></div>;
}

function SpotCard({ label, row, selected, onSelect, disabled }: { label: string; row: PokerBenchRow; selected: string | null; onSelect: (value: string) => void; disabled: boolean }) {
  const board = row.split === 'postflop' ? `${row.boardFlop}${row.boardTurn || ''}${row.boardRiver || ''}` : '';
  return <div className="pc-card-lift rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-300">Spot {label}</div><div className="mt-2 font-mono text-2xl font-bold">{row.holding} · {row.heroPosition}</div><div className="mt-3 text-xs leading-6 text-slate-500">{row.split === 'preflop' ? row.prevLine || 'First in' : `${row.evaluationAt} · ${board} · ${row.postflopAction}`}</div><div className="mt-4 grid gap-2 sm:grid-cols-2">{row.availableMoves.map(move => <button key={move} disabled={disabled} onClick={() => onSelect(move)} className={`rounded-xl border p-3 text-left text-sm ${selected === move ? 'border-fuchsia-400/60 bg-fuchsia-500/12' : 'border-slate-700 bg-slate-950/35'}`}>{move}</button>)}</div></div>;
}
function Result({ label, selected, best }: { label: string; selected: string; best: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 text-sm">你：<b>{selected}</b></div><div className="mt-1 text-sm">Solver：<b>{best}</b></div></div>; }
function describeDifferences(left: PokerBenchRow, right: PokerBenchRow): string[] {
  const result: string[] = [];
  if (left.heroPosition !== right.heroPosition) result.push(`position ${left.heroPosition}→${right.heroPosition}`);
  if (Math.abs(left.potSize - right.potSize) > 1) result.push(`pot ${left.potSize}→${right.potSize}bb`);
  if (left.split === 'postflop' && right.split === 'postflop') {
    const lt = analyzeBoardTexture(`${left.boardFlop}${left.boardTurn || ''}${left.boardRiver || ''}`);
    const rt = analyzeBoardTexture(`${right.boardFlop}${right.boardTurn || ''}${right.boardRiver || ''}`);
    result.push(...boardTextureDifference(lt, rt));
    if (left.postflopAction !== right.postflopAction) result.push('postflop action history changed');
  }
  if (left.split === 'preflop' && right.split === 'preflop') {
    if (left.numBets !== right.numBets) result.push(`bet depth ${left.numBets}→${right.numBets}`);
    if (left.prevLine !== right.prevLine) result.push('preflop action line changed');
  }
  return result;
}
