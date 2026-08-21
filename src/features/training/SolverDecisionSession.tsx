import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Lightbulb, XCircle } from 'lucide-react';
import { HistoryItem } from '../../types';
import { classifyDecisionError } from '../../learning-engine/errorModel';
import { getDifficultyWeight, isDelayedReview, makeMasteryKey } from '../../learning-engine';
import { historyDecisionFamilyId } from '../../learning-engine/contextIdentity';
import { solverDecisionFamilyId } from '../../learning-engine/semanticPairs';
import { solverCorpusRole, solverCurriculum } from '../../learning-engine/solverCurriculum';
import { fingerprintPokerBenchRow } from '../../solver-data/contextFingerprint';
import { decisionsMatch, normalizeDecision, parsePokerDecision, POKERBENCH_FILES, POKERBENCH_SOURCE, PokerBenchRow } from '../../solver-data/pokerbench';
import { createAttemptId, getReviewSchedule } from '../../utils/history';

const SUIT: Record<string, string> = { c: '♣', d: '♦', h: '♥', s: '♠' };
const ACTION_ZH: Array<[RegExp, string]> = [
  [/^fold\b/i, '棄牌'],
  [/^call\b/i, '跟注'],
  [/^check\b/i, '過牌'],
  [/^all\s*-?\s*in|^allin|^jam/i, '全下'],
];

export function prettySolverCard(code: string): string {
  const match = code.trim().match(/^([2-9TJQKA])([cdhs])$/i);
  return match ? `${match[1].toUpperCase()}${SUIT[match[2].toLowerCase()]}` : code;
}

export function prettySolverCards(value: string): string {
  const cards = [...value.matchAll(/([2-9TJQKA][cdhs])/gi)].map(match => prettySolverCard(match[1]));
  return cards.length ? cards.join(' ') : value;
}

export function humanizeSolverMove(value: string): string {
  const normalized = normalizeDecision(value);
  for (const [pattern, label] of ACTION_ZH) if (pattern.test(normalized)) return label;
  const amount = normalized.match(/^(bet|raise)\s+([0-9]+(?:\.[0-9]+)?)/i);
  if (amount) return `${amount[1].toLowerCase() === 'bet' ? '下注' : '加注到'} ${amount[2]} BB`;
  if (/^bet\b/i.test(normalized)) return '下注';
  if (/^raise\b/i.test(normalized)) return '加注';
  return value;
}

export function humanizeSolverPreflopLine(value: string): string {
  if (!value.trim()) return '前面都棄牌，輪到你決策';
  const tokens = value.split('/').map(token => token.trim()).filter(Boolean);
  const result: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const position = tokens[index];
    const next = tokens[index + 1];
    if (!next) { result.push(position); continue; }
    if (/^[0-9]+(?:\.[0-9]+)?bb$/i.test(next)) {
      result.push(`${position} 加注到 ${next.replace(/bb/i, ' BB')}`);
      index += 1;
      continue;
    }
    if (/^(call|fold|check|limp|all[-_ ]?in|jam)$/i.test(next)) {
      const action = /^call$/i.test(next) ? '跟注' : /^fold$/i.test(next) ? '棄牌' : /^check$/i.test(next) ? '過牌' : /^limp$/i.test(next) ? '跛入' : '全下';
      result.push(`${position} ${action}`);
      index += 1;
      continue;
    }
    result.push(position);
  }
  return result.join(' → ');
}

export function humanizeSolverPostflopLine(value: string): string {
  if (!value.trim()) return '尚無先前 postflop 行動';
  const tokens = value.split('/').map(token => token.trim()).filter(Boolean);
  const result: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (/^dealcards?$/i.test(token)) {
      const card = tokens[index + 1];
      if (card) { result.push(`發 ${prettySolverCard(card)}`); index += 1; }
      continue;
    }
    const action = token.match(/^(OOP|IP)_(CHECK|CALL|FOLD|BET|RAISE)(?:_([0-9]+(?:\.[0-9]+)?))?$/i);
    if (action) {
      const actor = action[1].toUpperCase();
      const verb = action[2].toUpperCase();
      const amount = action[3];
      const zh = verb === 'CHECK' ? '過牌' : verb === 'CALL' ? '跟注' : verb === 'FOLD' ? '棄牌' : verb === 'BET' ? `下注${amount ? ` ${amount} BB` : ''}` : `加注${amount ? `到 ${amount} BB` : ''}`;
      result.push(`${actor} ${zh}`);
      continue;
    }
    result.push(token.replaceAll('_', ' '));
  }
  return result.join(' → ');
}

