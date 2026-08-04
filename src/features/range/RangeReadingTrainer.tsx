import { ReactNode, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BarChart3, Brain, CheckCircle2, RotateCcw, Target, XCircle,
} from 'lucide-react';
import { getDifficultyWeight, isDelayedReview, makeMasteryKey } from '../../learning-engine';
import { createAttemptId, getReviewSchedule, loadHistory, saveHistory } from '../../utils/history';
import { ConfidenceLevel, FeedbackQuality, HistoryItem } from '../../types';
import { RANGE_QUESTIONS } from './data';
import {
  EQUITY_BANDS,
  actionEvLossBB,
  baselineSelections,
  calculateRangeDecision,
  getRangeBias,
  scoreAction,
  scoreEquityBand,
  scorePotOddsEstimate,
  scoreRangeConstruction,
} from './rangeEngine';
import {
  EquityBand, HeroAction, RangeBucket, RangeFrequency, WeightedRangeSelection,
} from './types';

const BUCKET_LABELS: Record<RangeBucket, string> = {
  monster: '超強牌', strong: '強牌', medium: '中等牌', draw: '聽牌', air: '空氣／詐唬',
};
const FREQUENCY_LABELS: Record<RangeFrequency, string> = { 0: '排除', 0.5: '部分', 1: '全部' };
const ACTION_LABELS: Record<HeroAction, string> = { fold: 'Fold', call: 'Call' };
const CONFIDENCE: Array<{ value: ConfidenceLevel; label: string }> = [
  { value: 1, label: '猜測' }, { value: 2, label: '不太確定' },
  { value: 3, label: '大致確定' }, { value: 4, label: '非常確定' },
];
type Phase = 'range' | 'decision' | 'result';
type DimensionId = 'range-construction' | 'equity-estimation' | 'pot-odds' | 'final-action';

function nextFrequency(value: RangeFrequency): RangeFrequency {
  return value === 0 ? 0.5 : value === 0.5 ? 1 : 0;
}

function qualityFromScore(score: number): FeedbackQuality {
  if (score >= 90) return 'best';
  if (score >= 80) return 'acceptable';
  if (score >= 50) return 'suboptimal';
  return 'major-error';
}

function judgmentFromScore(score: number): string {
  if (score >= 90) return '正確';
  if (score >= 80) return '可接受';
  if (score >= 50) return '需要修正';
  return '錯誤';
}

