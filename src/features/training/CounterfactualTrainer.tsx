import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Brain, CheckCircle2, Layers3, RotateCcw, Ruler } from 'lucide-react';
import { ConfidenceLevel, HistoryItem } from '../../types';
import { createAttemptId, getReviewSchedule, loadHistory, saveHistory } from '../../utils/history';
import { getDifficultyWeight, isDelayedReview, makeMasteryKey } from '../../learning-engine';
import { evRegret, evRegretScore } from '../../learning-engine/ev';
import { RANGE_QUESTIONS } from '../range/data';
import { baselineSelections, calculateRangeDecision } from '../range/rangeEngine';
import { HeroAction, RangeBucket, RangeQuestion, WeightedRangeSelection } from '../range/types';

const CONFIDENCE: Array<{ value: ConfidenceLevel; label: string }> = [
  { value: 1, label: '猜測' }, { value: 2, label: '不太確定' }, { value: 3, label: '大致確定' }, { value: 4, label: '非常確定' },
];
type Dimension = 'bet-size' | 'range-width';
interface Variant {
  id: string;
  label: string;
  detail: string;
  heroEquity: number;
  potOdds: number;
  callEvBB: number;
  bestAction: HeroAction;
  sizePot?: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const BUCKET_MULTIPLIERS: Record<'tight' | 'wide', Record<RangeBucket, number>> = {
  tight: { monster: 1, strong: 0.92, medium: 0.55, draw: 0.48, air: 0.25 },
  wide: { monster: 1, strong: 1.08, medium: 1.35, draw: 1.6, air: 2 },
};

function betSizeVariants(question: RangeQuestion): Variant[] {
  const baseline = calculateRangeDecision(question, baselineSelections(question));
  const potBeforeBet = Math.max(0.01, question.potAfterBet - question.callCost);
  return [0.5, 1, 1.75].map((factor, index) => {
    const callCost = question.callCost * factor;
    const potAfterBet = potBeforeBet + callCost;
    const potOdds = callCost / (potAfterBet + callCost) * 100;
    const callEvBB = baseline.heroEquity / 100 * (potAfterBet + callCost) - callCost;
    return {
      id: `size-${factor}`,
      label: index === 0 ? '較小下注' : index === 1 ? '原始尺寸' : '較大下注',
      detail: `${Math.round(callCost / potBeforeBet * 100)}% pot facing size`,
      heroEquity: baseline.heroEquity,
      potOdds,
      callEvBB,
      bestAction: callEvBB >= 0 ? 'call' : 'fold',
      sizePot: callCost / potBeforeBet * 100,
    };
  });
}

function rangeSelections(question: RangeQuestion, mode: 'tight' | 'baseline' | 'wide'): WeightedRangeSelection[] {
  if (mode === 'baseline') return baselineSelections(question);
  return question.options.map(option => ({
    hand: option.hand,
    frequency: clamp01(option.baselineFrequency * BUCKET_MULTIPLIERS[mode][option.bucket]),
  }));
}

function rangeWidthVariants(question: RangeQuestion): Variant[] {
  return (['tight', 'baseline', 'wide'] as const).map(mode => {
    const calculation = calculateRangeDecision(question, rangeSelections(question, mode));
    return {
      id: `range-${mode}`,
      label: mode === 'tight' ? 'Value-heavy / Tight' : mode === 'wide' ? 'Bluff-heavy / Wide' : 'Baseline Range',
      detail: mode === 'tight' ? '弱牌、draw、air 權重大幅降低' : mode === 'wide' ? 'medium、draw、air 權重提高' : '題庫基準權重',
      heroEquity: calculation.heroEquity,
      potOdds: calculation.potOdds,
      callEvBB: calculation.callEvBB,
      bestAction: calculation.bestAction,
    };
  });
}

export function CounterfactualTrainer({ onExit }: { onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [dimension, setDimension] = useState<Dimension>('bet-size');
  const [answers, setAnswers] = useState<Record<string, HeroAction>>({});
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [session, setSession] = useState({ regret: 0, answered: 0 });
  const startedAt = useRef(Date.now());
  const question = RANGE_QUESTIONS[index % RANGE_QUESTIONS.length];
  const baseline = useMemo(() => calculateRangeDecision(question, baselineSelections(question)), [question]);
  const variants = useMemo(() => dimension === 'bet-size' ? betSizeVariants(question) : rangeWidthVariants(question), [question, dimension]);

  const resetAnswers = (nextDimension?: Dimension) => {
    if (nextDimension) setDimension(nextDimension);
    setAnswers({}); setConfidence(null); setSubmitted(false); startedAt.current = Date.now();
  };

  const submit = () => {
    if (!confidence || variants.some(variant => !answers[variant.id])) return;
    const history = loadHistory();
    const now = Date.now();
    const groupId = `counterfactual-${question.id}-${dimension}`;
    const items: HistoryItem[] = variants.map((variant, variantIndex) => {
      const chosen = answers[variant.id];
      const bestEvBB = Math.max(0, variant.callEvBB);
      const chosenEvBB = chosen === 'call' ? variant.callEvBB : 0;
      const loss = evRegret(bestEvBB, chosenEvBB);
      const previous = history.filter(item => item.transferGroupId === groupId && item.stepId === variant.id).sort((a, b) => b.timestamp - a.timestamp)[0];
      const score = Math.round(evRegretScore(loss) / 10);
      return {
        schemaVersion: 4,
        attemptId: createAttemptId(),
        trainingType: 'counterfactual',
        scenarioId: `counterfactual-${question.id}`,
        stepId: variant.id,
        masteryKey: makeMasteryKey(`counterfactual-${question.id}`, `${dimension}-${variant.id}`),
        transferGroupId: groupId,
        skillIds: ['decision.boundary', 'math.pot-odds', 'math.equity', ...(dimension === 'range-width' ? ['range.construction'] : ['postflop.bet-sizing'])],
        situationIds: [
          dimension === 'bet-size' && variant.sizePot && variant.sizePot >= 100 ? 'situation.size.overbet' : dimension === 'bet-size' && variant.sizePot && variant.sizePot >= 66 ? 'situation.size.large' : dimension === 'bet-size' ? 'situation.size.small' : 'situation.range-width',
        ],
        category: [...question.category, 'Decision Boundary', dimension === 'bet-size' ? 'Bet Sizing' : 'Range Sensitivity'],
        score,
        judgment: chosen === variant.bestAction ? '正確' : '需要修正',
        timestamp: now + variantIndex,
        selectedAction: chosen,
        bestAction: variant.bestAction,
        selectedDecision: { type: chosen },
        bestDecision: { type: variant.bestAction },
        position: question.heroPosition,
        durationMs: now - startedAt.current,
        confidence,
        correct: chosen === variant.bestAction,
        chosenEvBB,
        bestEvBB,
        evLossBB: loss,
        truthTier: question.source.trustTier,
        spotFrequencyPer100Hands: /River/i.test(question.title) ? 0.5 : /Turn/i.test(question.title) ? 1.2 : 1.8,
        difficultyWeight: getDifficultyWeight(question.difficulty),
        isReview: Boolean(previous),
        isDelayedReview: isDelayedReview(previous, now),
        isUnseen: !previous,
        isTransferTest: variant.id !== (dimension === 'bet-size' ? 'size-1' : 'range-baseline'),
        questionLabel: `${question.title} · ${variant.label}`,
        notes: dimension === 'bet-size'
          ? `固定 baseline range/equity ${baseline.heroEquity.toFixed(1)}%，只改下注尺寸。`
          : `固定下注尺寸，只改 Villain range composition；Hero Equity 從 ${variant.heroEquity.toFixed(1)}% 重新加權。`,
        ...getReviewSchedule(score, confidence, previous, now),
      } satisfies HistoryItem;
    });
    saveHistory([...history, ...items]);
    setSession(previous => ({ regret: previous.regret + items.reduce((sum, item) => sum + (item.evLossBB || 0), 0), answered: previous.answered + items.length }));
    setSubmitted(true);
  };

  const next = () => {
    setIndex(previous => (previous + 1) % RANGE_QUESTIONS.length);
    resetAnswers();
  };

  const averageRegret = session.answered ? session.regret / session.answered : 0;
  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onExit} className="pc-interactive flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
        <div className="flex gap-2 text-xs"><span className="rounded-lg bg-slate-900 px-3 py-2">題目 {index + 1}/{RANGE_QUESTIONS.length}</span><span className="rounded-lg bg-violet-500/10 px-3 py-2 text-violet-300">平均 EV regret {averageRegret.toFixed(3)}BB</span></div>
      </header>

      <section className="pc-hero-glow rounded-3xl border border-violet-500/20 bg-[linear-gradient(135deg,rgba(139,92,246,0.13),rgba(15,23,42,0.75))] p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300"><Brain className="h-4 w-4" />Counterfactual Decision Boundary</div>
        <h1 className="mt-3 text-3xl font-bold">{question.title}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">一次只改一個因果變數：下注尺寸，或 Villain range composition。你要找的是答案「在哪裡反轉」，不是記住一個靜態答案。</p>
        <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => resetAnswers('bet-size')} className={`pc-interactive flex items-center gap-2 rounded-xl border px-4 py-2 text-sm ${dimension === 'bet-size' ? 'border-violet-400/50 bg-violet-500/15 text-violet-200' : 'border-slate-700 text-slate-400'}`}><Ruler className="h-4 w-4" />下注尺寸</button><button type="button" onClick={() => resetAnswers('range-width')} className={`pc-interactive flex items-center gap-2 rounded-xl border px-4 py-2 text-sm ${dimension === 'range-width' ? 'border-blue-400/50 bg-blue-500/15 text-blue-200' : 'border-slate-700 text-slate-400'}`}><Layers3 className="h-4 w-4" />對手範圍</button></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Baseline Equity" value={`${baseline.heroEquity.toFixed(1)}%`} /><Metric label="原始 Pot Odds" value={`${baseline.potOdds.toFixed(1)}%`} /><Metric label="Truth" value={question.source.trustTier} /></div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">{variants.map(variant => {
        const answer = answers[variant.id];
        const correct = submitted && answer === variant.bestAction;
        const wrong = submitted && answer !== variant.bestAction;
        return <div key={variant.id} className={`pc-card-lift rounded-2xl border p-5 ${correct ? 'border-emerald-500/40 bg-emerald-500/7' : wrong ? 'border-red-500/35 bg-red-500/6' : 'border-slate-800 bg-slate-900/55'}`}>
          <h2 className="font-semibold">{variant.label}</h2><p className="mt-1 min-h-8 text-xs leading-5 text-slate-500">{variant.detail}</p>
          <div className="mt-4 space-y-2 text-sm text-slate-400"><Row label="Hero Equity" value={`${variant.heroEquity.toFixed(1)}%`} /><Row label="Pot Odds" value={`${variant.potOdds.toFixed(1)}%`} />{variant.sizePot !== undefined && <Row label="Facing size" value={`${variant.sizePot.toFixed(0)}% pot`} />}</div>
          <div className="mt-5 grid grid-cols-2 gap-2">{(['fold', 'call'] as HeroAction[]).map(action => <button key={action} type="button" disabled={submitted} onClick={() => setAnswers(previous => ({ ...previous, [variant.id]: action }))} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${answer === action ? 'border-violet-400 bg-violet-500/15 text-violet-200' : 'border-slate-700 bg-slate-950/40 text-slate-300'}`}>{action === 'call' ? 'Call' : 'Fold'}</button>)}</div>
          {submitted && <div className="mt-4 rounded-xl bg-slate-950/45 p-3 text-xs leading-6 text-slate-300"><div>最佳：<b>{variant.bestAction.toUpperCase()}</b></div><div>Call EV：{variant.callEvBB.toFixed(3)}BB</div><div>你的 EV regret：{evRegret(Math.max(0, variant.callEvBB), answer === 'call' ? variant.callEvBB : 0).toFixed(3)}BB</div></div>}
        </div>;
      })}</section>

      {!submitted ? <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="text-sm font-semibold">你有多確定？</div><div className="mt-3 grid gap-2 sm:grid-cols-4">{CONFIDENCE.map(item => <button key={item.value} type="button" onClick={() => setConfidence(item.value)} className={`rounded-xl border px-3 py-3 text-sm ${confidence === item.value ? 'border-amber-400/60 bg-amber-400/10 text-amber-200' : 'border-slate-700 text-slate-400'}`}>{item.label}</button>)}</div><button type="button" onClick={submit} disabled={!confidence || variants.some(variant => !answers[variant.id])} className="pc-interactive pc-shimmer mt-4 w-full rounded-xl bg-violet-500 px-5 py-3 font-semibold text-white disabled:opacity-40">提交三個反事實決策</button></section>
      : <section className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/6 p-5"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-emerald-400" />決策邊界回饋</div><p className="mt-3 text-sm leading-7 text-slate-300">{dimension === 'bet-size' ? 'Bet size 改變 Pot Odds，所以同一手牌可能跨過 Call/Fold 邊界。' : 'Villain range composition 改變 Hero Equity；同樣下注尺寸下，value/bluff 密度變化也能讓答案反轉。'}</p><div className="mt-4 flex gap-3"><button type="button" onClick={next} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950">下一個邊界</button><button type="button" onClick={() => resetAnswers()} className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm"><RotateCcw className="h-4 w-4" />重做</button></div></section>}
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-lg font-bold">{value}</div></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between"><span>{label}</span><span className="font-mono text-slate-200">{value}</span></div>; }
