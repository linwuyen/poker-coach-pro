import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, Brain, Calculator, CheckCircle2, Clock3,
  Lightbulb, RotateCcw, ShieldQuestion, Sparkles, Target, XCircle, Zap,
} from 'lucide-react';
import { CardUI } from '../../components/CardUI';
import { ActionType, ConfidenceLevel, Feedback, HistoryItem, Scenario, ScenarioStep } from '../../types';
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
import { rankByExpectedLearningValue } from '../../learning-engine/trainingValue';
import { companionStateFromScenario } from '../../companion/adapters';
import { analyzeCompanionState } from '../../companion/companionEngine';
import { clearCompanionHandState, publishCompanionHandState } from '../../companion/handStateBus';
import { formatFrequency, StrategyAction } from '../../strategy-engine-v2';
import { isFolded, isPositionMatch, NINE_MAX_SEATS, parseSeatAction, SIX_MAX_SEATS } from '../../utils/table';
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

const STRATEGY_LABELS: Record<StrategyAction, string> = {
  raise: 'Raise', call: 'Call', limp: 'Limp', fold: 'Fold', allIn: 'Jam',
};

const CONFIDENCE: Array<{ value: ConfidenceLevel; label: string; hint: string }> = [
  { value: 1, label: '猜測', hint: '< 50%' },
  { value: 2, label: '不太確定', hint: '約 55%' },
  { value: 3, label: '大致確定', hint: '約 75%' },
  { value: 4, label: '非常確定', hint: '約 90%' },
];

export function TrainingSession({ scenarios, history, title, onRecord, onExit, onComplete }: TrainingSessionProps) {
  const [queue, setQueue] = useState<Scenario[]>(() => [...scenarios]);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [sessionItems, setSessionItems] = useState<HistoryItem[]>([]);
  const [coachOpen, setCoachOpen] = useState(false);
  const startedAt = useRef(Date.now());

  const scenario = queue[scenarioIndex];
  const step = scenario?.steps[stepIndex];
  const currentMasteryKey = scenario && step ? makeMasteryKey(scenario.id, step.id) : '';
  const mergedHistory = useMemo(() => mergeHistory(history, sessionItems), [history, sessionItems]);
  const latestPrevious = useMemo(() => mergedHistory
    .filter(item => getHistoryMasteryKey(item) === currentMasteryKey)
    .sort((a, b) => b.timestamp - a.timestamp)[0], [mergedHistory, currentMasteryKey]);
  const summary = useMemo(() => buildSessionLearningSummary(sessionItems), [sessionItems]);
  const correctCount = sessionItems.filter(item => item.correct).length;
  const currentAccuracy = sessionItems.length ? Math.round((correctCount / sessionItems.length) * 100) : 0;
  const sessionEvLoss = sessionItems.reduce((sum, item) => sum + (typeof item.evLossBB === 'number' ? Math.max(0, item.evLossBB) : 0), 0);
  const completedHands = Math.min(scenarioIndex + (feedback?.nextStepId === 'next_hand' ? 1 : 0), queue.length);
  const progress = queue.length ? completedHands / queue.length * 100 : 0;
  const currentItem = sessionItems[sessionItems.length - 1];

  const nextPreview = useMemo(() => {
    if (!feedback || !scenario || !step || feedback.nextStepId !== 'next_hand') return undefined;
    const remaining = queue.slice(scenarioIndex + 1);
    return rankAdaptiveCandidates(remaining, mergedHistory, scenario, step, currentItem)[0];
  }, [feedback, scenario, step, queue, scenarioIndex, mergedHistory, currentItem]);

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
      <SessionComplete
        summary={summary}
        decisions={sessionItems.length}
        evLoss={sessionEvLoss}
        onComplete={onComplete}
        onExit={onExit}
      />
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
      chosenEvBB: result.evidence?.actionEvBB,
      bestEvBB: result.evidence?.bestEvBB,
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

  const resetDecision = () => {
    setSelectedAction(null);
    setConfidence(null);
    setFeedback(null);
    setCoachOpen(false);
    startedAt.current = Date.now();
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

    const nextScenarioIndex = scenarioIndex + 1;
    if (nextScenarioIndex < queue.length) {
      setQueue(previous => {
        const prefix = previous.slice(0, nextScenarioIndex);
        const remaining = previous.slice(nextScenarioIndex);
        return [...prefix, ...rankAdaptiveCandidates(remaining, mergeHistory(history, sessionItems), scenario, step, currentItem)];
      });
    }
    setScenarioIndex(nextScenarioIndex);
    setStepIndex(0);
    resetDecision();
  };

  const restart = () => {
    setQueue([...scenarios]);
    setScenarioIndex(0);
    setStepIndex(0);
    setSessionItems([]);
    resetDecision();
  };

  const nextLabel = feedback?.nextStepId && feedback.nextStepId !== 'next_hand' ? '下一個決策' : '下一手';

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <SessionTopBar
        title={title}
        handNumber={scenarioIndex + 1}
        handCount={queue.length}
        progress={progress}
        accuracy={currentAccuracy}
        decisions={sessionItems.length}
        evLoss={sessionEvLoss}
        adaptive={Boolean(sessionItems.length)}
        onExit={onExit}
      />

      <TrainingTable scenario={scenario} step={step} latestPrevious={latestPrevious} />

      <DecisionDock
        step={step}
        feedback={feedback}
        selectedAction={selectedAction}
        confidence={confidence}
        onConfidence={setConfidence}
        onAction={selectAction}
      />

      {feedback && currentItem && (
        <PostDecisionReview
          scenario={scenario}
          step={step}
          stepIndex={stepIndex}
          feedback={feedback}
          item={currentItem}
          selectedAction={selectedAction}
          history={mergedHistory}
          nextPreview={nextPreview}
          nextLabel={nextLabel}
          onRestart={restart}
          onNext={next}
          onCoach={() => setCoachOpen(true)}
        />
      )}

      {feedback && (
        <CoachDrawer
          open={coachOpen}
          scenario={scenario}
          step={step}
          feedback={feedback}
          selectedAction={selectedAction}
          onClose={() => setCoachOpen(false)}
        />
      )}
    </div>
  );
}

