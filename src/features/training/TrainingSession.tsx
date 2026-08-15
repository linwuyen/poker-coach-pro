import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Brain, CheckCircle2, Clock3, Lightbulb, RotateCcw, ShieldQuestion, XCircle } from 'lucide-react';
import { CardUI } from '../../components/CardUI';
import { ActionType, ConfidenceLevel, Feedback, HistoryItem, Scenario } from '../../types';
import { createAttemptId, getReviewSchedule } from '../../utils/history';
import {
  buildSessionLearningSummary,
  getDifficultyWeight,
  getHistoryMasteryKey,
  isDelayedReview,
  makeMasteryKey,
  resolveFeedbackQuality,
} from '../../learning-engine';
import { scenarioContextFamilyId, inferSituationIdsFromScenario } from '../../learning-engine/contextIdentity';
import { companionStateFromScenario } from '../../companion/adapters';
import { clearCompanionHandState, publishCompanionHandState } from '../../companion/handStateBus';
import { CoachDrawer } from '../coach/CoachDrawer';

interface TrainingSessionProps {
  scenarios: Scenario[];
  history: HistoryItem[];
  title: string;
  onRecord: (item: HistoryItem) => void;
  onExit: () => void;
  onComplete: () => void;
}

const ACTION_LABELS: Partial<Record<ActionType, string>> = {
  Fold: '棄牌', Call: '跟注', Raise: '加注', '3-bet': '3-Bet', '4-bet (Raise)': '4-Bet',
  'All-in': '全下', Check: '過牌', 'Bet small': '小注', 'Bet half pot': '半池', 'Bet big': '大注',
};
const CONFIDENCE: Array<{ value: ConfidenceLevel; label: string; hint: string }> = [
  { value: 1, label: '猜測', hint: '不到 50%' }, { value: 2, label: '不太確定', hint: '約 55%' },
  { value: 3, label: '大致確定', hint: '約 75%' }, { value: 4, label: '非常確定', hint: '約 90%' },
];

