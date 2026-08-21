import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Lightbulb, Scale, ShieldCheck, XCircle } from 'lucide-react';
import { CardUI } from '../../components/CardUI';
import { HistoryItem, Card, Rank, Suit } from '../../types';
import { classifyDecisionError } from '../../learning-engine/errorModel';
import { getDifficultyWeight, isDelayedReview, makeMasteryKey } from '../../learning-engine';
import { historyDecisionFamilyId } from '../../learning-engine/contextIdentity';
import { solverDecisionFamilyId } from '../../learning-engine/semanticPairs';
import { solverCorpusRole, solverCurriculum } from '../../learning-engine/solverCurriculum';
import { fingerprintPokerBenchRow } from '../../solver-data/contextFingerprint';
import { canonicalHolding, decisionsMatch, normalizeDecision, parsePokerDecision, POKERBENCH_FILES, POKERBENCH_SOURCE, PokerBenchRow } from '../../solver-data/pokerbench';
import { analyzeHandMath, evaluateHandStrength } from '../../utils/handMath';
import { createAttemptId, getReviewSchedule } from '../../utils/history';
import { AdvancedToolLinks } from './AdvancedToolLinks';

const SUIT: Record<string, string> = { c: '♣', d: '♦', h: '♥', s: '♠' };
const CARD_SUIT: Record<string, Suit> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' };
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

