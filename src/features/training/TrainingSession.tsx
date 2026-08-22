import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BrainCircuit, CheckCircle2, Lightbulb, Scale, XCircle } from 'lucide-react';
import { CardUI } from '../../components/CardUI';
import { getDifficultyWeight, isDelayedReview, makeMasteryKey, resolveFeedbackQuality } from '../../learning-engine';
import { inferSituationIdsFromScenario, scenarioContextFamilyId, scenarioDecisionFamilyId } from '../../learning-engine/contextIdentity';
import { inferScenarioStepSkillIds } from '../../learning-engine/skillGraph';
import { ActionType, Feedback, HistoryItem, ReasoningProbeResult, Scenario, ScenarioStep } from '../../types';
import { analyzeHandMath, evaluateHandStrength } from '../../utils/handMath';
import { createAttemptId, getReviewSchedule } from '../../utils/history';
import { AdvancedToolLinks } from './AdvancedToolLinks';

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

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Keep reasoning checks occasional and only when the scenario owns exact reversal evidence. */
export function shouldShowReasoningProbe(item: HistoryItem, feedback: Feedback): boolean {
  if (!item.correct || feedback.evidence?.sourceConfidence !== 'exact-math' || !feedback.evidence.reversals?.length) return false;
  return stableHash(item.attemptId || `${item.scenarioId}:${item.timestamp}`) % 4 === 0;
}

export function reasoningProbeOptions(reversal: string, attemptSeed: string) {
  const base = [
    { id: 'truth', text: reversal, correct: true },
    { id: 'cosmetic', text: '只要把花色換掉，最佳解就一定翻轉。', correct: false },
    { id: 'never', text: '這題沒有任何輸入變化能讓最佳解翻轉。', correct: false },
  ];
  const offset = stableHash(attemptSeed || reversal) % base.length;
  return [...base.slice(offset), ...base.slice(0, offset)];
}