function rankAdaptiveCandidates(
  candidates: Scenario[],
  history: HistoryItem[],
  currentScenario: Scenario,
  currentStep: ScenarioStep,
  lastItem?: HistoryItem,
): Scenario[] {
  if (candidates.length <= 1) return candidates;
  const ranked = rankByExpectedLearningValue(candidates, history, Date.now());
  const weakDecision = Boolean(lastItem && (!lastItem.correct || (lastItem.confidence || 4) <= 2));
  if (!weakDecision) return ranked.map(entry => entry.scenario);

  const currentConcepts = new Set([
    ...(currentScenario.category || []),
    ...(currentStep.conceptIds || []),
  ].map(value => value.toLowerCase()));

  return ranked
    .map(entry => {
      const candidateConcepts = [
        ...(entry.scenario.category || []),
        ...entry.scenario.steps.flatMap(candidateStep => candidateStep.conceptIds || []),
      ].map(value => value.toLowerCase());
      const overlap = candidateConcepts.filter(value => currentConcepts.has(value)).length;
      const sameStreet = entry.scenario.steps.some(candidateStep => candidateStep.street === currentStep.street);
      const transferBoost = 1 + Math.min(1.5, overlap * 0.5) + (sameStreet ? 0.15 : 0);
      return { scenario: entry.scenario, score: entry.value.total * transferBoost };
    })
    .sort((a, b) => b.score - a.score || a.scenario.id.localeCompare(b.scenario.id))
    .map(entry => entry.scenario);
}