function automaticAnalysis(row: PokerBenchRow, choice: string): string[] {
  const best = parsePokerDecision(row.correctDecision).action.type;
  const selected = parsePokerDecision(choice).action.type;
  const lines: string[] = [];
  if (best === 'raise' || best === 'bet' || best === 'all-in') {
    lines.push(`這個 exact solver node 的最佳線是主動施壓：${humanizeSolverMove(row.correctDecision)}。你選的「${humanizeSolverMove(choice)}」在這個節點過於被動或投入方式不同。`);
  } else if (best === 'call') {
    lines.push(`這個 exact solver node 的最佳線是跟注：保留繼續範圍並實現 equity，而不是在此節點改成 ${humanizeSolverMove(choice)}。`);
  } else if (best === 'fold') {
    lines.push(`這個 exact solver node 的最佳線是棄牌；繼續投入在此節點不是資料集標示的 optimal decision。`);
  } else if (best === 'check') {
    lines.push(`這個 exact solver node 的最佳線是過牌；這裡不需要主動擴大底池。`);
  } else {
    lines.push(`這個 exact solver node 的最佳線是 ${humanizeSolverMove(row.correctDecision)}，你選的是 ${humanizeSolverMove(choice)}。`);
  }
  if (selected === best && !decisionsMatch(choice, row.correctDecision)) {
    lines.push('你的 action 類型接近，但 sizing / exact action 不同；這題的 optimal label 對尺寸有要求。');
  }
  lines.push('PokerBench 這筆資料只提供 optimal label，沒有 per-action EV 或 mixed frequency；系統不會虛構「差幾 BB」或假的 solver 頻率。');
  return lines;
}

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
  const analysis = useMemo(() => row && choice && submitted && !correct ? automaticAnalysis(row, choice) : [], [row, choice, submitted, correct]);

  useEffect(() => {
    if (row || !autoComplete || completionSent.current) return;
    completionSent.current = true;
    onComplete();
  }, [row, autoComplete, onComplete]);

  useEffect(() => {
    if (!submitted || !correct) return;
    const timer = window.setTimeout(() => next(), 450);
    return () => window.clearTimeout(timer);
  }, [submitted, correct, index]);

  if (!row) {
    if (autoComplete) return <div className="grid min-h-[45vh] place-items-center text-sm text-slate-500">正在切換下一手…</div>;
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
      questionLabel: `自動變化題 · ${prettySolverCards(row.holding)}`,
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

  const board = row.split === 'postflop' ? prettySolverCards(`${row.boardFlop}${row.boardTurn || ''}${row.boardRiver || ''}`) : '';
  const progress = Math.round(index / Math.max(1, rows.length) * 100);
  const preflopLine = row.split === 'preflop' ? humanizeSolverPreflopLine(row.prevLine) : humanizeSolverPreflopLine(row.preflopAction);
  const postflopLine = row.split === 'postflop' ? humanizeSolverPostflopLine(row.postflopAction) : '';

  return <div className="mx-auto max-w-5xl space-y-5 text-slate-100" data-testid="solver-decision-session">
    <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center gap-3"><button onClick={onExit} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-400 hover:bg-slate-800"><ArrowLeft className="h-4 w-4" />離開</button><div className="flex-1"><div className="flex justify-between text-sm"><b>{title}</b><span className="font-mono text-slate-500">{index + 1}/{rows.length}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-emerald-400" style={{ width: `${progress}%` }} /></div></div></div></header>
    <section className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 md:p-8">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">新的一手 · Solver 最佳解</div>
      <h2 className="mt-3 text-3xl font-bold">{prettySolverCards(row.holding)} <span className="text-slate-500">· {row.heroPosition}</span></h2>
      <div className="mt-4 grid gap-2 text-sm text-slate-400 sm:grid-cols-3"><span>底池 {row.potSize} BB</span><span>{row.split === 'preflop' ? `${row.numPlayers} 人桌` : row.evaluationAt}</span><span>{row.split === 'postflop' ? `公牌 ${board}` : `加注層級 ${row.numBets}`}</span></div>
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4 text-sm leading-7 text-slate-300"><div><span className="text-slate-500">翻前：</span>{preflopLine}</div>{row.split === 'postflop' && <div className="mt-1"><span className="text-slate-500">翻後：</span>{postflopLine}</div>}</div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">{row.availableMoves.map(move => <button data-testid="solver-action" key={move} disabled={submitted} onClick={() => submit(move)} className={`rounded-xl border p-4 text-left text-sm font-semibold ${choice === move ? 'border-emerald-400/60 bg-emerald-500/12' : 'border-slate-700 bg-slate-950/35 hover:border-emerald-500/40'}`}>{humanizeSolverMove(move)}</button>)}</div>
    </section>
    {submitted && (correct ? <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/6 p-4"><div className="flex items-center gap-3"><CheckCircle2 className="h-6 w-6 text-emerald-400" /><div><div className="font-semibold text-emerald-100">正確 · 直接下一手</div><div className="text-xs text-slate-500">{humanizeSolverMove(row.correctDecision)}</div></div></div></section> : <section data-testid="solver-auto-analysis" className="rounded-2xl border border-amber-500/25 bg-amber-500/6 p-5"><div className="flex gap-3"><XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-400" /><div className="min-w-0 flex-1"><div className="font-semibold text-amber-100">答錯 · 自動分析</div><div className="mt-2 text-sm text-slate-300">你：<b>{humanizeSolverMove(choice || '')}</b><span className="mx-2 text-slate-600">→</span>最佳解：<b className="text-emerald-300">{humanizeSolverMove(row.correctDecision)}</b></div><div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-amber-200"><Lightbulb className="h-4 w-4" />這手要學什麼</div><ul className="mt-2 space-y-2 text-sm leading-6 text-slate-300">{analysis.map(line => <li key={line}>• {line}</li>)}</ul></div><button onClick={next} className="mt-4 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-emerald-950">看完，下一手</button></div></div></section>)}
  </div>;
}
