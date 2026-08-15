import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, Brain, CheckCircle2, Clock3, Lightbulb,
  MonitorUp, RotateCcw, ShieldQuestion, Target, XCircle, Zap,
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
import { companionStateFromScenario } from '../../companion/adapters';
import { clearCompanionHandState, publishCompanionHandState } from '../../companion/handStateBus';
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

const CONFIDENCE: Array<{ value: ConfidenceLevel; label: string; hint: string }> = [
  { value: 1, label: '猜測', hint: '< 50%' },
  { value: 2, label: '不太確定', hint: '約 55%' },
  { value: 3, label: '大致確定', hint: '約 75%' },
  { value: 4, label: '非常確定', hint: '約 90%' },
];

const TOOL_LINKS = [
  ['Range', 'range-reading'],
  ['Equity', 'equity-workbench'],
  ['Boundary', 'boundary-map'],
  ['ICM / $EV', 'icm-workbench'],
  ['Contrastive', 'contrastive-trainer'],
  ['Solver', 'solver-corpus'],
] as const;

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
  const completedHands = Math.min(scenarioIndex + (feedback?.nextStepId === 'next_hand' ? 1 : 0), scenarios.length);
  const progress = scenarios.length > 0 ? (completedHands / scenarios.length) * 100 : 0;
  const summary = useMemo(() => buildSessionLearningSummary(sessionItems), [sessionItems]);
  const currentMasteryKey = scenario && step ? makeMasteryKey(scenario.id, step.id) : '';
  const latestPrevious = useMemo(() => history
    .filter(item => getHistoryMasteryKey(item) === currentMasteryKey)
    .sort((a, b) => b.timestamp - a.timestamp)[0], [history, currentMasteryKey]);
  const correctCount = sessionItems.filter(item => item.correct).length;
  const currentAccuracy = sessionItems.length ? Math.round((correctCount / sessionItems.length) * 100) : 0;
  const sessionEvLoss = sessionItems.reduce((sum, item) => sum + (typeof item.evLossBB === 'number' ? Math.max(0, item.evLossBB) : 0), 0);

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
    setScenarioIndex(index => index + 1);
    setStepIndex(0);
    resetDecision();
  };

  const restart = () => {
    setScenarioIndex(0);
    setStepIndex(0);
    setSessionItems([]);
    resetDecision();
  };

  const openTrainingAssistant = () => {
    const base = window.location.href.split('#')[0];
    window.open(`${base}#companion`, 'poker-coach-training-assistant', 'popup=yes,width=520,height=920,resizable=yes,scrollbars=yes');
  };

  const currentItem = sessionItems[sessionItems.length - 1];
  const nextLabel = feedback?.nextStepId && feedback.nextStepId !== 'next_hand' ? '下一個決策' : '下一手';

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <SessionTopBar
        title={title}
        handNumber={scenarioIndex + 1}
        handCount={scenarios.length}
        progress={progress}
        accuracy={currentAccuracy}
        decisions={sessionItems.length}
        evLoss={sessionEvLoss}
        onExit={onExit}
        onOpenAssistant={openTrainingAssistant}
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
          feedback={feedback}
          item={currentItem}
          selectedAction={selectedAction}
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

