import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Brain, CheckCircle2, RotateCcw, Target } from 'lucide-react';
import { ConfidenceLevel, HistoryItem } from '../../types';
import { createAttemptId, getReviewSchedule, loadHistory, saveHistory } from '../../utils/history';
import { getDifficultyWeight, isDelayedReview, makeMasteryKey } from '../../learning-engine';
import { evRegret, evRegretScore } from '../../learning-engine/ev';
import { RANGE_QUESTIONS } from '../range/data';
import { baselineSelections, calculateRangeDecision } from '../range/rangeEngine';
import { HeroAction, RangeQuestion } from '../range/types';

const CONFIDENCE: Array<{ value: ConfidenceLevel; label: string }> = [
  { value: 1, label: '猜測' }, { value: 2, label: '不太確定' }, { value: 3, label: '大致確定' }, { value: 4, label: '非常確定' },
];

interface Variant {
  id: string;
  label: string;
  factor: number;
  potAfterBet: number;
  callCost: number;
  potOdds: number;
  callEvBB: number;
  bestAction: HeroAction;
}

function variantsFor(question: RangeQuestion): Variant[] {
  const baseline = calculateRangeDecision(question, baselineSelections(question));
  const potBeforeBet = Math.max(0.01, question.potAfterBet - question.callCost);
  return [0.5, 1, 1.75].map((factor, index) => {
    const callCost = question.callCost * factor;
    const potAfterBet = potBeforeBet + callCost;
    const potOdds = callCost / (potAfterBet + callCost) * 100;
    const callEvBB = baseline.heroEquity / 100 * (potAfterBet + callCost) - callCost;
    return {
      id: `${question.id}-${factor}`,
      label: index === 0 ? '較小下注' : index === 1 ? '原始尺寸' : '較大下注',
      factor,
      potAfterBet,
      callCost,
      potOdds,
      callEvBB,
      bestAction: callEvBB >= 0 ? 'call' : 'fold',
    };
  });
}

