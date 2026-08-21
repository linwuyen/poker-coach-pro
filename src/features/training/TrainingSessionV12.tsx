import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Brain, Calculator, CheckCircle2, ChevronDown, ChevronUp, Lightbulb, RotateCcw, Sparkles, Target, XCircle } from 'lucide-react';
import { CardUI } from '../../components/CardUI';
import { companionStateFromScenario } from '../../companion/adapters';
import { clearCompanionHandState, publishCompanionHandState } from '../../companion/handStateBus';
import { getDifficultyWeight, getHistoryMasteryKey, isDelayedReview, makeMasteryKey, resolveFeedbackQuality } from '../../learning-engine';
import { scenarioContextFamilyId, inferSituationIdsFromScenario } from '../../learning-engine/contextIdentity';
import { rankByExpectedLearningValue } from '../../learning-engine/trainingValue';
import { ActionType, Feedback, HistoryItem, Scenario, ScenarioStep } from '../../types';
import { createAttemptId, getReviewSchedule } from '../../utils/history';

interface TrainingSessionProps {
  scenarios: Scenario[];
  history: HistoryItem[];
  title: string;
  continuous?: boolean;
  autoComplete?: boolean;
  onRecord: (item: HistoryItem) => void;
  onExit: () => void;
  onComplete: () => void;
}

const ACTION_LABELS: Partial<Record<ActionType, string>> = {
  Fold: '棄牌', Call: '跟注', Raise: '加注', '3-bet': '3-Bet', '4-bet (Raise)': '4-Bet',
  'All-in': '全下', Check: '過牌', 'Bet small': '小注', 'Bet half pot': '半池', 'Bet big': '大注',
};

