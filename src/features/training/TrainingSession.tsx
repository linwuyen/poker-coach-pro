import { ReactNode, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Lightbulb, RotateCcw, XCircle } from 'lucide-react';
import { CardUI } from '../../components/CardUI';
import { ActionType, Feedback, HistoryItem, Scenario } from '../../types';
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

export function TrainingSession({ scenarios, history, title, onRecord, onExit, onComplete }: TrainingSessionProps) {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const startedAt = useRef(Date.now());

  const scenario = scenarios[scenarioIndex];
  const step = scenario?.steps[stepIndex];
  const progress = scenarios.length > 0 ? ((scenarioIndex + (feedback ? 1 : 0)) / scenarios.length) * 100 : 0;
  const averageScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 10) : 0;

  const latestPrevious = useMemo(() => history
    .filter(item => item.scenarioId === scenario?.id)
    .sort((a, b) => b.timestamp - a.timestamp)[0], [history, scenario?.id]);

  if (!scenario || !step) {
    return (
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
        <h2 className="mt-4 text-2xl font-semibold">訓練完成</h2>
        <p className="mt-2 text-sm text-slate-400">本次平均得分 {averageScore}% · 完成 {scores.length} 個決策</p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={onComplete} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">回到今日</button>
          <button type="button" onClick={onExit} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800">選擇其他訓練</button>
        </div>
      </section>
    );
  }

  const selectAction = (action: ActionType) => {
    if (feedback) return;
    const result = step.feedbacks[action];
    if (!result) return;
    const durationMs = Date.now() - startedAt.current;
    const schedule = getReviewSchedule(result.score, latestPrevious);
    const item: HistoryItem = {
      schemaVersion: 3,
      attemptId: createAttemptId(),
      trainingType: 'scenario',
      scenarioId: scenario.id,
      stepId: step.id,
      category: scenario.category || [],
      score: result.score,
      judgment: result.judgment,
      timestamp: Date.now(),
      selectedAction: action,
      bestAction: result.bestAction,
      street: step.street,
      position: scenario.position,
      durationMs,
      isReview: Boolean(latestPrevious),
      questionLabel: scenario.title,
      ...schedule,
    };
    setSelectedAction(action);
    setFeedback(result);
    setScores(previous => [...previous, result.score]);
    onRecord(item);
  };

  const next = () => {
    const nextStepId = feedback?.nextStepId;
    if (nextStepId && nextStepId !== 'next_hand') {
      const nextIndex = scenario.steps.findIndex(item => item.id === nextStepId);
      if (nextIndex >= 0) {
        setStepIndex(nextIndex);
        setSelectedAction(null);
        setFeedback(null);
        startedAt.current = Date.now();
        return;
      }
    }
    setScenarioIndex(index => index + 1);
    setStepIndex(0);
    setSelectedAction(null);
    setFeedback(null);
    startedAt.current = Date.now();
  };

  const restart = () => {
    setScenarioIndex(0);
    setStepIndex(0);
    setSelectedAction(null);
    setFeedback(null);
    setScores([]);
    startedAt.current = Date.now();
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex items-center justify-between gap-4">
        <button type="button" onClick={onExit} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100"><ArrowLeft className="h-4 w-4" />離開</button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-semibold text-slate-200">{title}</div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div>
        </div>
        <div className="text-right text-xs text-slate-500">{scenarioIndex + 1} / {scenarios.length}</div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/55 shadow-2xl shadow-black/20">
        <div className="grid lg:grid-cols-[1fr_280px]">
          <div className="relative min-h-[330px] bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.14),_transparent_62%)] p-5 md:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1">{scenario.type}</span>
              <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1">{step.street}</span>
              <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1">{scenario.difficulty}</span>
            </div>

            <div className="mt-8 flex min-h-28 items-center justify-center gap-2 md:gap-3">
              {step.communityCards.length ? step.communityCards.map((card, index) => <CardUI key={`${card.rank}-${card.suit}-${index}`} card={card} size="sm" />) : <div className="rounded-xl border border-dashed border-slate-700 px-6 py-8 text-sm text-slate-500">翻前決策</div>}
            </div>

            <div className="mt-8 flex items-end justify-between gap-4">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Hero · {scenario.position}</div>
                <div className="flex gap-2">{scenario.holeCards.map((card, index) => <CardUI key={`${card.rank}-${card.suit}-${index}`} card={card} size="sm" />)}</div>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-5 py-4 text-right">
                <div className="text-xs text-emerald-300/70">Pot</div>
                <div className="font-mono text-2xl font-bold text-emerald-300">{step.potSize} BB</div>
              </div>
            </div>
          </div>

          <aside className="border-t border-slate-800 bg-slate-950/45 p-5 lg:border-l lg:border-t-0">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">牌局資訊</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <InfoRow label="盲注" value={scenario.blinds} />
              <InfoRow label="有效籌碼" value={scenario.effectiveStack} />
              <InfoRow label="位置" value={scenario.position} />
              {step.spr !== undefined && <InfoRow label="SPR" value={String(step.spr)} mono />}
              {step.potOdds && <InfoRow label="底池賠率" value={step.potOdds} mono />}
            </dl>
            <div className="mt-6 border-t border-slate-800 pt-5">
              <div className="text-xs text-slate-500">前序行動</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{scenario.preAction}</p>
            </div>
          </aside>
        </div>

        <div className="border-t border-slate-800 p-5 md:p-7">
          <h2 className="text-xl font-semibold leading-relaxed text-white md:text-2xl">{step.description}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {step.options.map(option => {
              const isSelected = selectedAction === option;
              const isBest = Boolean(feedback && feedback.bestAction === option);
              return (
                <button
                  key={option}
                  type="button"
                  disabled={Boolean(feedback)}
                  onClick={() => selectAction(option)}
                  className={`min-h-14 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    isBest ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200' :
                    isSelected ? 'border-red-400 bg-red-500/12 text-red-200' :
                    'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600 hover:bg-slate-800 disabled:cursor-default disabled:opacity-55'
                  }`}
                >
                  {ACTION_LABELS[option] || option}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {feedback && (
        <section className={`mt-5 rounded-2xl border p-5 md:p-6 ${feedback.score >= 8 ? 'border-emerald-500/30 bg-emerald-500/7' : 'border-red-500/25 bg-red-500/6'}`}>
          <div className="flex items-start gap-3">
            {feedback.score >= 8 ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-400" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">{feedback.judgment}</h3>
                <span className="rounded-full bg-slate-950/50 px-3 py-1 font-mono text-sm">{feedback.score * 10} 分</span>
              </div>
              <p className="mt-3 leading-relaxed text-slate-200">{feedback.why}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {feedback.conceptualError !== '無' && <FeedbackNote icon={<XCircle className="h-4 w-4" />} label="概念錯誤" text={feedback.conceptualError} />}
                <FeedbackNote icon={<Lightbulb className="h-4 w-4" />} label="記憶規則" text={feedback.remember} />
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/60 pt-5">
                <div className="flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-4 w-4" />答錯題會自動排入近期複習</div>
                <div className="flex gap-2">
                  <button type="button" onClick={restart} className="rounded-lg border border-slate-700 p-2.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100" title="重新開始"><RotateCcw className="h-4 w-4" /></button>
                  <button type="button" onClick={next} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">下一題<ArrowRight className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex items-center justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className={`text-right font-medium text-slate-200 ${mono ? 'font-mono' : ''}`}>{value}</dd></div>;
}

function FeedbackNote({ icon, label, text }: { icon: ReactNode; label: string; text: string }) {
  return <div className="rounded-xl border border-slate-700/70 bg-slate-950/35 p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{icon}{label}</div><p className="mt-2 text-sm leading-relaxed text-slate-300">{text}</p></div>;
}