export function TrainingSession({ scenarios, history, title, onRecord, onExit, onComplete }: TrainingSessionProps) {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [sessionItems, setSessionItems] = useState<HistoryItem[]>([]);
  const [coachOpen, setCoachOpen] = useState(false);
  const startedAt = useRef(Date.now());

  const scenario = scenarios[scenarioIndex];
  const step = scenario?.steps[stepIndex];
  const progress = scenarios.length > 0 ? ((scenarioIndex + (feedback ? 1 : 0)) / scenarios.length) * 100 : 0;
  const summary = useMemo(() => buildSessionLearningSummary(sessionItems), [sessionItems]);
  const currentMasteryKey = scenario && step ? makeMasteryKey(scenario.id, step.id) : '';
  const latestPrevious = useMemo(() => history
    .filter(item => getHistoryMasteryKey(item) === currentMasteryKey)
    .sort((a, b) => b.timestamp - a.timestamp)[0], [history, currentMasteryKey]);

  useEffect(() => {
    if (!scenario || !step) {
      clearCompanionHandState();
      return;
    }
    publishCompanionHandState(companionStateFromScenario(scenario, stepIndex, {
      mode: 'training',
      handComplete: Boolean(feedback),
      decisionLocked: !feedback,
    }));
  }, [scenario, step, stepIndex, feedback]);

  useEffect(() => () => clearCompanionHandState(), []);

  if (!scenario || !step) {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
        <div className="text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" /><h2 className="mt-4 text-2xl font-semibold">訓練完成</h2><p className="mt-2 text-sm text-slate-400">這裡顯示學習結果，不只顯示刷題分數。</p></div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryMetric label="本次正確率" value={`${summary.accuracy}%`} />
          <SummaryMetric label="未見題正確率" value={`${summary.unseenAccuracy}%`} />
          <SummaryMetric label="延遲留存" value={`${summary.delayedRetention}%`} />
          <SummaryMetric label="排入複習" value={`${summary.queuedReviews} 題`} />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <SummaryNote title="最需要修正" value={summary.topLeak || '尚無明顯漏點'} />
          <SummaryNote title="本次最穩定" value={summary.strongestConcept || '繼續累積樣本'} />
        </div>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onComplete} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">回到今日</button>
          <button type="button" onClick={onExit} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800">選擇其他訓練</button>
        </div>
      </section>
    );
  }

  const selectAction = (action: ActionType) => {
    if (feedback || !confidence) return;
    const result = step.feedbacks[action];
    if (!result) return;
    const now = Date.now();
    const durationMs = now - startedAt.current;
    const schedule = getReviewSchedule(result.score, confidence, latestPrevious, now);
    const quality = resolveFeedbackQuality(result);
    const item: HistoryItem = {
      schemaVersion: 5,
      attemptId: createAttemptId(),
      trainingType: 'scenario',
      scenarioId: scenario.id,
      stepId: step.id,
      masteryKey: currentMasteryKey,
      category: [...(scenario.category || []), ...(step.conceptIds || [])],
      score: result.score,
      judgment: result.judgment,
      timestamp: now,
      selectedAction: action,
      bestAction: result.bestAction,
      street: step.street,
      position: scenario.position,
      durationMs,
      confidence,
      correct: result.score >= 8,
      feedbackQuality: quality,
      evLossBB: result.evidence?.evLossBB,
      difficultyWeight: getDifficultyWeight(scenario.difficulty),
      isReview: Boolean(latestPrevious),
      isDelayedReview: isDelayedReview(latestPrevious, now),
      isUnseen: !latestPrevious,
      questionLabel: scenario.title,
      gameFormat: scenario.type === 'Tournament' ? 'MTT' : 'Cash',
      contextFamilyId: scenarioContextFamilyId(scenario),
      situationIds: inferSituationIdsFromScenario(scenario),
      ...schedule,
    };
    setSelectedAction(action);
    setFeedback(result);
    setSessionItems(previous => [...previous, item]);
    onRecord(item);
  };

  const next = () => {
    const nextStepId = feedback?.nextStepId;
    if (nextStepId && nextStepId !== 'next_hand') {
      const nextIndex = scenario.steps.findIndex(item => item.id === nextStepId);
      if (nextIndex >= 0) {
        setStepIndex(nextIndex);
        resetDecision();
        return;
      }
    }
    setScenarioIndex(index => index + 1);
    setStepIndex(0);
    resetDecision();
  };

  const resetDecision = () => {
    setSelectedAction(null);
    setConfidence(null);
    setFeedback(null);
    setCoachOpen(false);
    startedAt.current = Date.now();
  };

  const restart = () => {
    setScenarioIndex(0);
    setStepIndex(0);
    setSessionItems([]);
    resetDecision();
  };

  const currentItem = sessionItems[sessionItems.length - 1];
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex items-center justify-between gap-4">
        <button type="button" onClick={onExit} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100"><ArrowLeft className="h-4 w-4" />離開</button>
        <div className="min-w-0 flex-1 text-center"><div className="truncate text-sm font-semibold text-slate-200">{title}</div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div></div>
        <div className="text-right text-xs text-slate-500">{scenarioIndex + 1} / {scenarios.length}</div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/55 shadow-2xl shadow-black/20">
        <div className="grid lg:grid-cols-[1fr_280px]">
          <div className="relative min-h-[330px] bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.14),_transparent_62%)] p-5 md:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400"><Pill text={scenario.type} /><Pill text={step.street} /><Pill text={scenario.difficulty} />{latestPrevious && <Pill text={isDelayedReview(latestPrevious) ? '延遲複習' : '近期重練'} />}</div>
            <div className="mt-8 flex min-h-28 items-center justify-center gap-2 md:gap-3">{step.communityCards.length ? step.communityCards.map((card, index) => <CardUI key={`${card.rank}-${card.suit}-${index}`} card={card} size="sm" />) : <div className="rounded-xl border border-dashed border-slate-700 px-6 py-8 text-sm text-slate-500">翻前決策</div>}</div>
            <div className="mt-8 flex items-end justify-between gap-4">
              <div><div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Hero · {scenario.position}</div><div className="flex gap-2">{scenario.holeCards.map((card, index) => <CardUI key={`${card.rank}-${card.suit}-${index}`} card={card} size="sm" />)}</div></div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-5 py-4 text-right"><div className="text-xs text-emerald-300/70">Pot</div><div className="font-mono text-2xl font-bold text-emerald-300">{step.potSize} BB</div></div>
            </div>
          </div>
          <aside className="border-t border-slate-800 bg-slate-950/45 p-5 lg:border-l lg:border-t-0">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">牌局資訊</h3>
            <dl className="mt-4 space-y-3 text-sm"><InfoRow label="盲注" value={scenario.blinds} /><InfoRow label="有效籌碼" value={scenario.effectiveStack} /><InfoRow label="位置" value={scenario.position} />{step.spr !== undefined && <InfoRow label="SPR" value={String(step.spr)} mono />}{step.potOdds && <InfoRow label="底池賠率" value={step.potOdds} mono />}</dl>
            <div className="mt-6 border-t border-slate-800 pt-5"><div className="text-xs text-slate-500">前序行動</div><p className="mt-2 text-sm leading-relaxed text-slate-300">{scenario.preAction}</p></div>
          </aside>
        </div>

        <div className="border-t border-slate-800 p-5 md:p-7">
          <h2 className="text-xl font-semibold leading-relaxed text-white md:text-2xl">{step.description}</h2>
          {!feedback && <div className="mt-5"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-400"><ShieldQuestion className="h-4 w-4" />作答前先標記你的把握</div><div className="grid gap-2 sm:grid-cols-4">{CONFIDENCE.map(item => <button key={item.value} type="button" onClick={() => setConfidence(item.value)} className={`rounded-xl border px-3 py-2.5 text-left transition ${confidence === item.value ? 'border-amber-400/60 bg-amber-400/12 text-amber-200' : 'border-slate-700 bg-slate-950/40 text-slate-400 hover:text-white'}`}><span className="block text-sm font-semibold">{item.label}</span><span className="text-[11px] opacity-65">{item.hint}</span></button>)}</div></div>}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">{step.options.map(option => {
            const isSelected = selectedAction === option;
            const isBest = Boolean(feedback && feedback.bestAction === option);
            return <button key={option} type="button" disabled={Boolean(feedback) || !confidence} onClick={() => selectAction(option)} className={`min-h-14 rounded-xl border px-4 py-3 text-sm font-semibold transition ${isBest ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200' : isSelected ? 'border-red-400 bg-red-500/12 text-red-200' : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40'}`}>{ACTION_LABELS[option] || option}</button>;
          })}</div>
          {!confidence && !feedback && <p className="mt-3 text-center text-xs text-slate-600">選擇信心後才能提交決策。</p>}
        </div>
      </section>

      {feedback && currentItem && <FeedbackPanel feedback={feedback} item={currentItem} onRestart={restart} onNext={next} onCoach={() => setCoachOpen(true)} />}
      {feedback && <CoachDrawer open={coachOpen} scenario={scenario} step={step} feedback={feedback} selectedAction={selectedAction} onClose={() => setCoachOpen(false)} />}
    </div>
  );
}