export function TrainingSessionV12({ scenarios, history, title, continuous = false, autoComplete = false, onRecord, onExit, onComplete }: TrainingSessionProps) {
  const [queue, setQueue] = useState<Scenario[]>(() => diversifyInitialQueue(scenarios));
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [sessionItems, setSessionItems] = useState<HistoryItem[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const startedAt = useRef(Date.now());
  const completionSent = useRef(false);

  const scenario = queue[scenarioIndex];
  const step = scenario?.steps[stepIndex];
  const mergedHistory = useMemo(() => mergeHistory(history, sessionItems), [history, sessionItems]);
  const masteryKey = scenario && step ? makeMasteryKey(scenario.id, step.id) : '';
  const latestPrevious = useMemo(() => mergedHistory
    .filter(item => getHistoryMasteryKey(item) === masteryKey)
    .sort((a, b) => b.timestamp - a.timestamp)[0], [mergedHistory, masteryKey]);
  const currentItem = sessionItems[sessionItems.length - 1];
  const correctCount = sessionItems.filter(item => item.trainingType === 'scenario' && item.correct).length;
  const decisionCount = sessionItems.filter(item => item.trainingType === 'scenario').length;
  const accuracy = decisionCount ? Math.round(correctCount / decisionCount * 100) : 0;
  const evLoss = sessionItems.reduce((sum, item) => sum + (item.trainingType === 'scenario' && typeof item.evLossBB === 'number' ? Math.max(0, item.evLossBB) : 0), 0);

  useEffect(() => {
    if (!scenario || !step) { clearCompanionHandState(); return; }
    publishCompanionHandState(companionStateFromScenario(scenario, stepIndex, {
      mode: 'training', handComplete: Boolean(feedback), decisionLocked: !feedback,
    }));
  }, [scenario, step, stepIndex, feedback]);
  useEffect(() => () => clearCompanionHandState(), []);

  useEffect(() => {
    if (!feedback || !currentItem?.correct) return;
    const timer = window.setTimeout(() => next(), 650);
    return () => window.clearTimeout(timer);
  }, [feedback, currentItem?.attemptId]);

  useEffect(() => {
    if (scenario || !continuous || !scenarios.length) return;
    const timer = window.setTimeout(() => {
      setQueue(diversifyInitialQueue(scenarios));
      setScenarioIndex(0);
      setStepIndex(0);
      resetDecisionState();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [scenario, continuous, scenarios]);

  useEffect(() => {
    if (scenario || continuous || !autoComplete || completionSent.current) return;
    completionSent.current = true;
    onComplete();
  }, [scenario, continuous, autoComplete, onComplete]);
  useEffect(() => { if (scenario) completionSent.current = false; }, [scenario]);

  if (!scenario || !step) {
    if ((continuous && scenarios.length) || autoComplete) return <div className="grid min-h-[55vh] place-items-center text-sm text-slate-500">正在自動重排下一批牌局…</div>;
    return <SessionComplete decisions={decisionCount} accuracy={accuracy} evLoss={evLoss} onRestart={() => {
      setQueue(diversifyInitialQueue(scenarios)); setScenarioIndex(0); setStepIndex(0); setSessionItems([]); resetDecisionState();
    }} onComplete={onComplete} onExit={onExit} />;
  }

  function resetDecisionState() {
    setSelectedAction(null); setFeedback(null); setShowDetails(false); startedAt.current = Date.now();
  }

  function selectAction(action: ActionType) {
    if (feedback) return;
    const result = step.feedbacks[action];
    if (!result) return;
    const now = Date.now();
    const schedule = getReviewSchedule(result.score, latestPrevious, undefined, now);
    const item: HistoryItem = {
      schemaVersion: 6,
      attemptId: createAttemptId(),
      trainingType: 'scenario',
      scenarioId: scenario.id,
      stepId: step.id,
      masteryKey,
      category: [...(scenario.category || []), ...(step.conceptIds || [])],
      score: result.score,
      judgment: result.judgment,
      timestamp: now,
      selectedAction: action,
      bestAction: result.bestAction,
      street: step.street,
      position: scenario.position,
      durationMs: now - startedAt.current,
      correct: result.score >= 8,
      feedbackQuality: resolveFeedbackQuality(result),
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
  }

  function next() {
    const nextStepId = feedback?.nextStepId;
    if (nextStepId && nextStepId !== 'next_hand') {
      const nextStepIndex = scenario.steps.findIndex(candidate => candidate.id === nextStepId);
      if (nextStepIndex >= 0) { setStepIndex(nextStepIndex); resetDecisionState(); return; }
    }
    const nextIndex = scenarioIndex + 1;
    if (nextIndex < queue.length) {
      setQueue(previous => {
        const prefix = previous.slice(0, nextIndex);
        const remaining = previous.slice(nextIndex);
        return [...prefix, ...adaptiveDiversify(remaining, mergeHistory(history, sessionItems), currentItem)];
      });
    }
    setScenarioIndex(nextIndex); setStepIndex(0); resetDecisionState();
  }

  return <div className="mx-auto max-w-5xl space-y-4" data-testid="frictionless-training-session">
    <SessionTopBar title={title} handNumber={scenarioIndex + 1} handCount={queue.length} accuracy={accuracy} decisions={decisionCount} evLoss={evLoss} onExit={onExit} continuous={continuous} />
    <TeachingTable scenario={scenario} step={step} latestPrevious={latestPrevious} />
    <DecisionDock step={step} feedback={feedback} selectedAction={selectedAction} onAction={selectAction} />
    {feedback && currentItem && <TeachingReview scenario={scenario} step={step} feedback={feedback} item={currentItem} selectedAction={selectedAction} showDetails={showDetails} onToggleDetails={() => setShowDetails(value => !value)} onNext={next} />}
  </div>;
}

function diversifyInitialQueue(scenarios: Scenario[]): Scenario[] {
  const copy = [...scenarios];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function adaptiveDiversify(candidates: Scenario[], history: HistoryItem[], current?: HistoryItem): Scenario[] {
  if (candidates.length <= 1) return candidates;
  const ranked = rankByExpectedLearningValue(candidates, history, Date.now());
  const topWindow = Math.min(ranked.length, current?.correct === false ? 6 : 4);
  const top = ranked.slice(0, topWindow).map(entry => entry.scenario);
  const rest = ranked.slice(topWindow).map(entry => entry.scenario);
  for (let index = top.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [top[index], top[swap]] = [top[swap], top[index]];
  }
  return [...top, ...rest];
}

function mergeHistory(history: HistoryItem[], sessionItems: HistoryItem[]): HistoryItem[] {
  const byKey = new Map<string, HistoryItem>();
  [...history, ...sessionItems].forEach(item => byKey.set(item.attemptId || `${item.scenarioId}:${item.timestamp}:${item.selectedAction || ''}`, item));
  return [...byKey.values()];
}

function SessionTopBar({ title, handNumber, handCount, accuracy, decisions, evLoss, onExit, continuous }: {
  title: string; handNumber: number; handCount: number; accuracy: number; decisions: number; evLoss: number; onExit: () => void; continuous: boolean;
}) {
  const progress = handCount ? Math.min(100, (handNumber - 1) / handCount * 100) : 0;
  return <header className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={onExit} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"><ArrowLeft className="h-4 w-4" />離開</button>
      <div className="min-w-[200px] flex-1"><div className="flex justify-between gap-3"><span className="truncate text-sm font-semibold">{title}</span><span className="font-mono text-xs text-slate-500">{continuous ? `HAND ${handNumber}` : `HAND ${handNumber}/${handCount}`}</span></div>{!continuous && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>}</div>
      <div className="flex gap-2 text-xs"><Metric label="決策" value={String(decisions)} /><Metric label="正確率" value={decisions ? `${accuracy}%` : '-'} /><Metric label="EV Leak" value={`${evLoss.toFixed(2)} BB`} /></div>
    </div>
  </header>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"><span className="text-slate-600">{label}</span><span className="ml-2 font-mono text-slate-200">{value}</span></div>; }

function TeachingTable({ scenario, step, latestPrevious }: { scenario: Scenario; step: ScenarioStep; latestPrevious?: HistoryItem }) {
  return <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/65 px-5 py-3 text-xs text-slate-400">
      <div className="flex flex-wrap gap-2"><Pill>{scenario.type}</Pill><Pill>{scenario.tableSize?.toUpperCase() || '9MAX'}</Pill><Pill>{step.street}</Pill>{latestPrevious && <Pill>{isDelayedReview(latestPrevious) ? '自動複習' : '近期重練'}</Pill>}</div>
      <span>{scenario.blinds} · Effective {scenario.effectiveStack}</span>
    </div>
    <div className="p-5 md:p-7">
      <div className="rounded-2xl border border-emerald-500/15 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),rgba(2,6,23,0.55)_65%)] p-6 text-center">
        <div className="flex min-h-20 items-center justify-center gap-2">{step.communityCards.length ? step.communityCards.map((card, index) => <CardUI key={`${card.rank}-${card.suit}-${index}`} card={card} size="sm" />) : <span className="rounded-xl border border-dashed border-slate-700 px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-600">Preflop</span>}</div>
        <div className="mt-4 text-xs uppercase tracking-[0.18em] text-emerald-400/70">Pot <span className="ml-1 font-mono text-lg font-black text-emerald-300">{step.potSize} BB</span></div>
        <div className="mt-6 flex items-end justify-center gap-2">{scenario.holeCards.map((card, index) => <CardUI key={`${card.rank}-${card.suit}-${index}`} card={card} size="sm" />)}</div>
        <div className="mt-2 text-xs font-semibold text-emerald-200">Hero · {scenario.position} · {scenario.userBB}BB</div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[0.8fr_1.2fr]"><Context label="前序行動" value={scenario.preAction} /><Context label="現在的問題" value={step.description} /></div>
      {(step.spr !== undefined || step.potOdds) && <div className="mt-3 flex flex-wrap gap-2">{step.spr !== undefined && <Pill>SPR {step.spr}</Pill>}{step.potOdds && <Pill>Pot Odds {step.potOdds}</Pill>}</div>}
    </div>
  </section>;
}

function Context({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-900/35 p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">{label}</div><div className="mt-2 text-sm leading-6 text-slate-300">{value}</div></div>; }
function Pill({ children }: { children: ReactNode }) { return <span className="rounded-full border border-slate-800 bg-slate-950/40 px-3 py-1 text-[11px] text-slate-400">{children}</span>; }

function DecisionDock({ step, feedback, selectedAction, onAction }: { step: ScenarioStep; feedback: Feedback | null; selectedAction: ActionType | null; onAction: (action: ActionType) => void }) {
  return <section className="rounded-2xl border border-slate-800 bg-slate-900/65 p-5" data-testid="decision-dock">
    {!feedback ? <><div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">你的決策</div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{step.options.map(option => <button data-testid="decision-action" key={option} type="button" onClick={() => onAction(option)} className="min-h-16 rounded-xl border border-slate-700 bg-slate-950/45 px-5 py-4 text-left font-bold text-slate-100 transition hover:border-emerald-500/45">{ACTION_LABELS[option] || option}</button>)}</div><p className="mt-3 text-center text-xs text-slate-600">不用填把握度或其他資料；選動作就好。</p></> : <div className="flex flex-wrap items-center gap-3 text-sm"><span className="text-slate-500">你</span><strong>{selectedAction ? ACTION_LABELS[selectedAction] || selectedAction : '-'}</strong><ArrowRight className="h-4 w-4 text-slate-700" /><span className="text-slate-500">最佳線</span><strong className="text-emerald-300">{ACTION_LABELS[feedback.bestAction] || feedback.bestAction}</strong></div>}
  </section>;
}

function TeachingReview({ scenario, step, feedback, item, selectedAction, showDetails, onToggleDetails, onNext }: {
  scenario: Scenario; step: ScenarioStep; feedback: Feedback; item: HistoryItem; selectedAction: ActionType | null; showDetails: boolean; onToggleDetails: () => void; onNext: () => void;
}) {
  const correct = item.correct;
  if (correct) return <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/6 px-5 py-4" data-testid="quick-correct-feedback"><div className="flex items-center gap-3"><CheckCircle2 className="h-6 w-6 text-emerald-400" /><div><div className="font-semibold text-emerald-100">正確 · 自動下一手</div><div className="mt-1 text-xs text-slate-500">{feedback.remember}</div></div></div></section>;
  return <section className="rounded-2xl border border-red-500/25 bg-red-500/6 p-5" data-testid="leak-feedback">
    <div className="flex gap-3"><XCircle className="mt-0.5 h-7 w-7 shrink-0 text-red-400" /><div className="min-w-0 flex-1"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">這手值得停一下</div><h3 className="mt-1 text-xl font-semibold text-white">{selectedAction ? ACTION_LABELS[selectedAction] || selectedAction : '-'} → {ACTION_LABELS[feedback.bestAction] || feedback.bestAction}</h3>
      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/7 p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-300"><Lightbulb className="h-4 w-4" />只記這一句</div><p className="mt-2 text-base font-medium leading-7 text-slate-100">{feedback.remember}</p></div>
      {typeof item.evLossBB === 'number' && <div className="mt-3 text-sm text-red-200">EV loss：{Math.max(0, item.evLossBB).toFixed(2)} BB</div>}
      <div className="mt-4 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 text-sm leading-6 text-emerald-100">已自動寫入玩家模型。後續牌局會提高同類 spot、到期複習與可驗證 decision-boundary 變化題的權重。</div>
      <button type="button" onClick={onToggleDetails} className="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950/35 px-4 py-3 text-left text-sm text-slate-300"><span className="flex items-center gap-2"><Brain className="h-4 w-4 text-emerald-400" />想深入再看原因與證據</span>{showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
      {showDetails && <DeepEvidence scenario={scenario} step={step} feedback={feedback} item={item} />}
      <div className="mt-5 flex justify-end"><button type="button" onClick={onNext} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-emerald-950">下一個決策<ArrowRight className="h-4 w-4" /></button></div>
    </div></div>
  </section>;
}

function DeepEvidence({ scenario, step, feedback, item }: { scenario: Scenario; step: ScenarioStep; feedback: Feedback; item: HistoryItem }) {
  const evidence = feedback.evidence;
  return <div className="mt-3 grid gap-3 md:grid-cols-2">
    <EvidenceCard icon={<Brain className="h-4 w-4" />} title="為什麼"><p className="text-xs leading-6 text-slate-300">{feedback.why}</p>{feedback.conceptualError !== '無' && <Fact label="真正漏點" value={feedback.conceptualError} />}</EvidenceCard>
    <EvidenceCard icon={<Calculator className="h-4 w-4" />} title="Math / EV"><Fact label="Pot" value={`${step.potSize} BB`} /><Fact label="SPR" value={step.spr === undefined ? undefined : String(step.spr)} /><Fact label="Pot odds" value={step.potOdds} /><Fact label="Chosen EV" value={evidence?.actionEvBB === undefined ? undefined : `${evidence.actionEvBB.toFixed(2)} BB`} /><Fact label="Best EV" value={evidence?.bestEvBB === undefined ? undefined : `${evidence.bestEvBB.toFixed(2)} BB`} /></EvidenceCard>
    <EvidenceCard icon={<Target className="h-4 w-4" />} title="策略會在哪裡翻轉">{evidence?.reversals?.map((text, index) => <div key={`${text}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/35 px-3 py-2 text-xs leading-5 text-slate-300">{text}</div>)}{!evidence?.reversals?.length && <Unknown />}</EvidenceCard>
    <EvidenceCard icon={<Sparkles className="h-4 w-4" />} title="證據邊界"><Fact label="Strategy source" value={step.strategySource} /><Fact label="Truth tier" value={evidence?.sourceConfidence} /><Fact label="情境" value={`${scenario.type} · ${scenario.position} · ${scenario.effectiveStack}`} />{!step.strategySource && !evidence?.sourceConfidence && <Unknown />}</EvidenceCard>
  </div>;
}

function EvidenceCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-400">{icon}{title}</div><div className="space-y-2">{children}</div></div>; }
function Fact({ label, value }: { label: string; value?: string }) { return value ? <div className="flex gap-3 text-xs"><span className="min-w-24 text-slate-600">{label}</span><span className="leading-5 text-slate-300">{value}</span></div> : null; }
function Unknown() { return <p className="text-xs leading-5 text-slate-600">沒有足夠 machine-readable 證據時就停在 Unknown，不要求你補資料。</p>; }

function SessionComplete({ decisions, accuracy, evLoss, onRestart, onComplete, onExit }: { decisions: number; accuracy: number; evLoss: number; onRestart: () => void; onComplete: () => void; onExit: () => void }) {
  return <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/60 p-8 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" /><h2 className="mt-4 text-2xl font-bold">這輪完成</h2><p className="mt-2 text-sm text-slate-400">想繼續就直接再打一輪；所有分析已經自動記錄。</p><div className="mt-6 grid grid-cols-3 gap-3"><Metric label="決策" value={String(decisions)} /><Metric label="正確率" value={`${accuracy}%`} /><Metric label="EV Leak" value={`${evLoss.toFixed(2)} BB`} /></div><div className="mt-7 flex flex-wrap justify-center gap-3"><button type="button" onClick={onRestart} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-emerald-950"><RotateCcw className="h-4 w-4" />再打一輪</button><button type="button" onClick={onComplete} className="rounded-xl border border-slate-700 px-5 py-3 text-sm text-slate-300">回首頁</button><button type="button" onClick={onExit} className="rounded-xl px-5 py-3 text-sm text-slate-500">離開</button></div></div>;
}
