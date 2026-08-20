import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Brain, Calculator, CheckCircle2, ChevronDown, ChevronUp,
  Clock3, Lightbulb, RotateCcw, ShieldQuestion, Sparkles, Target, XCircle,
} from 'lucide-react';
import { CardUI } from '../../components/CardUI';
import { companionStateFromScenario } from '../../companion/adapters';
import { clearCompanionHandState, publishCompanionHandState } from '../../companion/handStateBus';
import {
  getDifficultyWeight,
  getHistoryMasteryKey,
  isDelayedReview,
  makeMasteryKey,
  resolveFeedbackQuality,
} from '../../learning-engine';
import { scenarioContextFamilyId, inferSituationIdsFromScenario } from '../../learning-engine/contextIdentity';
import { rankByExpectedLearningValue } from '../../learning-engine/trainingValue';
import { ActionType, ConfidenceLevel, Feedback, HistoryItem, Scenario, ScenarioStep } from '../../types';
import { createAttemptId, getReviewSchedule } from '../../utils/history';

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

interface TeachingCheck {
  prompt: string;
  options: [string, string];
  correctIndex: 0 | 1;
  explanation: string;
  kind: 'boundary' | 'assumption' | 'retrieval';
}

export function TrainingSessionV12({ scenarios, history, title, onRecord, onExit, onComplete }: TrainingSessionProps) {
  const [queue, setQueue] = useState<Scenario[]>(() => diversifyInitialQueue(scenarios));
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [sessionItems, setSessionItems] = useState<HistoryItem[]>([]);
  const [showWhy, setShowWhy] = useState(false);
  const [showDeep, setShowDeep] = useState(false);
  const [checkAnswer, setCheckAnswer] = useState<number | null>(null);
  const startedAt = useRef(Date.now());

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
  const teachingCheck = useMemo(() => step && feedback ? buildTeachingCheck(step, feedback) : null, [step, feedback]);

  useEffect(() => {
    if (!scenario || !step) {
      clearCompanionHandState();
      return;
    }
    publishCompanionHandState(companionStateFromScenario(scenario, stepIndex, {
      mode: 'training', handComplete: Boolean(feedback), decisionLocked: !feedback,
    }));
  }, [scenario, step, stepIndex, feedback]);
  useEffect(() => () => clearCompanionHandState(), []);

  if (!scenario || !step) {
    return <SessionComplete decisions={decisionCount} accuracy={accuracy} evLoss={evLoss} onRestart={() => {
      setQueue(diversifyInitialQueue(scenarios)); setScenarioIndex(0); setStepIndex(0); setSessionItems([]); resetDecisionState();
    }} onComplete={onComplete} onExit={onExit} />;
  }

  function resetDecisionState() {
    setSelectedAction(null); setConfidence(null); setFeedback(null); setShowWhy(false); setShowDeep(false); setCheckAnswer(null); startedAt.current = Date.now();
  }

  function selectAction(action: ActionType) {
    if (feedback || !confidence) return;
    const result = step.feedbacks[action];
    if (!result) return;
    const now = Date.now();
    const schedule = getReviewSchedule(result.score, confidence, latestPrevious, now);
    const item: HistoryItem = {
      schemaVersion: 5,
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
      confidence,
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

  function answerTeachingCheck(index: number) {
    if (!teachingCheck || checkAnswer !== null || !currentItem) return;
    setCheckAnswer(index);
    const correct = index === teachingCheck.correctIndex;
    const now = Date.now();
    const item: HistoryItem = {
      schemaVersion: 5,
      attemptId: createAttemptId(),
      trainingType: 'transfer',
      scenarioId: `${scenario.id}:teaching-check:${step.id}`,
      stepId: teachingCheck.kind,
      masteryKey: makeMasteryKey(`${scenario.id}:teaching-check`, `${step.id}:${teachingCheck.kind}`),
      category: [...(scenario.category || []), 'Transfer', teachingCheck.kind],
      score: correct ? 10 : 0,
      judgment: correct ? '正確' : '錯誤',
      timestamp: now,
      selectedAction: teachingCheck.options[index],
      bestAction: teachingCheck.options[teachingCheck.correctIndex],
      street: step.street,
      position: scenario.position,
      confidence: currentItem.confidence,
      correct,
      feedbackQuality: correct ? 'best' : 'major-error',
      isTransferTest: true,
      questionLabel: `${scenario.title} · 邊界檢查`,
      contextFamilyId: scenarioContextFamilyId(scenario),
      situationIds: inferSituationIdsFromScenario(scenario),
      ...getReviewSchedule(correct ? 10 : 0, currentItem.confidence, undefined, now),
    };
    setSessionItems(previous => [...previous, item]);
    onRecord(item);
  }

  function next() {
    const nextStepId = feedback?.nextStepId;
    if (nextStepId && nextStepId !== 'next_hand') {
      const nextStepIndex = scenario.steps.findIndex(candidate => candidate.id === nextStepId);
      if (nextStepIndex >= 0) {
        setStepIndex(nextStepIndex); resetDecisionState(); return;
      }
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

  return <div className="mx-auto max-w-5xl space-y-4">
    <SessionTopBar title={title} handNumber={scenarioIndex + 1} handCount={queue.length} accuracy={accuracy} decisions={decisionCount} evLoss={evLoss} onExit={onExit} />
    <TeachingTable scenario={scenario} step={step} latestPrevious={latestPrevious} />
    <DecisionDock step={step} feedback={feedback} selectedAction={selectedAction} confidence={confidence} onConfidence={setConfidence} onAction={selectAction} />
    {feedback && currentItem && <TeachingReview
      scenario={scenario}
      step={step}
      feedback={feedback}
      item={currentItem}
      selectedAction={selectedAction}
      showWhy={showWhy}
      showDeep={showDeep}
      teachingCheck={teachingCheck}
      checkAnswer={checkAnswer}
      onToggleWhy={() => setShowWhy(value => !value)}
      onToggleDeep={() => setShowDeep(value => !value)}
      onCheck={answerTeachingCheck}
      onNext={next}
    />}
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
  const topWindow = Math.min(ranked.length, current?.correct === false || (current?.confidence || 4) <= 2 ? 6 : 4);
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

function buildTeachingCheck(step: ScenarioStep, feedback: Feedback): TeachingCheck {
  const reversal = feedback.evidence?.reversals?.[0];
  if (reversal) return {
    prompt: `只改一個條件：${reversal}\n這時還能直接照抄剛才的答案嗎？`,
    options: ['不能，決策邊界可能已翻轉，要重新算', '可以，原答案永遠不受這個條件影響'],
    correctIndex: 0,
    explanation: '題庫把這個條件標成答案反轉條件；重點不是背新答案，而是知道哪個變數會讓策略翻面。',
    kind: 'boundary',
  };
  const assumption = step.assumptions?.[0];
  if (assumption) return {
    prompt: `這題成立的假設是「${assumption}」。如果這個假設不成立，還能直接套用原規則嗎？`,
    options: ['不能，先重建情境再決策', '可以，假設不影響任何策略'],
    correctIndex: 0,
    explanation: '能指出答案依賴哪些假設，比背住單一動作更接近實戰能力。',
    kind: 'assumption',
  };
  return {
    prompt: '不看上面的答案，下一手最應該帶走哪個規則？',
    options: [feedback.remember, feedback.conceptualError === '無' ? '只要這手贏了，決策就是正確的' : `繼續沿用：${feedback.conceptualError}`],
    correctIndex: 0,
    explanation: '目標是把這手壓縮成可在下一個陌生 spot 提取的規則，而不是記牌面。',
    kind: 'retrieval',
  };
}

function SessionTopBar({ title, handNumber, handCount, accuracy, decisions, evLoss, onExit }: {
  title: string; handNumber: number; handCount: number; accuracy: number; decisions: number; evLoss: number; onExit: () => void;
}) {
  const progress = handCount ? Math.min(100, (handNumber - 1) / handCount * 100) : 0;
  return <header className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 shadow-xl shadow-black/10">
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={onExit} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"><ArrowLeft className="h-4 w-4" />離開</button>
      <div className="min-w-[200px] flex-1"><div className="flex justify-between gap-3"><span className="truncate text-sm font-semibold">{title}</span><span className="font-mono text-xs text-slate-500">HAND {handNumber}/{handCount}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div></div>
      <div className="flex gap-2 text-xs"><Metric label="決策" value={String(decisions)} /><Metric label="正確率" value={decisions ? `${accuracy}%` : '-'} /><Metric label="EV Leak" value={`${evLoss.toFixed(2)} BB`} /></div>
    </div>
  </header>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"><span className="text-slate-600">{label}</span><span className="ml-2 font-mono text-slate-200">{value}</span></div>; }

function TeachingTable({ scenario, step, latestPrevious }: { scenario: Scenario; step: ScenarioStep; latestPrevious?: HistoryItem }) {
  return <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/20">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/65 px-5 py-3 text-xs text-slate-400">
      <div className="flex flex-wrap gap-2"><Pill>{scenario.type}</Pill><Pill>{scenario.tableSize?.toUpperCase() || '9MAX'}</Pill><Pill>{step.street}</Pill><Pill>{scenario.difficulty}</Pill>{latestPrevious && <Pill>{isDelayedReview(latestPrevious) ? '延遲複習' : '近期重練'}</Pill>}</div>
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

function DecisionDock({ step, feedback, selectedAction, confidence, onConfidence, onAction }: {
  step: ScenarioStep; feedback: Feedback | null; selectedAction: ActionType | null; confidence: ConfidenceLevel | null; onConfidence: (value: ConfidenceLevel) => void; onAction: (action: ActionType) => void;
}) {
  return <section className="rounded-2xl border border-slate-800 bg-slate-900/65 p-5 shadow-xl shadow-black/10">
    {!feedback ? <>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400"><ShieldQuestion className="h-4 w-4" />先說你有多確定</div>
      <div className="mt-3 flex flex-wrap gap-2">{CONFIDENCE.map(item => <button key={item.value} type="button" onClick={() => onConfidence(item.value)} className={`rounded-lg border px-3 py-2 text-left ${confidence === item.value ? 'border-amber-400/60 bg-amber-400/10 text-amber-200' : 'border-slate-700 bg-slate-950/30 text-slate-400'}`}><span className="text-xs font-semibold">{item.label}</span><span className="ml-2 text-[10px] opacity-60">{item.hint}</span></button>)}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{step.options.map(option => <button key={option} type="button" disabled={!confidence} onClick={() => onAction(option)} className="min-h-16 rounded-xl border border-slate-700 bg-slate-950/45 px-5 py-4 text-left font-bold text-slate-100 transition hover:border-emerald-500/45 disabled:cursor-not-allowed disabled:opacity-35">{ACTION_LABELS[option] || option}</button>)}</div>
      {!confidence && <p className="mt-3 text-center text-xs text-slate-600">先鎖定把握度，再做決策；避免看到答案後改寫自己的信心。</p>}
    </> : <div className="flex flex-wrap items-center gap-3 text-sm"><span className="text-slate-500">你的決策</span><strong>{selectedAction ? ACTION_LABELS[selectedAction] || selectedAction : '-'}</strong><ArrowRight className="h-4 w-4 text-slate-700" /><span className="text-slate-500">最佳線</span><strong className="text-emerald-300">{ACTION_LABELS[feedback.bestAction] || feedback.bestAction}</strong></div>}
  </section>;
}

function TeachingReview({ scenario, step, feedback, item, selectedAction, showWhy, showDeep, teachingCheck, checkAnswer, onToggleWhy, onToggleDeep, onCheck, onNext }: {
  scenario: Scenario; step: ScenarioStep; feedback: Feedback; item: HistoryItem; selectedAction: ActionType | null; showWhy: boolean; showDeep: boolean; teachingCheck: TeachingCheck | null; checkAnswer: number | null;
  onToggleWhy: () => void; onToggleDeep: () => void; onCheck: (index: number) => void; onNext: () => void;
}) {
  const correct = item.correct;
  return <section className={`rounded-2xl border p-5 shadow-xl shadow-black/10 ${correct ? 'border-emerald-500/30 bg-emerald-500/6' : 'border-red-500/25 bg-red-500/6'}`}>
    <div className="flex gap-3">{correct ? <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 h-7 w-7 shrink-0 text-red-400" />}<div className="min-w-0 flex-1">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">第 1 層 · 10 秒懂</div>
      <h3 className="mt-1 text-xl font-semibold text-white">{feedback.judgment} · {selectedAction ? ACTION_LABELS[selectedAction] || selectedAction : '-'} → {ACTION_LABELS[feedback.bestAction] || feedback.bestAction}</h3>
      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/7 p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-300"><Lightbulb className="h-4 w-4" />只先記這一句</div><p className="mt-2 text-base font-medium leading-7 text-slate-100">{feedback.remember}</p></div>

      <button type="button" onClick={onToggleWhy} className="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950/35 px-4 py-3 text-left text-sm font-semibold text-slate-200"><span className="flex items-center gap-2"><Brain className="h-4 w-4 text-emerald-400" />第 2 層 · 我想知道為什麼</span>{showWhy ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
      {showWhy && <div className="mt-3 space-y-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-xs font-semibold text-slate-500">因果鏈</div><p className="mt-2 text-sm leading-7 text-slate-200">{feedback.why}</p></div>
        {feedback.conceptualError !== '無' && <div className="rounded-xl border border-red-500/15 bg-red-500/5 p-4"><div className="text-xs font-semibold text-red-300">真正漏點</div><p className="mt-2 text-sm leading-6 text-slate-300">{feedback.conceptualError}</p></div>}

        {teachingCheck && <div className="rounded-2xl border border-violet-500/20 bg-violet-500/6 p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-300"><Target className="h-4 w-4" />第 3 層 · 換一個條件還會嗎</div><p className="mt-3 whitespace-pre-line text-sm font-medium leading-6 text-slate-100">{teachingCheck.prompt}</p><div className="mt-3 grid gap-2 md:grid-cols-2">{teachingCheck.options.map((option, index) => { const answered = checkAnswer !== null; const right = index === teachingCheck.correctIndex; const chosen = index === checkAnswer; return <button key={option} type="button" disabled={answered} onClick={() => onCheck(index)} className={`rounded-xl border px-4 py-3 text-left text-sm ${answered && right ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : answered && chosen ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-slate-700 bg-slate-950/35 text-slate-300 hover:border-violet-500/40'}`}>{option}</button>; })}</div>{checkAnswer !== null && <p className="mt-3 text-xs leading-5 text-slate-400">{teachingCheck.explanation}</p>}</div>}

        <button type="button" onClick={onToggleDeep} className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950/25 px-4 py-3 text-left text-sm text-slate-400"><span className="flex items-center gap-2"><Sparkles className="h-4 w-4" />進階證據：Range / EV / 假設</span>{showDeep ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
        {showDeep && <DeepEvidence scenario={scenario} step={step} feedback={feedback} item={item} />}
      </div>}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/60 pt-5"><div className="flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-4 w-4" />{item.nextReviewAt ? `下次提取：${new Date(item.nextReviewAt).toLocaleString('zh-TW')}` : '已寫入玩家模型'}</div><button type="button" onClick={onNext} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-emerald-950 hover:bg-emerald-400">下一個決策<ArrowRight className="h-4 w-4" /></button></div>
    </div></div>
  </section>;
}

function DeepEvidence({ scenario, step, feedback, item }: { scenario: Scenario; step: ScenarioStep; feedback: Feedback; item: HistoryItem }) {
  const evidence = feedback.evidence;
  return <div className="grid gap-3 md:grid-cols-2">
    <EvidenceCard icon={<Brain className="h-4 w-4" />} title="Range / Blocker"><Fact label="Hero range" value={evidence?.heroRange} /><Fact label="Villain range" value={evidence?.villainRange} /><Fact label="Continues" value={evidence?.continues} /><Fact label="Blocker" value={evidence?.blockers} /></EvidenceCard>
    <EvidenceCard icon={<Calculator className="h-4 w-4" />} title="Math / EV"><Fact label="Pot" value={`${step.potSize} BB`} /><Fact label="SPR" value={step.spr === undefined ? undefined : String(step.spr)} /><Fact label="Pot odds" value={step.potOdds} /><Fact label="Chosen EV" value={evidence?.actionEvBB === undefined ? undefined : `${evidence.actionEvBB.toFixed(2)} BB`} /><Fact label="Best EV" value={evidence?.bestEvBB === undefined ? undefined : `${evidence.bestEvBB.toFixed(2)} BB`} /><Fact label="EV leak" value={evidence?.evLossBB === undefined ? undefined : `${evidence.evLossBB.toFixed(2)} BB`} /></EvidenceCard>
    <EvidenceCard icon={<Target className="h-4 w-4" />} title="反轉條件 / 假設">{evidence?.reversals?.map((text, index) => <div key={`${text}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/35 px-3 py-2 text-xs leading-5 text-slate-300">{text}</div>)}{step.assumptions?.map((text, index) => <Fact key={`${text}-${index}`} label="Assumption" value={text} />)}{!evidence?.reversals?.length && !step.assumptions?.length && <Unknown />}</EvidenceCard>
    <EvidenceCard icon={<Sparkles className="h-4 w-4" />} title="可信度邊界"><Fact label="Strategy source" value={step.strategySource} /><Fact label="Truth tier" value={evidence?.sourceConfidence} /><Fact label="情境" value={`${scenario.type} · ${scenario.position} · ${scenario.effectiveStack}`} /><Fact label="你的信心" value={item.confidence ? `${item.confidence}/4` : undefined} />{!step.strategySource && !evidence?.sourceConfidence && <p className="text-xs leading-5 text-slate-500">沒有可驗證 solver / exact evidence 時，只保留題庫已知敘述，不補假精度。</p>}</EvidenceCard>
  </div>;
}

function EvidenceCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-400">{icon}{title}</div><div className="space-y-2">{children}</div></div>; }
function Fact({ label, value }: { label: string; value?: string }) { return value ? <div className="flex gap-3 text-xs"><span className="min-w-24 text-slate-600">{label}</span><span className="leading-5 text-slate-300">{value}</span></div> : null; }
function Unknown() { return <p className="text-xs leading-5 text-slate-600">這題沒有足夠的 machine-readable 證據；不要求補填，也不捏造。</p>; }

function SessionComplete({ decisions, accuracy, evLoss, onRestart, onComplete, onExit }: { decisions: number; accuracy: number; evLoss: number; onRestart: () => void; onComplete: () => void; onExit: () => void }) {
  return <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/60 p-8 text-center shadow-2xl shadow-black/20"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" /><h2 className="mt-4 text-2xl font-bold">這輪完成</h2><p className="mt-2 text-sm text-slate-400">重點不是刷完多少題，而是下一次陌生情境能不能自己推出答案。</p><div className="mt-6 grid grid-cols-3 gap-3"><Metric label="決策" value={String(decisions)} /><Metric label="正確率" value={`${accuracy}%`} /><Metric label="EV Leak" value={`${evLoss.toFixed(2)} BB`} /></div><div className="mt-7 flex flex-wrap justify-center gap-3"><button type="button" onClick={onRestart} className="flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-3 text-sm text-slate-300"><RotateCcw className="h-4 w-4" />換順序再練</button><button type="button" onClick={onComplete} className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-emerald-950">完成並回首頁</button><button type="button" onClick={onExit} className="rounded-xl px-5 py-3 text-sm text-slate-500">離開</button></div></div>;
}