function mergeHistory(history: HistoryItem[], sessionItems: HistoryItem[]): HistoryItem[] {
  const byKey = new Map<string, HistoryItem>();
  [...history, ...sessionItems].forEach(item => {
    const key = item.attemptId || `${item.scenarioId}:${item.stepId || ''}:${item.timestamp}:${item.selectedAction || ''}`;
    byKey.set(key, item);
  });
  return [...byKey.values()];
}

function SessionTopBar({ title, handNumber, handCount, progress, accuracy, decisions, evLoss, adaptive, onExit }: {
  title: string;
  handNumber: number;
  handCount: number;
  progress: number;
  accuracy: number;
  decisions: number;
  evLoss: number;
  adaptive: boolean;
  onExit: () => void;
}) {
  return (
    <header className="rounded-2xl border border-slate-800 bg-slate-900/55 px-4 py-3 shadow-xl shadow-black/10 md:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onExit} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100">
          <ArrowLeft className="h-4 w-4" />離開
        </button>
        <div className="min-w-[180px] flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="truncate text-sm font-semibold text-slate-100">{title}</div>
            <div className="font-mono text-xs text-slate-500">HAND {handNumber} / {handCount}</div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <SessionChip label="決策" value={String(decisions)} />
          <SessionChip label="正確率" value={decisions ? `${accuracy}%` : '-'} />
          <SessionChip label="EV Leak" value={evLoss ? `${evLoss.toFixed(2)} BB` : '0'} />
          <SessionChip label="下一手" value={adaptive ? '自適應' : '預排'} />
        </div>
      </div>
    </header>
  );
}