function SessionTopBar({ title, handNumber, handCount, progress, accuracy, decisions, evLoss, onExit, onOpenAssistant }: {
  title: string;
  handNumber: number;
  handCount: number;
  progress: number;
  accuracy: number;
  decisions: number;
  evLoss: number;
  onExit: () => void;
  onOpenAssistant: () => void;
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
        </div>
        <button type="button" onClick={onOpenAssistant} className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/7 px-3 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/12">
          <MonitorUp className="h-4 w-4" />訓練助手
        </button>
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
            <Pill text={scenario.type} />
            <Pill text={tableSize.toUpperCase()} />
            <Pill text={step.street} />
            <Pill text={scenario.difficulty} />
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
            )) : (
              <div className="rounded-xl border border-dashed border-emerald-300/20 bg-slate-950/25 px-5 py-3 text-xs uppercase tracking-[0.2em] text-emerald-100/40">Preflop</div>
            )}
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
          <div className="mt-2 text-center">
            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">Hero · {scenario.position}</span>
          </div>
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
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
        <Activity className="h-4 w-4" />Hero to act
      </div>
      <h2 className="mt-3 text-xl font-semibold leading-relaxed text-white md:text-2xl">{step.description}</h2>

      {!feedback && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <div className="mr-1 flex items-center gap-2 text-xs text-slate-500"><ShieldQuestion className="h-4 w-4" />把握度</div>
            {CONFIDENCE.map(item => (
              <button
                key={item.value}
                type="button"
                onClick={() => onConfidence(item.value)}
                className={`rounded-lg border px-3 py-2 text-left transition ${confidence === item.value ? 'border-amber-400/60 bg-amber-400/12 text-amber-200' : 'border-slate-700 bg-slate-950/35 text-slate-400 hover:border-slate-600 hover:text-white'}`}
              >
                <span className="text-xs font-semibold">{item.label}</span><span className="ml-2 text-[10px] opacity-55">{item.hint}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {step.options.map(option => (
              <button
                key={option}
                type="button"
                disabled={!confidence}
                onClick={() => onAction(option)}
                className="group min-h-16 rounded-xl border border-slate-700 bg-slate-950/45 px-5 py-4 text-left transition hover:border-emerald-500/45 hover:bg-emerald-500/8 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-bold text-slate-100 group-hover:text-emerald-200">{ACTION_LABELS[option] || option}</span>
                  <ArrowRight className="h-4 w-4 text-slate-700 group-hover:text-emerald-400" />
                </div>
              </button>
            ))}
          </div>
          {!confidence && <p className="mt-3 text-center text-xs text-slate-600">先選把握度，再提交這手的決策；答案在提交前保持鎖定。</p>}
        </>
      )}

      {feedback && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 text-sm">
          <span className="text-slate-500">你的決策</span>
          <span className="font-semibold text-white">{selectedAction ? ACTION_LABELS[selectedAction] || selectedAction : '-'}</span>
          <span className="text-slate-700">→</span>
          <span className="text-slate-500">最佳線</span>
          <span className="font-semibold text-emerald-300">{ACTION_LABELS[feedback.bestAction] || feedback.bestAction}</span>
        </div>
      )}
    </section>
  );
}