export function parseSolverCards(value: string): Card[] {
  return [...value.matchAll(/([2-9TJQKA])([cdhs])/gi)].map(match => ({
    rank: match[1].toUpperCase() as Rank,
    suit: CARD_SUIT[match[2].toLowerCase()],
  }));
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

export function automaticSolverAnalysis(row: PokerBenchRow, choice: string): string[] {
  const best = parsePokerDecision(row.correctDecision).action.type;
  const selected = parsePokerDecision(choice).action.type;
  const isCorrect = decisionsMatch(choice, row.correctDecision);
  const bestLabel = humanizeSolverMove(row.correctDecision);
  const choiceLabel = humanizeSolverMove(choice);
  const lines: string[] = [];

  if (isCorrect) {
    if (best === 'raise' || best === 'bet' || best === 'all-in') lines.push(`你抓到這個 exact solver node 的主動線：${bestLabel}。這裡的 solver label 要求用主動投入取得價值或壓力，而不是切換成其他 action。`);
    else if (best === 'call') lines.push(`你選對跟注。這個 exact node 的 optimal label 是保留繼續範圍並實現 equity，不把手牌轉成加注或直接棄掉。`);
    else if (best === 'fold') lines.push('你選對棄牌。這個 exact node 的資料標記是不再投入；其他繼續線都不是這筆資料的 optimal decision。');
    else if (best === 'check') lines.push('你選對過牌。這個 exact node 不要求主動擴大底池，保留 range 與後續街決策權是資料標記的最佳線。');
    else lines.push(`你選對了：${bestLabel} 是這個 exact solver node 的 optimal label。`);
  } else if (best === 'raise' || best === 'bet' || best === 'all-in') {
    lines.push(`這個 exact solver node 的最佳線是主動施壓：${bestLabel}。你選的「${choiceLabel}」在這個節點過於被動或投入方式不同。`);
  } else if (best === 'call') {
    lines.push(`這個 exact solver node 的最佳線是跟注：保留繼續範圍並實現 equity，而不是在此節點改成 ${choiceLabel}。`);
  } else if (best === 'fold') {
    lines.push(`這個 exact solver node 的最佳線是棄牌；你選的 ${choiceLabel} 會繼續投入，但這不是資料集標示的 optimal decision。`);
  } else if (best === 'check') {
    lines.push(`這個 exact solver node 的最佳線是過牌；你選的 ${choiceLabel} 會主動改變底池，但資料標記在這裡不需要這麼做。`);
  } else {
    lines.push(`這個 exact solver node 的最佳線是 ${bestLabel}，你選的是 ${choiceLabel}。`);
  }

  if (selected === best && !isCorrect) lines.push('你的 action 類型接近，但 sizing / exact action 不同；這題的 optimal label 對尺寸有要求。');
  lines.push('PokerBench 這筆資料只提供 exact optimal label，沒有 per-action EV 或 mixed frequency；系統不會虛構「差幾 BB」或假的 solver 頻率。');
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
  const analysis = useMemo(() => row && choice && submitted ? automaticSolverAnalysis(row, choice) : [], [row, choice, submitted]);
  const holdingCards = useMemo(() => row ? parseSolverCards(row.holding) : [], [row]);
  const boardCards = useMemo(() => row?.split === 'postflop' ? parseSolverCards(`${row.boardFlop}${row.boardTurn || ''}${row.boardRiver || ''}`) : [], [row]);
  const handStrength = useMemo(() => row ? evaluateHandStrength(holdingCards, boardCards) : null, [row, holdingCards, boardCards]);
  const handMath = useMemo(() => row ? analyzeHandMath(holdingCards, boardCards) : null, [row, holdingCards, boardCards]);

  useEffect(() => {
    if (row || !autoComplete || completionSent.current) return;
    completionSent.current = true;
    onComplete();
  }, [row, autoComplete, onComplete]);

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

  const progress = Math.round(index / Math.max(1, rows.length) * 100);
  const preflopLine = row.split === 'preflop' ? humanizeSolverPreflopLine(row.prevLine) : humanizeSolverPreflopLine(row.preflopAction);
  const postflopLine = row.split === 'postflop' ? humanizeSolverPostflopLine(row.postflopAction) : '';
  const combo = canonicalHolding(row.holding);

  return <div className="mx-auto max-w-5xl space-y-5 text-slate-100" data-testid="solver-decision-session">
    <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center gap-3"><button onClick={onExit} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-400 hover:bg-slate-800"><ArrowLeft className="h-4 w-4" />離開</button><div className="flex-1"><div className="flex justify-between text-sm"><b>{title}</b><span className="font-mono text-slate-500">{index + 1}/{rows.length}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-emerald-400" style={{ width: `${progress}%` }} /></div></div></div></header>

    <section className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 md:p-8">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">新的一手 · Solver 最佳解</div>
      <div data-testid="solver-card-table" className="mt-4 rounded-2xl border border-emerald-500/15 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),rgba(2,6,23,0.55)_65%)] p-6 text-center">
        <div data-testid="solver-board-cards" className="flex min-h-20 items-center justify-center gap-2">
          {row.split === 'postflop' && boardCards.length ? boardCards.map((card, cardIndex) => <CardUI key={`${card.rank}-${card.suit}-${cardIndex}`} card={card} size="sm" />) : <span className="rounded-xl border border-dashed border-slate-700 px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-600">Preflop</span>}
        </div>
        <div className="mt-4 text-xs uppercase tracking-[0.18em] text-emerald-400/70">Pot <span className="ml-1 font-mono text-lg font-black text-emerald-300">{row.potSize} BB</span></div>
        <div data-testid="solver-hole-cards" className="mt-6 flex items-end justify-center gap-2">{holdingCards.map((card, cardIndex) => <CardUI key={`${card.rank}-${card.suit}-${cardIndex}`} card={card} size="sm" />)}</div>
        <div className="mt-2 text-xs font-semibold text-emerald-200">Hero · {row.heroPosition} · {combo}</div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-400 sm:grid-cols-3"><span>底池 {row.potSize} BB</span><span>{row.split === 'preflop' ? `${row.numPlayers} 人桌` : row.evaluationAt}</span><span>{row.split === 'postflop' ? `位置 ${row.heroPosition}` : `加注層級 ${row.numBets}`}</span></div>
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4 text-sm leading-7 text-slate-300"><div><span className="text-slate-500">翻前：</span>{preflopLine}</div>{row.split === 'postflop' && <div className="mt-1"><span className="text-slate-500">翻後：</span>{postflopLine}</div>}</div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">{row.availableMoves.map(move => <button data-testid="solver-action" key={move} disabled={submitted} onClick={() => submit(move)} className={`rounded-xl border p-4 text-left text-sm font-semibold ${choice === move ? 'border-emerald-400/60 bg-emerald-500/12' : 'border-slate-700 bg-slate-950/35 hover:border-emerald-500/40'}`}>{humanizeSolverMove(move)}</button>)}</div>
    </section>

    {submitted && <section data-testid="solver-auto-analysis" className={`rounded-2xl border p-5 ${correct ? 'border-emerald-500/25 bg-emerald-500/6' : 'border-amber-500/25 bg-amber-500/6'}`}>
      <div className="flex gap-3">
        {correct ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-400" />}
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <div className={`font-semibold ${correct ? 'text-emerald-100' : 'text-amber-100'}`}>{correct ? '答對了 · 先看完整 Solver 解說' : '答錯 · Solver 自動分析'}</div>
            <div className="mt-2 text-sm text-slate-300">你：<b>{humanizeSolverMove(choice || '')}</b><span className="mx-2 text-slate-600">→</span>最佳解：<b className="text-emerald-300">{humanizeSolverMove(row.correctDecision)}</b></div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-200"><Lightbulb className="h-4 w-4" />這手要學什麼</div>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-300">{analysis.map(line => <li key={line}>• {line}</li>)}</ul>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-200"><Scale className="h-4 w-4" />牌力 / Range / 數學</div>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <Fact label="目前牌力" value={handStrength?.name || '未分類'} />
              <Fact label="Combo" value={combo} />
              <Fact label="位置" value={positionDescription(row.heroPosition)} />
              <Fact label="底池" value={`${row.potSize} BB`} />
            </div>
            {handStrength?.draw && <p className="mt-3 text-xs text-cyan-200/80">聽牌：{handStrength.draw}</p>}
            {handMath?.hasDraw && <p className="mt-1 text-xs text-slate-400">本機聽牌估算：{handMath.drawDescription} · {handMath.outs} outs · 下一張約 {handMath.hitProbNext}%{row.split === 'postflop' && row.evaluationAt === 'Flop' ? ` · 到 River 約 ${handMath.hitProbRiver}%` : ''}</p>}
            <p className="mt-2 text-[11px] leading-5 text-slate-600">牌力/outs 是本機結構分析；它幫你讀懂牌面，但不冒充 PokerBench 的 solver rationale。</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
            <div className="text-xs font-semibold text-slate-200">每個選項怎麼看</div>
            <div className="mt-3 space-y-2">{row.availableMoves.map(move => {
              const isBest = decisionsMatch(move, row.correctDecision);
              const isSelected = move === choice;
              const decision = parsePokerDecision(move).action;
              return <div key={move} className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs"><b className={isBest ? 'text-emerald-300' : 'text-slate-200'}>{humanizeSolverMove(move)}</b>{isBest && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">optimal label</span>}{isSelected && <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300">你的選擇</span>}</div>
                <p className="mt-1.5 text-xs leading-5 text-slate-500">{isBest ? '這是此 exact PokerBench row 唯一標示的最佳 action。' : '這個 action 在此 exact row 沒有被標為 optimal；資料集沒有提供它與最佳解之間的 EV 差，因此不虛構數字。'}{typeof decision.sizeBB === 'number' ? ` Exact sizing：${decision.sizeBB} BB。` : ''}</p>
              </div>;
            })}</div>
          </div>

          <div className="rounded-xl border border-violet-500/15 bg-violet-500/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-violet-200"><ShieldCheck className="h-4 w-4" />Solver 證據邊界</div>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <Fact label="Truth source" value={POKERBENCH_SOURCE.label} />
              <Fact label="Dataset split" value={POKERBENCH_FILES[row.split].split} />
              <Fact label="最佳解來源" value="Pinned exact optimal label" />
              <Fact label="EV / mixed frequency" value="資料未提供，因此不顯示假精度" />
            </div>
          </div>

          <AdvancedToolLinks />

          <button data-testid="solver-next" onClick={next} className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-emerald-950">看完解說，下一手</button>
        </div>
      </div>
    </section>}
  </div>;
}

function positionDescription(position: string): string {
  const normalized = position.trim().toUpperCase();
  if (normalized === 'OOP') return 'OOP · 不利位置';
  if (normalized === 'IP') return 'IP · 有利位置';
  return position || '未提供';
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-800/80 bg-slate-900/45 p-3"><div className="text-[10px] uppercase tracking-[0.14em] text-slate-600">{label}</div><div className="mt-1 text-xs leading-5 text-slate-300">{value}</div></div>;
}