function TrainingTable({ scenario, step, latestPrevious }: { scenario: Scenario; step: ScenarioStep; latestPrevious?: HistoryItem }) {
  const tableSize = scenario.tableSize || '9max';
  const seats = tableSize === '6max' ? SIX_MAX_SEATS : NINE_MAX_SEATS;
  const actions = step.handState?.actions;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/30">
      <div className="border-b border-slate-800 bg-slate-900/65 px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <Pill text={scenario.type} /><Pill text={tableSize.toUpperCase()} /><Pill text={step.street} /><Pill text={scenario.difficulty} />
            {latestPrevious && <Pill text={isDelayedReview(latestPrevious) ? '延遲複習' : '近期重練'} />}
          </div>
          <div className="text-xs text-slate-500">{scenario.blinds} · Effective {scenario.effectiveStack}</div>
        </div>
      </div>

      <div className="relative mx-auto aspect-[16/10] min-h-[480px] w-full max-w-6xl overflow-hidden bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.09),_transparent_58%)] md:min-h-[590px]">
        <div className="absolute inset-[12%_8%] rounded-[48%] border-[10px] border-slate-800/90 bg-[radial-gradient(circle_at_45%_45%,rgba(5,90,68,0.62),rgba(2,44,34,0.82)_58%,rgba(2,28,24,0.96))] shadow-[inset_0_0_80px_rgba(0,0,0,0.55),0_30px_70px_rgba(0,0,0,0.45)]">
          <div className="absolute inset-3 rounded-[46%] border border-emerald-400/10" />
        </div>

        {seats.map(seat => {
          const hero = isPositionMatch(seat.key, scenario.position, tableSize);
          const seatAction = parseSeatAction(seat.key, scenario.preAction, step.description, scenario.position, tableSize, actions);
          const folded = isFolded(seat.key, scenario.preAction, step.description, scenario.position, step.street, tableSize, actions);
          const active = hero || Boolean(seatAction.actionText);
          return (
            <div key={seat.key}>
              <div
                className={`absolute z-10 min-w-[82px] -translate-x-1/2 -translate-y-1/2 rounded-xl border px-2.5 py-2 text-center shadow-lg backdrop-blur-sm md:min-w-[108px] md:px-3 md:py-2.5 ${hero ? 'border-emerald-400/70 bg-emerald-500/18 text-emerald-100 ring-2 ring-emerald-400/15' : active ? 'border-slate-600 bg-slate-900/95 text-slate-200' : 'border-slate-800 bg-slate-950/82 text-slate-500'} ${folded ? 'opacity-35 grayscale' : ''}`}
                style={{ top: seat.top, left: seat.left }}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] md:text-xs">{seat.key.toUpperCase()}</div>
                <div className="mt-0.5 text-[9px] text-slate-500 md:text-[10px]">{hero ? `HERO · ${scenario.userBB} BB` : folded ? 'Folded' : 'Opponent'}</div>
              </div>
              {seatAction.actionText && !hero && !folded && (
                <div
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-center text-[9px] font-semibold text-amber-200 shadow-lg md:text-[10px]"
                  style={{ top: seat.betTop, left: seat.betLeft }}
                >
                  {seatAction.actionText}{seatAction.betText ? <span className="ml-1 font-mono text-amber-100">{seatAction.betText}</span> : null}
                </div>
              )}
            </div>
          );
        })}

        <div className="absolute left-1/2 top-[43%] z-10 w-[74%] max-w-2xl -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="flex min-h-20 items-center justify-center gap-1.5 md:gap-2">
            {step.communityCards.length ? step.communityCards.map((card, index) => (
              <CardUI key={`${card.rank}-${card.suit}-${index}`} card={card} size="sm" />
            )) : <div className="rounded-xl border border-dashed border-emerald-300/20 bg-slate-950/25 px-5 py-3 text-xs uppercase tracking-[0.2em] text-emerald-100/40">Preflop</div>}
          </div>
          <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-slate-950/55 px-4 py-2 shadow-lg backdrop-blur-sm">
            <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/60">POT</span>
            <span className="font-mono text-lg font-black text-emerald-300">{step.potSize} BB</span>
          </div>
        </div>

        <div className="absolute bottom-[13%] left-1/2 z-20 -translate-x-1/2">
          <div className="flex items-end justify-center gap-2">
            {scenario.holeCards.map((card, index) => <CardUI key={`${card.rank}-${card.suit}-${index}`} card={card} size="sm" />)}
          </div>
          <div className="mt-2 text-center"><span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">Hero · {scenario.position}</span></div>
        </div>

        <div className="absolute left-4 top-4 z-20 max-w-[46%] rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 backdrop-blur-sm md:left-6 md:top-6">
          <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">Action history</div>
          <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-slate-400 md:text-xs">{scenario.preAction}</p>
        </div>

        <div className="absolute right-4 top-4 z-20 flex flex-col items-end gap-1 md:right-6 md:top-6">
          {step.spr !== undefined && <TableMetric label="SPR" value={String(step.spr)} />}
          {step.potOdds && <TableMetric label="Pot Odds" value={step.potOdds} />}
        </div>
      </div>
    </section>
  );
}