function PostDecisionReview({ feedback, item, selectedAction, nextLabel, onRestart, onNext, onCoach }: {
  feedback: Feedback;
  item: HistoryItem;
  selectedAction: ActionType | null;
  nextLabel: string;
  onRestart: () => void;
  onNext: () => void;
  onCoach: () => void;
}) {
  const correct = item.correct;
  const qualityLabels = { best: '最佳線', acceptable: '可接受', suboptimal: '次佳', 'major-error': '重大錯誤' } as const;
  const openTool = (hash: string) => {
    const base = window.location.href.split('#')[0];
    window.open(`${base}#${hash}`, 'poker-coach-training-tool', 'popup=yes,width=1100,height=900,resizable=yes,scrollbars=yes');
  };

  return (
    <section className={`rounded-2xl border p-5 shadow-xl shadow-black/10 md:p-6 ${correct ? 'border-emerald-500/30 bg-emerald-500/7' : 'border-red-500/25 bg-red-500/6'}`}>
      <div className="flex items-start gap-3">
        {correct ? <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 h-7 w-7 shrink-0 text-red-400" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Post-decision review</div>
              <h3 className="mt-1 text-xl font-semibold text-white">{feedback.judgment}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-950/50 px-3 py-1 text-xs">{qualityLabels[item.feedbackQuality || 'suboptimal']}</span>
              <span className="rounded-full bg-slate-950/50 px-3 py-1 font-mono text-sm">{feedback.score * 10} 分</span>
              {typeof item.evLossBB === 'number' && <span className="rounded-full border border-blue-500/20 bg-blue-500/8 px-3 py-1 font-mono text-xs text-blue-200">EV leak {item.evLossBB.toFixed(2)} BB</span>}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DecisionResult label="你的選擇" value={selectedAction ? ACTION_LABELS[selectedAction] || selectedAction : '-'} tone={correct ? 'good' : 'bad'} />
            <DecisionResult label="最佳動作" value={ACTION_LABELS[feedback.bestAction] || feedback.bestAction} tone="good" />
          </div>

          <div className="mt-4 rounded-xl border border-slate-700/70 bg-slate-950/35 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Zap className="h-4 w-4" />為什麼</div>
            <p className="mt-2 text-sm leading-7 text-slate-200">{feedback.why}</p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {feedback.conceptualError !== '無' && <FeedbackNote icon={<XCircle className="h-4 w-4" />} label="這手真正的漏點" text={feedback.conceptualError} />}
            <FeedbackNote icon={<Lightbulb className="h-4 w-4" />} label="帶去下一手的規則" text={feedback.remember} />
          </div>

          {feedback.evidence && (
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {feedback.evidence.objective && <FeedbackNote label="決策目標" text={feedback.evidence.objective} />}
              {feedback.evidence.villainRange && <FeedbackNote label="對手範圍" text={feedback.evidence.villainRange} />}
              {feedback.evidence.blockers && <FeedbackNote label="Blocker" text={feedback.evidence.blockers} />}
              {feedback.evidence.reversals?.length ? <FeedbackNote label="答案反轉條件" text={feedback.evidence.reversals.join('；')} /> : null}
            </div>
          )}

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/35 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4 text-emerald-400" />深挖這手</div>
                <p className="mt-1 text-xs text-slate-500">答案已提交；現在才開 Range、Equity、Boundary、ICM 或 Solver，不破壞 retrieval。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {TOOL_LINKS.map(([label, hash]) => (
                  <button key={hash} type="button" onClick={() => openTool(hash)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-emerald-500/35 hover:text-emerald-200">{label}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/60 pt-5">
            <div className="flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-4 w-4" />{item.nextReviewAt ? `下次提取練習：${new Date(item.nextReviewAt).toLocaleString('zh-TW')}` : '這個決策已記錄進玩家模型'}</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onCoach} className="flex items-center gap-2 rounded-lg border border-violet-500/30 px-3 py-2.5 text-sm text-violet-300 hover:bg-violet-500/10"><Brain className="h-4 w-4" />問教練</button>
              <button type="button" onClick={onRestart} className="rounded-lg border border-slate-700 p-2.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100" title="重新開始"><RotateCcw className="h-4 w-4" /></button>
              <button type="button" onClick={onNext} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">{nextLabel}<ArrowRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </section>
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
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">重點不是贏了幾題，而是哪些決策已經穩定、哪些漏點要進下一輪 retrieval。</p>
      </div>
      <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-5 md:px-8">
        <SummaryMetric label="決策數" value={String(decisions)} />
        <SummaryMetric label="本次正確率" value={`${summary.accuracy}%`} />
        <SummaryMetric label="未見題正確率" value={`${summary.unseenAccuracy}%`} />
        <SummaryMetric label="延遲留存" value={`${summary.delayedRetention}%`} />
        <SummaryMetric label="總 EV Leak" value={`${evLoss.toFixed(2)} BB`} />
      </div>
      <div className="grid gap-3 px-6 pb-6 md:grid-cols-3 md:px-8">
        <SummaryNote title="最需要修正" value={summary.topLeak || '尚無明顯漏點'} />
        <SummaryNote title="本次最穩定" value={summary.strongestConcept || '繼續累積樣本'} />
        <SummaryNote title="排入複習" value={`${summary.queuedReviews} 題`} />
      </div>
      <div className="flex flex-wrap justify-center gap-3 border-t border-slate-800 px-6 py-6">
        <button type="button" onClick={onComplete} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">回到今日教練</button>
        <button type="button" onClick={onExit} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800">選擇下一個訓練</button>
      </div>
    </section>
  );
}

function SessionChip({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"><div className="text-[9px] uppercase tracking-[0.16em] text-slate-600">{label}</div><div className="mt-0.5 font-mono text-xs font-bold text-slate-300">{value}</div></div>;
}

function TableMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1.5 text-right backdrop-blur-sm"><div className="text-[8px] uppercase tracking-[0.16em] text-slate-600">{label}</div><div className="font-mono text-xs font-bold text-slate-300">{value}</div></div>;
}

function DecisionResult({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' }) {
  return <div className={`rounded-xl border p-4 ${tone === 'good' ? 'border-emerald-500/20 bg-emerald-500/7' : 'border-red-500/20 bg-red-500/7'}`}><div className="text-xs text-slate-500">{label}</div><div className={`mt-1 text-lg font-bold ${tone === 'good' ? 'text-emerald-300' : 'text-red-300'}`}>{value}</div></div>;
}

function Pill({ text }: { text: string }) {
  return <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1">{text}</span>;
}

function FeedbackNote({ icon, label, text }: { icon?: ReactNode; label: string; text: string }) {
  return <div className="rounded-xl border border-slate-700/70 bg-slate-950/35 p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{icon}{label}</div><p className="mt-2 text-sm leading-relaxed text-slate-300">{text}</p></div>;
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-2xl font-bold">{value}</div></div>;
}

function SummaryNote({ title, value }: { title: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-xs text-slate-500">{title}</div><div className="mt-2 font-semibold text-slate-200">{value}</div></div>;
}