export function RangeReadingTrainer({ onExit }: { onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [weights, setWeights] = useState<Record<string, RangeFrequency>>({});
  const [selectedEquity, setSelectedEquity] = useState<EquityBand | null>(null);
  const [potOddsInput, setPotOddsInput] = useState('');
  const [selectedAction, setSelectedAction] = useState<HeroAction | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [phase, setPhase] = useState<Phase>('range');
  const [session, setSession] = useState({ score: 0, answered: 0 });
  const recordedRef = useRef(false);
  const question = RANGE_QUESTIONS[index];

  const selections = useMemo<WeightedRangeSelection[]>(
    () => question.options.map(option => ({ hand: option.hand, frequency: weights[option.hand] || 0 })),
    [question, weights],
  );
  const calculation = useMemo(() => calculateRangeDecision(question, selections), [question, selections]);
  const baseline = useMemo(() => calculateRangeDecision(question, baselineSelections(question)), [question]);
  const rangeScore = useMemo(() => scoreRangeConstruction(question, selections), [question, selections]);
  const equityScore = scoreEquityBand(selectedEquity, calculation.heroEquity);
  const parsedPotOdds = potOddsInput.trim() === '' ? null : Number(potOddsInput);
  const potOddsScore = scorePotOddsEstimate(parsedPotOdds, calculation.potOdds);
  const actionScore = scoreAction(selectedAction, calculation.bestAction);
  const totalScore = Math.round(rangeScore * 0.4 + equityScore * 0.2 + potOddsScore * 0.15 + actionScore * 0.25);

  const cycleWeight = (hand: string) => {
    if (phase !== 'range') return;
    setWeights(previous => ({ ...previous, [hand]: nextFrequency(previous[hand] || 0) }));
  };

  const recordLearning = () => {
    if (!confidence || recordedRef.current) return;
    const history = loadHistory();
    const now = Date.now();
    const bias = getRangeBias(question, selections);
    const dimensions: Array<{ id: DimensionId; score: number; category: string; evLossBB?: number }> = [
      { id: 'range-construction', score: rangeScore, category: '範圍建構' },
      { id: 'equity-estimation', score: equityScore, category: 'Equity 估算' },
      { id: 'pot-odds', score: potOddsScore, category: 'Pot Odds' },
      { id: 'final-action', score: actionScore, category: '對抗決策', evLossBB: actionEvLossBB(selectedAction, calculation) },
    ];

    const items: HistoryItem[] = dimensions.map((dimension, dimensionIndex) => {
      const scenarioId = `range-${question.id}`;
      const masteryKey = makeMasteryKey(scenarioId, dimension.id);
      const previous = history
        .filter(item => item.masteryKey === masteryKey)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
      const score10 = Math.round(dimension.score / 10);
      return {
        schemaVersion: 4,
        attemptId: createAttemptId(),
        trainingType: 'range',
        scenarioId,
        stepId: dimension.id,
        masteryKey,
        category: [...question.category, dimension.category],
        score: score10,
        judgment: judgmentFromScore(dimension.score),
        timestamp: now + dimensionIndex,
        selectedAction: dimension.id === 'final-action' ? selectedAction || undefined : undefined,
        bestAction: dimension.id === 'final-action' ? calculation.bestAction : undefined,
        position: question.heroPosition,
        confidence,
        correct: dimension.score >= 80,
        feedbackQuality: qualityFromScore(dimension.score),
        evLossBB: dimension.evLossBB,
        difficultyWeight: getDifficultyWeight(question.difficulty),
        isReview: Boolean(previous),
        isDelayedReview: isDelayedReview(previous, now),
        isUnseen: !previous,
        questionLabel: `${question.title} · ${dimension.category}`,
        notes: `範圍${bias}；Hero Equity ${calculation.heroEquity.toFixed(1)}%；Pot Odds ${calculation.potOdds.toFixed(1)}%；Call EV ${calculation.callEvBB.toFixed(2)}BB。`,
        ...getReviewSchedule(score10, confidence, previous, now),
      };
    });

    saveHistory([...history, ...items]);
    recordedRef.current = true;
  };

  const submitDecision = () => {
    if (!selectedEquity || parsedPotOdds === null || !selectedAction || !confidence) return;
    recordLearning();
    setSession(previous => ({ score: previous.score + totalScore, answered: previous.answered + 1 }));
    setPhase('result');
  };

  const resetQuestion = () => {
    setWeights({});
    setSelectedEquity(null);
    setPotOddsInput('');
    setSelectedAction(null);
    setConfidence(null);
    setPhase('range');
    recordedRef.current = false;
  };

  const next = () => {
    setIndex(previous => (previous + 1) % RANGE_QUESTIONS.length);
    resetQuestion();
  };

  const resetSession = () => {
    setIndex(0);
    setSession({ score: 0, answered: 0 });
    resetQuestion();
  };

  const average = session.answered ? Math.round(session.score / session.answered) : 0;
  const selectedCombos = calculation.weightedCombos;
  const baselineByHand = new Map(question.options.map(option => [option.hand, option.baselineFrequency]));
  const missed = question.options.filter(option => option.baselineFrequency >= 0.5 && (weights[option.hand] || 0) === 0).map(option => option.hand);
  const extras = question.options.filter(option => (weights[option.hand] || 0) > (baselineByHand.get(option.hand) || 0) + 0.25).map(option => option.hand);

  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <button type="button" onClick={onExit} className="flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
        <div className="flex flex-wrap gap-2 text-sm"><span className="rounded-xl bg-slate-900 px-4 py-2">題目 {index + 1}/{RANGE_QUESTIONS.length}</span><span className="rounded-xl bg-emerald-500/10 px-4 py-2 text-emerald-300">平均 {average} 分</span><span className="rounded-xl bg-blue-500/10 px-4 py-2 text-blue-300">{phase === 'range' ? '① 加權範圍' : phase === 'decision' ? '② 數學與決策' : '③ 學習回饋'}</span></div>
      </header>

      <section className="rounded-3xl border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(15,23,42,0.75))] p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400"><Brain className="h-4 w-4" />Weighted Range Versus Hand</div>
        <h1 className="mt-3 text-3xl font-bold">{question.title}</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400"><span>{question.table}</span><span>·</span><span>{question.stack}</span><span>·</span><span>{question.villain}</span></div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">{question.action.map((line, lineIndex) => <div key={line} className="rounded-xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm"><span className="mr-2 font-mono text-emerald-400">{lineIndex + 1}</span>{line}</div>)}</div>
        <div className="mt-5 flex flex-wrap gap-3"><InfoCard label={`Hero · ${question.heroPosition}`} value={question.heroHand} />{question.board && <InfoCard label="Board" value={question.board} />}</div>
        <p className="mt-6 text-lg font-semibold">{question.prompt}</p>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-4"><div><h2 className="font-semibold">① 為每一類牌設定出現權重</h2><p className="mt-1 text-xs text-slate-500">每點一次依序切換：排除 → 部分（50%）→ 全部（100%）。Combo 越多，對整體 Equity 影響越大。</p></div><span className="shrink-0 text-xs text-slate-500">加權 {selectedCombos.toFixed(1)} combos</span></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{question.options.map(option => {
          const frequency = weights[option.hand] || 0;
          const active = frequency > 0;
          const baselineFrequency = option.baselineFrequency;
          const state = phase === 'result'
            ? Math.abs(frequency - baselineFrequency) <= 0.25 ? 'border-emerald-500/50 bg-emerald-500/8' : 'border-amber-500/50 bg-amber-500/8'
            : active ? 'border-blue-500/60 bg-blue-500/10' : 'border-slate-800 bg-slate-900/50';
          return <button key={option.hand} type="button" disabled={phase !== 'range'} onClick={() => cycleWeight(option.hand)} className={`rounded-2xl border p-4 text-left transition ${state}`}>
            <div className="flex items-center justify-between"><span className="font-mono text-xl font-bold">{option.hand}</span><span className={`rounded-lg px-2 py-1 text-xs font-semibold ${active ? 'bg-blue-500/15 text-blue-200' : 'bg-slate-800 text-slate-500'}`}>{FREQUENCY_LABELS[frequency]}</span></div>
            <div className="mt-2 flex justify-between text-xs text-slate-500"><span>{BUCKET_LABELS[option.bucket]}</span><span>{option.combos} combos</span></div>
            {phase === 'result' && <div className="mt-2 text-[11px] text-slate-600">教學基準權重 {Math.round(baselineFrequency * 100)}%</div>}
          </button>;
        })}</div>
      </section>

      {phase !== 'range' && <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6">
        <div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-400" /><h2 className="font-semibold">② 不看答案，先完成數學與決策</h2></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><MetricInput label="目前底池（含對手下注）" value={`${question.potAfterBet}BB`} /><MetricInput label="Hero 跟注成本" value={`${question.callCost}BB`} /></div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div><div className="mb-3 text-sm font-semibold">Hero 對你所建範圍的 Equity</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-2 xl:grid-cols-5">{EQUITY_BANDS.map(band => <button key={band.id} type="button" disabled={phase === 'result'} onClick={() => setSelectedEquity(band.id)} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${selectedEquity === band.id ? 'border-blue-500 bg-blue-500/15 text-blue-200' : 'border-slate-800 bg-slate-950/40 text-slate-400'}`}>{band.label}</button>)}</div></div>
          <div><label className="mb-3 block text-sm font-semibold" htmlFor="pot-odds-estimate">Pot Odds 估計</label><div className="relative"><input id="pot-odds-estimate" type="number" min="0" max="100" step="0.1" disabled={phase === 'result'} value={potOddsInput} onChange={event => setPotOddsInput(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 pr-10 font-mono text-lg outline-none focus:border-blue-500" placeholder="例如 37.5" /><span className="absolute right-4 top-3.5 text-slate-500">%</span></div></div>
          <div><div className="mb-3 text-sm font-semibold">最佳動作</div><div className="grid grid-cols-2 gap-2">{(['fold', 'call'] as HeroAction[]).map(action => <button key={action} type="button" disabled={phase === 'result'} onClick={() => setSelectedAction(action)} className={`rounded-xl border px-4 py-3 text-sm font-bold ${selectedAction === action ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200' : 'border-slate-800 bg-slate-950/40 text-slate-400'}`}>{ACTION_LABELS[action]}</button>)}</div></div>
          <div><div className="mb-3 text-sm font-semibold">作答信心</div><div className="grid grid-cols-2 gap-2">{CONFIDENCE.map(item => <button key={item.value} type="button" disabled={phase === 'result'} onClick={() => setConfidence(item.value)} className={`rounded-xl border px-3 py-3 text-sm ${confidence === item.value ? 'border-amber-400 bg-amber-400/10 text-amber-200' : 'border-slate-800 bg-slate-950/40 text-slate-400'}`}>{item.label}</button>)}</div></div>
        </div>
      </section>}

      {phase === 'result' && <section className="mt-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><ResultMetric label="總分" value={`${totalScore}/100`} detail="四項學習節點" /><ResultMetric label="範圍品質" value={`${rangeScore}%`} detail={`你的範圍${getRangeBias(question, selections)}`} /><ResultMetric label="動態 Equity" value={`${calculation.heroEquity.toFixed(1)}%`} detail={`基準 ${baseline.heroEquity.toFixed(1)}%`} /><ResultMetric label="Pot Odds" value={`${calculation.potOdds.toFixed(1)}%`} detail={`你的答案 ${parsedPotOdds?.toFixed(1)}%`} /><ResultMetric label="Call EV" value={`${calculation.callEvBB >= 0 ? '+' : ''}${calculation.callEvBB.toFixed(2)}BB`} detail={`最佳 ${ACTION_LABELS[calculation.bestAction]}`} /></div>
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"><div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"><div className="flex items-center gap-3"><Target className="h-6 w-6 text-emerald-400" /><div><div className="text-sm text-slate-400">由你所建範圍計算</div><div className="mt-1 text-2xl font-bold">{ACTION_LABELS[calculation.bestAction]}</div></div></div><p className="mt-4 text-sm leading-7 text-slate-300">{question.explanation}</p>{question.blockerNote && <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/8 p-4 text-sm leading-6 text-blue-100"><span className="font-semibold">Blocker：</span>{question.blockerNote}</div>}</div><div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"><h3 className="font-semibold">範圍誤差診斷</h3><FeedbackLine icon={missed.length ? <XCircle className="h-4 w-4 text-amber-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />} label="漏掉的基準區" value={missed.length ? missed.join('、') : '沒有明顯漏選'} /><FeedbackLine icon={extras.length ? <XCircle className="h-4 w-4 text-red-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />} label="權重過高" value={extras.length ? extras.join('、') : '沒有明顯過選'} /><FeedbackLine icon={<Brain className="h-4 w-4 text-blue-400" />} label="學習紀錄" value="已拆成範圍、Equity、Pot Odds、最終動作四個 Mastery 節點。" /></div></div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/7 p-4 text-xs leading-6 text-amber-100/80"><div className="font-semibold">資料可信度：{question.source.trustTier}</div><div>{question.source.disclaimer}</div><div className="mt-1">假設：{question.assumptions.join('；')}</div></div>
      </section>}

      <footer className="mt-6 flex flex-wrap justify-between gap-3">
        <button type="button" onClick={resetSession} className="flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-3 text-sm text-slate-400"><RotateCcw className="h-4 w-4" />重置本次分數</button>
        {phase === 'range' && <button type="button" disabled={selectedCombos <= 0} onClick={() => setPhase('decision')} className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40">鎖定加權範圍</button>}
        {phase === 'decision' && <button type="button" disabled={!selectedEquity || parsedPotOdds === null || !Number.isFinite(parsedPotOdds) || !selectedAction || !confidence} onClick={submitDecision} className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40">提交並寫入學習紀錄</button>}
        {phase === 'result' && <button type="button" onClick={next} className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-emerald-950">下一題</button>}
      </footer>
    </div>
  </div>;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3"><div className="text-xs text-blue-300">{label}</div><div className="mt-1 font-mono text-xl font-bold tracking-wide">{value}</div></div>;
}
function MetricInput({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-950/50 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-2xl font-bold">{value}</div></div>;
}
function ResultMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-2xl font-bold">{value}</div><div className="mt-2 text-xs text-slate-500">{detail}</div></div>;
}
function FeedbackLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="mt-4 flex items-start gap-3"><span className="mt-0.5">{icon}</span><div><div className="text-xs font-semibold text-slate-400">{label}</div><div className="mt-1 text-sm leading-6 text-slate-300">{value}</div></div></div>;
}