function FeedbackPanel({ feedback, item, onRestart, onNext, onCoach }: { feedback: Feedback; item: HistoryItem; onRestart: () => void; onNext: () => void; onCoach: () => void }) {
  const correct = item.correct;
  const qualityLabels = { best: '最佳線', acceptable: '可接受', suboptimal: '次佳', 'major-error': '重大錯誤' } as const;
  return <section className={`mt-5 rounded-2xl border p-5 md:p-6 ${correct ? 'border-emerald-500/30 bg-emerald-500/7' : 'border-red-500/25 bg-red-500/6'}`}>
    <div className="flex items-start gap-3">{correct ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-400" />}<div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">{feedback.judgment}</h3><div className="flex gap-2"><span className="rounded-full bg-slate-950/50 px-3 py-1 text-xs">{qualityLabels[item.feedbackQuality || 'suboptimal']}</span><span className="rounded-full bg-slate-950/50 px-3 py-1 font-mono text-sm">{feedback.score * 10} 分</span></div></div>
      <p className="mt-3 leading-relaxed text-slate-200">{feedback.why}</p>
      {typeof item.evLossBB === 'number' && <div className="mt-3 inline-flex rounded-lg border border-blue-500/20 bg-blue-500/8 px-3 py-2 text-sm text-blue-200">相對最佳線 EV 損失：{item.evLossBB.toFixed(2)}BB</div>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">{feedback.conceptualError !== '無' && <FeedbackNote icon={<XCircle className="h-4 w-4" />} label="概念錯誤" text={feedback.conceptualError} />}<FeedbackNote icon={<Lightbulb className="h-4 w-4" />} label="記憶規則" text={feedback.remember} /></div>
      {feedback.evidence && <div className="mt-4 grid gap-3 md:grid-cols-2">{feedback.evidence.objective && <FeedbackNote label="決策目標" text={feedback.evidence.objective} />}{feedback.evidence.villainRange && <FeedbackNote label="對手範圍" text={feedback.evidence.villainRange} />}{feedback.evidence.blockers && <FeedbackNote label="Blocker" text={feedback.evidence.blockers} />}{feedback.evidence.reversals?.length && <FeedbackNote label="答案反轉條件" text={feedback.evidence.reversals.join('；')} />}</div>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/60 pt-5"><div className="flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-4 w-4" />{item.nextReviewAt ? `下次提取練習：${new Date(item.nextReviewAt).toLocaleString('zh-TW')}` : '本題已記錄'}</div><div className="flex gap-2"><button type="button" onClick={onCoach} className="flex items-center gap-2 rounded-lg border border-violet-500/30 px-3 py-2.5 text-sm text-violet-300 hover:bg-violet-500/10"><Brain className="h-4 w-4" />問教練</button><button type="button" onClick={onRestart} className="rounded-lg border border-slate-700 p-2.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100" title="重新開始"><RotateCcw className="h-4 w-4" /></button><button type="button" onClick={onNext} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">下一題<ArrowRight className="h-4 w-4" /></button></div></div>
    </div></div>
  </section>;
}

function Pill({ text }: { text: string }) { return <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1">{text}</span>; }
function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="flex items-center justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className={`text-right font-medium text-slate-200 ${mono ? 'font-mono' : ''}`}>{value}</dd></div>; }
function FeedbackNote({ icon, label, text }: { icon?: ReactNode; label: string; text: string }) { return <div className="rounded-xl border border-slate-700/70 bg-slate-950/35 p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{icon}{label}</div><p className="mt-2 text-sm leading-relaxed text-slate-300">{text}</p></div>; }
function SummaryMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-2xl font-bold">{value}</div></div>; }
function SummaryNote({ title, value }: { title: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-xs text-slate-500">{title}</div><div className="mt-2 font-semibold text-slate-200">{value}</div></div>; }