export function TrainingSession({ scenarios, history, title, continuous = false, autoComplete = false, onRecord, onExit, onComplete }: TrainingSessionProps) {
  const [queue, setQueue] = useState<Scenario[]>(() => shuffled(scenarios));
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [sessionItems, setSessionItems] = useState<HistoryItem[]>([]);
  const startedAt = useRef(Date.now());
  const completionSent = useRef(false);

  const scenario = queue[scenarioIndex];
  const step = scenario?.steps[stepIndex];
  const familyId = scenario ? scenarioDecisionFamilyId(scenario) : '';
  const masteryKey = scenario && step ? makeMasteryKey(familyId, step.id) : '';
  const mergedHistory = useMemo(() => mergeHistory(history, sessionItems), [history, sessionItems]);
  const latestPrevious = useMemo(() => mergedHistory
    .filter(item => item.masteryKey === masteryKey)
    .sort((a, b) => b.timestamp - a.timestamp)[0], [mergedHistory, masteryKey]);
  const currentItem = sessionItems[sessionItems.length - 1];
  const decisions = sessionItems.length;
  const correct = sessionItems.filter(item => item.correct).length;
  const accuracy = decisions ? Math.round(correct / decisions * 100) : 0;
  const evLoss = sessionItems.reduce((sum, item) => sum + (typeof item.evLossBB === 'number' ? Math.max(0, item.evLossBB) : 0), 0);
  const handStrength = useMemo(
    () => scenario && step ? evaluateHandStrength(scenario.holeCards, step.communityCards) : null,
    [scenario, step],
  );
  const handMath = useMemo(
    () => scenario && step ? analyzeHandMath(scenario.holeCards, step.communityCards, step.potOdds) : null,
    [scenario, step],
  );

  useEffect(() => {
    if (scenario || !continuous || !scenarios.length) return;
    const timer = window.setTimeout(() => {
      setQueue(shuffled(scenarios));
      setScenarioIndex(0);
      setStepIndex(0);
      resetDecision();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [scenario, continuous, scenarios]);

  useEffect(() => {
    if (scenario || continuous || !autoComplete || completionSent.current) return;
    completionSent.current = true;
    onComplete();
  }, [scenario, continuous, autoComplete, onComplete]);
  useEffect(() => { if (scenario) completionSent.current = false; }, [scenario]);

  if (!scenario || !step) {
    if ((continuous && scenarios.length) || autoComplete) return <div className="grid min-h-[55vh] place-items-center text-sm text-slate-500">正在切換下一手…</div>;
    return <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-500/20 bg-emerald-500/6 p-8 text-center text-slate-100"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" /><h2 className="mt-4 text-2xl font-bold">這批決策完成</h2><p className="mt-2 text-sm text-slate-400">{decisions} 個決策 · 正確率 {accuracy}%</p><div className="mt-6 flex justify-center gap-3"><button type="button" onClick={onComplete} className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-emerald-950">繼續</button><button type="button" onClick={onExit} className="rounded-xl border border-slate-700 px-5 py-3 text-slate-300">離開</button></div></div>;
  }

  function resetDecision() {
    setSelectedAction(null);
    setFeedback(null);
    startedAt.current = Date.now();
  }

  function selectAction(action: ActionType) {
    if (feedback || !scenario || !step) return;
    const result = step.feedbacks[action];
    if (!result) return;
    const now = Date.now();
    const schedule = getReviewSchedule(result.score, latestPrevious, undefined, now);
    const verifiedCashEv = scenario.type === 'Cash Game'
      && typeof result.evidence?.evLossBB === 'number'
      && Number.isFinite(result.evidence.evLossBB)
      && (result.evidence.sourceConfidence === 'verified-solver' || result.evidence.sourceConfidence === 'exact-math');
    const item: HistoryItem = {
      schemaVersion: 6,
      attemptId: createAttemptId(),
      trainingType: 'scenario',
      scenarioId: scenario.id,
      decisionFamilyId: familyId,
      stepId: step.id,
      masteryKey,
      skillIds: inferScenarioStepSkillIds(scenario, step),
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
      truthTier: result.evidence?.sourceConfidence || 'expert-baseline',
      difficultyWeight: getDifficultyWeight(scenario.difficulty),
      isReview: Boolean(latestPrevious),
      isDelayedReview: isDelayedReview(latestPrevious, now),
      isUnseen: !latestPrevious,
      questionLabel: scenario.title,
      gameFormat: scenario.type === 'Tournament' ? 'MTT' : 'Cash',
      contextFamilyId: scenarioContextFamilyId(scenario),
      situationIds: inferSituationIdsFromScenario(scenario),
      spotFrequencyPer100Hands: scenario.spotFrequencyPer100Hands,
      utilityUnit: verifiedCashEv ? 'bb' : undefined,
      utilityModel: verifiedCashEv ? 'cash-chip-ev' : undefined,
      ...schedule,
    };
    setSelectedAction(action);
    setFeedback(result);
    setSessionItems(previous => [...previous, item]);
    onRecord(item);
  }

  function updateReasoningProbe(result: ReasoningProbeResult) {
    if (!currentItem?.attemptId) return;
    const updated: HistoryItem = {
      ...currentItem,
      reasoningProbeResult: result,
      reasoningConceptIds: [...new Set([...(currentItem.reasoningConceptIds || []), 'decision.boundary'])],
      errorType: result === 'fail' ? 'fragile-knowledge' : currentItem.errorType,
    };
    setSessionItems(previous => previous.map(item => item.attemptId === updated.attemptId ? updated : item));
    onRecord(updated);
  }

  function next() {
    if (!scenario) return;
    const nextStepId = feedback?.nextStepId;
    if (nextStepId && nextStepId !== 'next_hand') {
      const nextStepIndex = scenario.steps.findIndex(candidate => candidate.id === nextStepId);
      if (nextStepIndex >= 0) {
        setStepIndex(nextStepIndex);
        resetDecision();
        return;
      }
    }
    setScenarioIndex(value => value + 1);
    setStepIndex(0);
    resetDecision();
  }

  return <div className="mx-auto max-w-5xl space-y-4 text-slate-100" data-testid="frictionless-training-session">
    <header className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3"><div className="flex flex-wrap items-center gap-3"><button type="button" onClick={onExit} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-400 hover:bg-slate-800"><ArrowLeft className="h-4 w-4" />離開</button><div className="min-w-[190px] flex-1"><div className="text-sm font-semibold">{title}</div><div className="mt-1 text-[11px] text-slate-500">{scenario.type} · {scenario.position} · {step.street} · {scenario.userBB}BB</div></div><div className="flex gap-2 text-xs"><Metric label="決策" value={String(decisions)} /><Metric label="正確率" value={decisions ? `${accuracy}%` : '-'} /><Metric label="EV loss" value={`${evLoss.toFixed(2)} BB`} /></div></div></header>

    <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/65 px-5 py-3 text-xs text-slate-400"><div className="flex flex-wrap gap-2"><Pill>{scenario.type}</Pill><Pill>{scenario.tableSize?.toUpperCase() || '9MAX'}</Pill><Pill>{step.street}</Pill>{latestPrevious && <Pill>{isDelayedReview(latestPrevious) ? '自動複習' : '近期重練'}</Pill>}</div><span>{scenario.blinds} · Effective {scenario.effectiveStack}</span></div>
      <div className="p-5 md:p-7"><div className="rounded-2xl border border-emerald-500/15 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),rgba(2,6,23,0.55)_65%)] p-6 text-center"><div className="flex min-h-20 items-center justify-center gap-2">{step.communityCards.length ? step.communityCards.map((card, index) => <CardUI key={`${card.rank}-${card.suit}-${index}`} card={card} size="sm" />) : <span className="rounded-xl border border-dashed border-slate-700 px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-600">Preflop</span>}</div><div className="mt-4 text-xs uppercase tracking-[0.18em] text-emerald-400/70">Pot <span className="ml-1 font-mono text-lg font-black text-emerald-300">{step.potSize} BB</span></div><div className="mt-6 flex items-end justify-center gap-2">{scenario.holeCards.map((card, index) => <CardUI key={`${card.rank}-${card.suit}-${index}`} card={card} size="sm" />)}</div><div className="mt-2 text-xs font-semibold text-emerald-200">Hero · {scenario.position} · {scenario.userBB}BB</div></div><div className="mt-4 grid gap-3 md:grid-cols-[0.8fr_1.2fr]"><Context label="前序行動" value={scenario.preAction} /><Context label="現在的問題" value={step.description} /></div>{(step.spr !== undefined || step.potOdds) && <div className="mt-3 flex flex-wrap gap-2">{step.spr !== undefined && <Pill>SPR {step.spr}</Pill>}{step.potOdds && <Pill>Pot Odds {step.potOdds}</Pill>}</div>}</div>
    </section>

    <section className="rounded-2xl border border-slate-800 bg-slate-900/65 p-5" data-testid="decision-dock"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{step.options.map(action => <button data-testid="decision-action" key={action} type="button" disabled={Boolean(feedback)} onClick={() => selectAction(action)} className={`rounded-xl border px-4 py-4 text-left text-sm font-semibold transition ${selectedAction === action ? 'border-emerald-400/60 bg-emerald-500/12 text-emerald-100' : 'border-slate-700 bg-slate-950/35 text-slate-200 hover:border-emerald-500/40'} disabled:cursor-default`}>{ACTION_LABELS[action] || action}</button>)}</div></section>

    {feedback && currentItem && <ScenarioExplanation
      feedback={feedback}
      selectedAction={selectedAction}
      currentItem={currentItem}
      scenario={scenario}
      step={step}
      handStrength={handStrength}
      handMath={handMath}
      onReasoningProbe={updateReasoningProbe}
      onNext={next}
    />}
  </div>;
}

function ScenarioExplanation({ feedback, selectedAction, currentItem, scenario, step, handStrength, handMath, onReasoningProbe, onNext }: {
  feedback: Feedback;
  selectedAction: ActionType | null;
  currentItem: HistoryItem;
  scenario: Scenario;
  step: ScenarioStep;
  handStrength: ReturnType<typeof evaluateHandStrength> | null;
  handMath: ReturnType<typeof analyzeHandMath> | null;
  onReasoningProbe: (result: ReasoningProbeResult) => void;
  onNext: () => void;
}) {
  const isCorrect = Boolean(currentItem.correct);
  const tone = isCorrect ? 'border-emerald-500/25 bg-emerald-500/6' : 'border-red-500/25 bg-red-500/6';
  const evidence = evidenceRows(feedback);
  const otherOptions = step.options.filter(action => action !== selectedAction);
  const reversal = feedback.evidence?.reversals?.[0];
  const probeRequired = shouldShowReasoningProbe(currentItem, feedback);
  const probeComplete = !probeRequired || Boolean(currentItem.reasoningProbeResult);

  return <section data-testid="decision-explanation" className={`rounded-2xl border p-5 ${tone}`}>
    <div className="flex gap-3">
      {isCorrect ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-400" />}
      <div className="min-w-0 flex-1 space-y-4">
        <div>
          <div className={`font-semibold ${isCorrect ? 'text-emerald-100' : 'text-red-100'}`}>{isCorrect ? '答對了 · 先看完整解說' : '這個決策需要修正'}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Pill>你：{selectedAction ? ACTION_LABELS[selectedAction] || selectedAction : '-'}</Pill>
            <Pill>最佳解：{ACTION_LABELS[feedback.bestAction] || feedback.bestAction}</Pill>
            <Pill>評分 {feedback.score}/10</Pill>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-200"><Lightbulb className="h-4 w-4" />為什麼</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{feedback.why}</p>
          {feedback.conceptualError && feedback.conceptualError !== '無' && <div className="mt-3 rounded-lg border border-red-500/15 bg-red-500/5 p-3 text-xs leading-5 text-red-200/80"><b>核心觀念：</b>{feedback.conceptualError}</div>}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-200"><Scale className="h-4 w-4" />牌力與數學</div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="目前牌力" value={handStrength?.name || '未分類'} />
            <Fact label="底池" value={`${step.potSize} BB`} />
            <Fact label="SPR" value={step.spr === undefined ? '未提供' : String(step.spr)} />
            <Fact label="Pot Odds" value={step.potOdds || '未提供'} />
          </div>
          {handStrength?.draw && <p className="mt-3 text-xs text-cyan-200/80">聽牌：{handStrength.draw}</p>}
          {handMath?.hasDraw && <p className="mt-1 text-xs text-slate-400">本機聽牌估算：{handMath.drawDescription} · {handMath.outs} outs · 下一張約 {handMath.hitProbNext}%{step.street === 'Flop' ? ` · 到 River 約 ${handMath.hitProbRiver}%` : ''}</p>}
          <p className="mt-2 text-[11px] leading-5 text-slate-600">牌力/outs 是本機結構分析；最佳解仍以此題已驗證 truth 為準。</p>
        </div>

        {probeRequired && <ReasoningProbe reversal={reversal!} attemptSeed={currentItem.attemptId || `${currentItem.scenarioId}:${currentItem.timestamp}`} result={currentItem.reasoningProbeResult} onResult={onReasoningProbe} />}

        {reversal && feedback.evidence?.sourceConfidence === 'exact-math' && <div data-testid="minimal-flip-summary" className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4"><div className="text-xs font-semibold text-fuchsia-200">最小翻轉條件</div><p className="mt-2 text-sm leading-6 text-slate-300">{reversal}</p><p className="mt-2 text-[11px] text-slate-500">這是題目本身的 exact-math reversal；完整 one-variable solver sibling 請開「最小翻轉」。</p></div>}

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-xs font-semibold text-violet-200">Range / EV / Solver 證據</div>
          {evidence.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{evidence.map(([label, value]) => <Fact key={`${label}:${value}`} label={label} value={value} />)}</div> : <p className="mt-2 text-xs leading-5 text-slate-500">這題沒有額外的 per-action EV / range evidence；系統不會補造不存在的數值。</p>}
          {step.strategySource && <p className="mt-3 text-[11px] text-slate-500">Strategy source：{step.strategySource}</p>}
          {step.assumptions?.length ? <div className="mt-2 text-[11px] leading-5 text-slate-500">假設：{step.assumptions.join('；')}</div> : null}
        </div>

        {otherOptions.length > 0 && <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-xs font-semibold text-slate-200">其他選項為什麼不同</div>
          <div className="mt-3 space-y-2">
            {otherOptions.map(action => {
              const alternative = step.feedbacks[action];
              if (!alternative) return null;
              const best = action === feedback.bestAction;
              return <div key={action} className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs"><b className={best ? 'text-emerald-300' : 'text-slate-200'}>{ACTION_LABELS[action] || action}</b><span className="text-slate-600">{alternative.score}/10 · {alternative.judgment}</span>{best && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">最佳解</span>}</div>
                <p className="mt-1.5 text-xs leading-5 text-slate-500">{alternative.why}</p>
              </div>;
            })}
          </div>
        </div>}

        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">下次記住</div>
          <p className="mt-2 text-sm leading-6 text-emerald-100/85">{feedback.remember}</p>
        </div>

        <AdvancedToolLinks tournament={scenario.type === 'Tournament'} />

        <button data-testid="decision-next" type="button" disabled={!probeComplete} onClick={onNext} className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40">{probeComplete ? '看完解說，下一個決策' : '先完成或跳過理解驗證'}</button>
      </div>
    </div>
  </section>;
}

function ReasoningProbe({ reversal, attemptSeed, result, onResult }: { reversal: string; attemptSeed: string; result?: ReasoningProbeResult; onResult: (result: ReasoningProbeResult) => void }) {
  const options = useMemo(() => reasoningProbeOptions(reversal, attemptSeed), [reversal, attemptSeed]);
  return <div data-testid="reasoning-probe" className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
    <div className="flex items-center gap-2 text-xs font-semibold text-amber-200"><BrainCircuit className="h-4 w-4" />理解驗證 · 不是再問一次答案</div>
    <p className="mt-2 text-sm leading-6 text-slate-300">哪一個是這題已被證據支持的「答案翻轉條件」？</p>
    {!result ? <div className="mt-3 grid gap-2">{options.map(option => <button data-testid="reasoning-probe-option" key={option.id} type="button" onClick={() => onResult(option.correct ? 'pass' : 'fail')} className="rounded-lg border border-slate-700 bg-slate-950/35 px-3 py-2 text-left text-xs leading-5 text-slate-300 hover:border-amber-500/40">{option.text}</button>)}<button data-testid="reasoning-probe-skip" type="button" onClick={() => onResult('skipped')} className="text-left text-[11px] text-slate-500">跳過理解驗證</button></div> : <div className={`mt-3 rounded-lg border p-3 text-xs ${result === 'pass' ? 'border-emerald-500/20 bg-emerald-500/6 text-emerald-200' : result === 'fail' ? 'border-red-500/20 bg-red-500/6 text-red-200' : 'border-slate-700 text-slate-400'}`}>{result === 'pass' ? '理解驗證通過：action 與 reversal 都對。' : result === 'fail' ? 'Action 雖然答對，但 reversal mental model 不穩；這題會標記 fragile knowledge。' : '已跳過；不會把它當成理解證據。'}</div>}
  </div>;
}

function evidenceRows(feedback: Feedback): Array<[string, string]> {
  const evidence = feedback.evidence;
  if (!evidence) return [];
  const rows: Array<[string, string]> = [];
  if (evidence.objective) rows.push(['目標', evidence.objective]);
  if (evidence.heroRange) rows.push(['Hero range', evidence.heroRange]);
  if (evidence.villainRange) rows.push(['Villain range', evidence.villainRange]);
  if (evidence.continues) rows.push(['繼續範圍', evidence.continues]);
  if (evidence.blockers) rows.push(['Blockers', evidence.blockers]);
  if (typeof evidence.actionEvBB === 'number') rows.push(['你的 action EV', `${evidence.actionEvBB.toFixed(2)} BB`]);
  if (typeof evidence.bestEvBB === 'number') rows.push(['最佳 action EV', `${evidence.bestEvBB.toFixed(2)} BB`]);
  if (typeof evidence.evLossBB === 'number') rows.push(['EV loss', `${Math.max(0, evidence.evLossBB).toFixed(2)} BB`]);
  if (typeof evidence.actionSizeBB === 'number') rows.push(['你的 sizing', `${evidence.actionSizeBB} BB`]);
  if (typeof evidence.actionSizePot === 'number') rows.push(['你的 sizing / pot', `${Math.round(evidence.actionSizePot * 100)}%`]);
  if (typeof evidence.bestActionSizeBB === 'number') rows.push(['最佳 sizing', `${evidence.bestActionSizeBB} BB`]);
  if (typeof evidence.bestActionSizePot === 'number') rows.push(['最佳 sizing / pot', `${Math.round(evidence.bestActionSizePot * 100)}%`]);
  if (evidence.sourceConfidence) rows.push(['Truth tier', evidence.sourceConfidence]);
  if (evidence.reversals?.length) rows.push(['反轉條件', evidence.reversals.join('；')]);
  return rows;
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function mergeHistory(history: HistoryItem[], sessionItems: HistoryItem[]): HistoryItem[] {
  const byKey = new Map<string, HistoryItem>();
  [...history, ...sessionItems].forEach(item => byKey.set(item.attemptId || `${item.scenarioId}:${item.timestamp}:${item.selectedAction || ''}`, item));
  return [...byKey.values()];
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"><span className="text-slate-600">{label}</span><span className="ml-2 font-mono text-slate-200">{value}</span></div>; }
function Context({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-900/35 p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">{label}</div><div className="mt-2 text-sm leading-6 text-slate-300">{value}</div></div>; }
function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-slate-800/80 bg-slate-900/45 p-3"><div className="text-[10px] uppercase tracking-[0.14em] text-slate-600">{label}</div><div className="mt-1 text-xs leading-5 text-slate-300">{value}</div></div>; }
function Pill({ children }: { children: ReactNode }) { return <span className="rounded-full border border-slate-800 bg-slate-950/40 px-3 py-1 text-[11px] text-slate-400">{children}</span>; }