export function CounterfactualTrainer({ onExit }: { onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, HeroAction>>({});
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [session, setSession] = useState({ regret: 0, answered: 0 });
  const startedAt = useRef(Date.now());
  const question = RANGE_QUESTIONS[index % RANGE_QUESTIONS.length];
  const baseline = useMemo(() => calculateRangeDecision(question, baselineSelections(question)), [question]);
  const variants = useMemo(() => variantsFor(question), [question]);
  const threshold = baseline.heroEquity > 0 && baseline.heroEquity < 50
    ? (baseline.heroEquity / (1 - 2 * baseline.heroEquity / 100))
    : null;

  const submit = () => {
    if (!confidence || variants.some(variant => !answers[variant.id])) return;
    const history = loadHistory();
    const now = Date.now();
    const items: HistoryItem[] = variants.map((variant, variantIndex) => {
      const chosen = answers[variant.id];
      const bestEvBB = Math.max(0, variant.callEvBB);
      const chosenEvBB = chosen === 'call' ? variant.callEvBB : 0;
      const loss = evRegret(bestEvBB, chosenEvBB);
      const previous = history
        .filter(item => item.transferGroupId === `counterfactual-${question.id}` && item.stepId === variant.id)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
      const score = Math.round(evRegretScore(loss) / 10);
      return {
        schemaVersion: 4,
        attemptId: createAttemptId(),
        trainingType: 'counterfactual',
        scenarioId: `counterfactual-${question.id}`,
        stepId: variant.id,
        masteryKey: makeMasteryKey(`counterfactual-${question.id}`, variant.id),
        transferGroupId: `counterfactual-${question.id}`,
        skillIds: ['decision.boundary', 'math.pot-odds', 'math.equity'],
        category: [...question.category, 'Decision Boundary', 'Pot Odds'],
        score,
        judgment: chosen === variant.bestAction ? '正確' : '需要修正',
        timestamp: now + variantIndex,
        selectedAction: chosen,
        bestAction: variant.bestAction,
        position: question.heroPosition,
        durationMs: now - startedAt.current,
        confidence,
        correct: chosen === variant.bestAction,
        chosenEvBB,
        bestEvBB,
        evLossBB: loss,
        truthTier: question.source.trustTier,
        difficultyWeight: getDifficultyWeight(question.difficulty),
        isReview: Boolean(previous),
        isDelayedReview: isDelayedReview(previous, now),
        isUnseen: !previous,
        isTransferTest: variant.factor !== 1,
        questionLabel: `${question.title} · ${variant.label}`,
        notes: `固定 baseline range/equity ${baseline.heroEquity.toFixed(1)}%，只改下注尺寸，觀察決策反轉。`,
        ...getReviewSchedule(score, confidence, previous, now),
      };
    });
    saveHistory([...history, ...items]);
    setSession(previous => ({ regret: previous.regret + items.reduce((sum, item) => sum + (item.evLossBB || 0), 0), answered: previous.answered + items.length }));
    setSubmitted(true);
  };

  const next = () => {
    setIndex(previous => (previous + 1) % RANGE_QUESTIONS.length);
    setAnswers({});
    setConfidence(null);
    setSubmitted(false);
    startedAt.current = Date.now();
  };

  const averageRegret = session.answered ? session.regret / session.answered : 0;
  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onExit} className="flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
        <div className="flex gap-2 text-xs"><span className="rounded-lg bg-slate-900 px-3 py-2">題目 {index + 1}/{RANGE_QUESTIONS.length}</span><span className="rounded-lg bg-violet-500/10 px-3 py-2 text-violet-300">平均 EV regret {averageRegret.toFixed(3)}BB</span></div>
      </header>

      <section className="rounded-3xl border border-violet-500/20 bg-[linear-gradient(135deg,rgba(139,92,246,0.13),rgba(15,23,42,0.75))] p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300"><Brain className="h-4 w-4" />Counterfactual Decision Boundary</div>
        <h1 className="mt-3 text-3xl font-bold">{question.title}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">固定對手基準範圍與 Hero Equity，只改下注尺寸。你的目標不是背答案，而是找出 Call / Fold 反轉的邊界。</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Baseline Equity" value={`${baseline.heroEquity.toFixed(1)}%`} /><Metric label="原始 Pot Odds" value={`${baseline.potOdds.toFixed(1)}%`} /><Metric label="Truth" value={question.source.trustTier} /></div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">{variants.map(variant => {
        const answer = answers[variant.id];
        const correct = submitted && answer === variant.bestAction;
        const wrong = submitted && answer !== variant.bestAction;
        return <div key={variant.id} className={`rounded-2xl border p-5 ${correct ? 'border-emerald-500/40 bg-emerald-500/7' : wrong ? 'border-red-500/35 bg-red-500/6' : 'border-slate-800 bg-slate-900/55'}`}>
          <div className="flex items-center justify-between"><h2 className="font-semibold">{variant.label}</h2><span className="font-mono text-xs text-slate-500">×{variant.factor}</span></div>
          <div className="mt-4 space-y-2 text-sm text-slate-400"><Row label="跟注成本" value={`${variant.callCost.toFixed(2)}BB`} /><Row label="Pot Odds" value={`${variant.potOdds.toFixed(1)}%`} /><Row label="固定 Equity" value={`${baseline.heroEquity.toFixed(1)}%`} /></div>
          <div className="mt-5 grid grid-cols-2 gap-2">{(['fold', 'call'] as HeroAction[]).map(action => <button key={action} type="button" disabled={submitted} onClick={() => setAnswers(previous => ({ ...previous, [variant.id]: action }))} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${answer === action ? 'border-violet-400 bg-violet-500/15 text-violet-200' : 'border-slate-700 bg-slate-950/40 text-slate-300'}`}>{action === 'call' ? 'Call' : 'Fold'}</button>)}</div>
          {submitted && <div className="mt-4 rounded-xl bg-slate-950/45 p-3 text-xs leading-6 text-slate-300"><div>最佳：<b>{variant.bestAction.toUpperCase()}</b></div><div>Call EV：{variant.callEvBB.toFixed(3)}BB</div><div>你的 EV regret：{evRegret(Math.max(0, variant.callEvBB), answer === 'call' ? variant.callEvBB : 0).toFixed(3)}BB</div></div>}
        </div>;
      })}</section>

      {!submitted ? <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="text-sm font-semibold">你有多確定？</div><div className="mt-3 grid gap-2 sm:grid-cols-4">{CONFIDENCE.map(item => <button key={item.value} type="button" onClick={() => setConfidence(item.value)} className={`rounded-xl border px-3 py-3 text-sm ${confidence === item.value ? 'border-amber-400/60 bg-amber-400/10 text-amber-200' : 'border-slate-700 text-slate-400'}`}>{item.label}</button>)}</div><button type="button" onClick={submit} disabled={!confidence || variants.some(variant => !answers[variant.id])} className="mt-4 w-full rounded-xl bg-violet-500 px-5 py-3 font-semibold text-white disabled:opacity-40">提交三個反事實決策</button></section>
      : <section className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/6 p-5"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-emerald-400" />決策邊界回饋</div><p className="mt-3 text-sm leading-7 text-slate-300">當 Pot Odds 高於固定 Equity 時，Call EV 轉負；低於時則轉正。這一題已用不同下注尺寸記成 transfer test，而不是同題重做。</p>{threshold && <p className="mt-2 text-xs text-slate-500">以目前 Equity 推估，臨界下注成本相對原底池約落在 {threshold.toFixed(1)}% 的量級；真正決策仍以 Pot Odds 與 Equity 比較為準。</p>}<div className="mt-4 flex gap-3"><button type="button" onClick={next} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950">下一個邊界</button><button type="button" onClick={() => { setAnswers({}); setConfidence(null); setSubmitted(false); }} className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm"><RotateCcw className="h-4 w-4" />重做</button></div></section>}
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-lg font-bold">{value}</div></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between"><span>{label}</span><span className="font-mono text-slate-200">{value}</span></div>; }