function DecisionDock({ step, feedback, selectedAction, confidence, onConfidence, onAction }: {
  step: ScenarioStep;
  feedback: Feedback | null;
  selectedAction: ActionType | null;
  confidence: ConfidenceLevel | null;
  onConfidence: (value: ConfidenceLevel) => void;
  onAction: (action: ActionType) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4 shadow-xl shadow-black/10 md:p-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400"><Activity className="h-4 w-4" />Hero to act</div>
      <h2 className="mt-3 text-xl font-semibold leading-relaxed text-white md:text-2xl">{step.description}</h2>
      {!feedback && <>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="mr-1 flex items-center gap-2 text-xs text-slate-500"><ShieldQuestion className="h-4 w-4" />把握度</div>
          {CONFIDENCE.map(item => <button key={item.value} type="button" onClick={() => onConfidence(item.value)} className={`rounded-lg border px-3 py-2 text-left transition ${confidence === item.value ? 'border-amber-400/60 bg-amber-400/12 text-amber-200' : 'border-slate-700 bg-slate-950/35 text-slate-400 hover:border-slate-600 hover:text-white'}`}><span className="text-xs font-semibold">{item.label}</span><span className="ml-2 text-[10px] opacity-55">{item.hint}</span></button>)}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {step.options.map(option => <button key={option} type="button" disabled={!confidence} onClick={() => onAction(option)} className="group min-h-16 rounded-xl border border-slate-700 bg-slate-950/45 px-5 py-4 text-left transition hover:border-emerald-500/45 hover:bg-emerald-500/8 disabled:cursor-not-allowed disabled:opacity-35"><div className="flex items-center justify-between gap-3"><span className="text-base font-bold text-slate-100 group-hover:text-emerald-200">{ACTION_LABELS[option] || option}</span><ArrowRight className="h-4 w-4 text-slate-700 group-hover:text-emerald-400" /></div></button>)}
        </div>
        {!confidence && <p className="mt-3 text-center text-xs text-slate-600">先選把握度，再提交這手的決策；答案在提交前保持鎖定。</p>}
      </>}
      {feedback && <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 text-sm"><span className="text-slate-500">你的決策</span><span className="font-semibold text-white">{selectedAction ? ACTION_LABELS[selectedAction] || selectedAction : '-'}</span><span className="text-slate-700">→</span><span className="text-slate-500">最佳線</span><span className="font-semibold text-emerald-300">{ACTION_LABELS[feedback.bestAction] || feedback.bestAction}</span></div>}
    </section>
  );
}

function PostDecisionReview({ scenario, step, stepIndex, feedback, item, selectedAction, history, nextPreview, nextLabel, onRestart, onNext, onCoach }: {
  scenario: Scenario;
  step: ScenarioStep;
  stepIndex: number;
  feedback: Feedback;
  item: HistoryItem;
  selectedAction: ActionType | null;
  history: HistoryItem[];
  nextPreview?: Scenario;
  nextLabel: string;
  onRestart: () => void;
  onNext: () => void;
  onCoach: () => void;
}) {
  const correct = item.correct;
  const qualityLabels = { best: '最佳線', acceptable: '可接受', suboptimal: '次佳', 'major-error': '重大錯誤' } as const;
  return (
    <section className={`rounded-2xl border p-5 shadow-xl shadow-black/10 md:p-6 ${correct ? 'border-emerald-500/30 bg-emerald-500/7' : 'border-red-500/25 bg-red-500/6'}`}>
      <div className="flex items-start gap-3">
        {correct ? <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 h-7 w-7 shrink-0 text-red-400" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Post-decision review</div><h3 className="mt-1 text-xl font-semibold text-white">{feedback.judgment}</h3></div>
            <div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-950/50 px-3 py-1 text-xs">{qualityLabels[item.feedbackQuality || 'suboptimal']}</span><span className="rounded-full bg-slate-950/50 px-3 py-1 font-mono text-sm">{feedback.score * 10} 分</span>{typeof item.evLossBB === 'number' && <span className="rounded-full border border-blue-500/20 bg-blue-500/8 px-3 py-1 font-mono text-xs text-blue-200">EV leak {item.evLossBB.toFixed(2)} BB</span>}</div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2"><DecisionResult label="你的選擇" value={selectedAction ? ACTION_LABELS[selectedAction] || selectedAction : '-'} tone={correct ? 'good' : 'bad'} /><DecisionResult label="最佳動作" value={ACTION_LABELS[feedback.bestAction] || feedback.bestAction} tone="good" /></div>
          <div className="mt-4 rounded-xl border border-slate-700/70 bg-slate-950/35 p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Zap className="h-4 w-4" />為什麼</div><p className="mt-2 text-sm leading-7 text-slate-200">{feedback.why}</p></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">{feedback.conceptualError !== '無' && <FeedbackNote icon={<XCircle className="h-4 w-4" />} label="這手真正的漏點" text={feedback.conceptualError} />}<FeedbackNote icon={<Lightbulb className="h-4 w-4" />} label="帶去下一手的規則" text={feedback.remember} /></div>

          <IntegratedDeepDive scenario={scenario} step={step} stepIndex={stepIndex} feedback={feedback} item={item} selectedAction={selectedAction} history={history} nextPreview={nextPreview} />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/60 pt-5">
            <div className="flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-4 w-4" />{item.nextReviewAt ? `下次提取練習：${new Date(item.nextReviewAt).toLocaleString('zh-TW')}` : '這個決策已記錄進玩家模型'}</div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={onCoach} className="flex items-center gap-2 rounded-lg border border-violet-500/30 px-3 py-2.5 text-sm text-violet-300 hover:bg-violet-500/10"><Brain className="h-4 w-4" />直接問這手</button><button type="button" onClick={onRestart} className="rounded-lg border border-slate-700 p-2.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100" title="重新開始"><RotateCcw className="h-4 w-4" /></button><button type="button" onClick={onNext} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">{nextLabel}<ArrowRight className="h-4 w-4" /></button></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function IntegratedDeepDive({ scenario, step, stepIndex, feedback, item, selectedAction, history, nextPreview }: {
  scenario: Scenario;
  step: ScenarioStep;
  stepIndex: number;
  feedback: Feedback;
  item: HistoryItem;
  selectedAction: ActionType | null;
  history: HistoryItem[];
  nextPreview?: Scenario;
}) {
  const state = useMemo(() => companionStateFromScenario(scenario, stepIndex, { mode: 'training', handComplete: true, decisionLocked: false }), [scenario, stepIndex]);
  const analysis = useMemo(() => analyzeCompanionState(state, history), [state, history]);
  const evidence = feedback.evidence;
  const board = state.board?.length ? state.board.join(' ') : 'Preflop';
  const actionLine = state.actionHistory.length
    ? state.actionHistory.map(action => `${action.seat} ${action.label || action.action}${typeof action.amountBB === 'number' ? ` ${action.amountBB}BB` : ''}`).join(' → ')
    : scenario.preAction;
  const potOdds = step.potOdds || (analysis.potOdds !== undefined ? `${(analysis.potOdds * 100).toFixed(1)}%` : undefined);
  const spr = step.spr ?? analysis.spr;
  const strategy = analysis.strategy;

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-emerald-500/20 bg-slate-950/45">
      <div className="border-b border-slate-800 bg-emerald-500/5 px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><Target className="h-4 w-4" />深挖這手 · 已自動帶入</div><p className="mt-1 text-xs leading-5 text-slate-500">不再填第二份表單。牌桌狀態、你的選擇、最佳線與 feedback 直接成為同一份 analysis context。</p></div>
          {analysis.intervention && <span className="rounded-full border border-violet-500/20 bg-violet-500/8 px-3 py-1 text-xs text-violet-300">優先修：{analysis.intervention.label}</span>}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <ContextCell label="Hero" value={`${state.heroHand || scenario.holeCards.map(card => card.rank).join('')} · ${state.heroPosition}`} />
          <ContextCell label="Board" value={board} />
          <ContextCell label="Stack / Pot" value={`${state.effectiveStackBB}BB / ${state.potBB}BB`} />
          <ContextCell label="你的決策" value={selectedAction ? ACTION_LABELS[selectedAction] || selectedAction : '-'} />
        </div>
        <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs leading-5 text-slate-500"><span className="font-semibold text-slate-400">Action line：</span>{actionLine || '題目未提供結構化 action history'}</div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-3">
        <DeepDiveCard icon={<Brain className="h-4 w-4" />} title="Range / Blocker">
          <Fact label="Hero range" value={evidence?.heroRange} />
          <Fact label="Villain range" value={evidence?.villainRange} />
          <Fact label="Continues" value={evidence?.continues} />
          <Fact label="Blocker" value={evidence?.blockers} />
          {!evidence?.heroRange && !evidence?.villainRange && !evidence?.blockers && <Unknown text="這題沒有可信的 machine-readable range 證據；不要求你補填，也不捏造。" />}
        </DeepDiveCard>

        <DeepDiveCard icon={<Calculator className="h-4 w-4" />} title="Math / EV">
          <Fact label="Pot" value={`${state.potBB} BB`} />
          <Fact label="SPR" value={spr === undefined ? undefined : Number(spr).toFixed(2)} />
          <Fact label="Pot odds" value={potOdds} />
          <Fact label="Chosen EV" value={evidence?.actionEvBB === undefined ? undefined : `${evidence.actionEvBB.toFixed(2)} BB`} />
          <Fact label="Best EV" value={evidence?.bestEvBB === undefined ? undefined : `${evidence.bestEvBB.toFixed(2)} BB`} />
          <Fact label="EV leak" value={evidence?.evLossBB === undefined ? undefined : `${evidence.evLossBB.toFixed(2)} BB`} />
          {evidence?.actionEvBB === undefined && evidence?.bestEvBB === undefined && <Unknown text="題庫沒有 exact EV 時只顯示已知門檻，不製造假精度。" />}
        </DeepDiveCard>

        <DeepDiveCard icon={<Sparkles className="h-4 w-4" />} title="Strategy">
          {strategy && strategy.status !== 'unsupported' ? <>
            <Fact label="Node" value={`${strategy.status} · ${strategy.decision.hand}`} />
            {(['raise', 'call', 'allIn', 'limp', 'fold'] as StrategyAction[]).filter(action => strategy.decision.frequencies[action] >= 0.01).map(action => <Fact key={action} label={STRATEGY_LABELS[action]} value={formatFrequency(strategy.decision.frequencies[action])} />)}
          </> : step.street === 'Preflop' ? <Unknown text={strategy?.status === 'unsupported' ? strategy.warnings.join(' ') : '這個 preflop spot 沒有可信相符 strategy node；不要求手動重建。'} /> : <Unknown text="翻後目前沒有可驗證 solver frequency；直接用本題 evidence / EV / boundary 深挖，不把 heuristic 冒充 solver。" />}
        </DeepDiveCard>

        <DeepDiveCard icon={<Target className="h-4 w-4" />} title="Boundary / 反轉條件">
          {evidence?.reversals?.length ? evidence.reversals.map((text, index) => <div key={`${text}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/35 px-3 py-2 text-xs leading-5 text-slate-300">{text}</div>) : <Unknown text="這題沒有標註答案反轉條件。" />}
          {step.assumptions?.map((text, index) => <Fact key={`${text}-${index}`} label="Assumption" value={text} />)}
        </DeepDiveCard>

        <DeepDiveCard icon={<Lightbulb className="h-4 w-4" />} title="診斷">
          <Fact label="真正漏點" value={feedback.conceptualError === '無' ? '沒有明顯概念錯誤' : feedback.conceptualError} />
          <Fact label="決策目標" value={evidence?.objective} />
          <Fact label="下一手規則" value={feedback.remember} />
          <Fact label="信心" value={item.confidence ? `${item.confidence}/4` : undefined} />
        </DeepDiveCard>

        <DeepDiveCard icon={<ArrowRight className="h-4 w-4" />} title="Adaptive 下一手">
          {nextPreview ? <><Fact label="下一手" value={nextPreview.title} /><Fact label="目的" value={!item.correct || (item.confidence || 4) <= 2 ? '優先找同概念 / 同 street 的 transfer 題，再以 Expected Learning Value 排序。' : '依最新玩家模型重新排名剩餘題目。'} /><div className="rounded-lg border border-emerald-500/20 bg-emerald-500/7 px-3 py-2 text-xs leading-5 text-emerald-200">你這手的結果已經進入下一手排序，不是照舊 queue 硬往下走。</div></> : <Unknown text="這已是本 session 最後一手。" />}
        </DeepDiveCard>
      </div>
    </div>
  );
}

function SessionComplete({ summary, decisions, evLoss, onComplete, onExit }: {
  summary: ReturnType<typeof buildSessionLearningSummary>;
  decisions: number;
  evLoss: number;
  onComplete: () => void;
  onExit: () => void;
}) {
  return (
    <section className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 shadow-2xl shadow-black/20">
      <div className="bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_60%)] px-6 py-10 text-center md:px-10">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
        <div className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Training session complete</div>
        <h2 className="mt-2 text-3xl font-bold text-white">這桌訓練打完了</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">每一手都已直接回寫玩家模型；錯誤會影響後續排序，而不是只留在報表裡。</p>
      </div>
      <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-5 md:px-8"><SummaryMetric label="決策數" value={String(decisions)} /><SummaryMetric label="本次正確率" value={`${summary.accuracy}%`} /><SummaryMetric label="未見題正確率" value={`${summary.unseenAccuracy}%`} /><SummaryMetric label="延遲留存" value={`${summary.delayedRetention}%`} /><SummaryMetric label="總 EV Leak" value={`${evLoss.toFixed(2)} BB`} /></div>
      <div className="grid gap-3 px-6 pb-6 md:grid-cols-3 md:px-8"><SummaryNote title="最需要修正" value={summary.topLeak || '尚無明顯漏點'} /><SummaryNote title="本次最穩定" value={summary.strongestConcept || '繼續累積樣本'} /><SummaryNote title="排入複習" value={`${summary.queuedReviews} 題`} /></div>
      <div className="flex flex-wrap justify-center gap-3 border-t border-slate-800 px-6 py-6"><button type="button" onClick={onComplete} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">回到今日教練</button><button type="button" onClick={onExit} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800">選擇下一個訓練</button></div>
    </section>
  );
}

function DeepDiveCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <section className="rounded-xl border border-slate-800 bg-slate-900/45 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{icon}{title}</div><div className="space-y-2">{children}</div></section>;
}
function Fact({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-800/70 bg-slate-950/30 px-3 py-2 text-xs"><span className="shrink-0 text-slate-600">{label}</span><span className="text-right leading-5 text-slate-300">{value}</span></div>;
}
function Unknown({ text }: { text: string }) { return <div className="rounded-lg border border-dashed border-slate-800 px-3 py-3 text-xs leading-5 text-slate-600">{text}</div>; }
function ContextCell({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"><div className="text-[9px] uppercase tracking-[0.15em] text-slate-600">{label}</div><div className="mt-1 truncate font-mono text-xs font-semibold text-slate-300">{value}</div></div>; }
function SessionChip({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"><div className="text-[9px] uppercase tracking-[0.16em] text-slate-600">{label}</div><div className="mt-0.5 font-mono text-xs font-bold text-slate-300">{value}</div></div>; }
function TableMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1.5 text-right backdrop-blur-sm"><div className="text-[8px] uppercase tracking-[0.16em] text-slate-600">{label}</div><div className="font-mono text-xs font-bold text-slate-300">{value}</div></div>; }
function DecisionResult({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' }) { return <div className={`rounded-xl border p-4 ${tone === 'good' ? 'border-emerald-500/20 bg-emerald-500/7' : 'border-red-500/20 bg-red-500/7'}`}><div className="text-xs text-slate-500">{label}</div><div className={`mt-1 text-lg font-bold ${tone === 'good' ? 'text-emerald-300' : 'text-red-300'}`}>{value}</div></div>; }
function Pill({ text }: { text: string }) { return <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1">{text}</span>; }
function FeedbackNote({ icon, label, text }: { icon?: ReactNode; label: string; text: string }) { return <div className="rounded-xl border border-slate-700/70 bg-slate-950/35 p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{icon}{label}</div><p className="mt-2 text-sm leading-relaxed text-slate-300">{text}</p></div>; }
function SummaryMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-2xl font-bold">{value}</div></div>; }
function SummaryNote({ title, value }: { title: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-xs text-slate-500">{title}</div><div className="mt-2 font-semibold text-slate-200">{value}</div></div>; }
