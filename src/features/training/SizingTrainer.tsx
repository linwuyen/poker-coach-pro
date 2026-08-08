import { useRef, useState } from 'react';
import { ArrowLeft, BarChart3, CheckCircle2, Ruler, ShieldAlert } from 'lucide-react';
import { ConfidenceLevel, HistoryItem, PokerDecisionAction } from '../../types';
import { createAttemptId, getReviewSchedule, loadHistory, saveHistory } from '../../utils/history';
import { evRegret, evRegretScore } from '../../learning-engine/ev';
import { getDifficultyWeight, isDelayedReview, makeMasteryKey } from '../../learning-engine';

interface SizingChoice {
  id: string;
  label: string;
  decision: PokerDecisionAction;
  evBB: number;
}
interface SizingSpot {
  id: string;
  title: string;
  context: string;
  street: 'Flop' | 'Turn' | 'River';
  position: string;
  frequencyPer100: number;
  choices: SizingChoice[];
  explanation: string;
}

const SPOTS: SizingSpot[] = [
  {
    id: 'btn-k72r-cbet-size', title: 'BTN vs BB · K♠7♦2♣ C-Bet', context: '100BB SRP，BTN open / BB call，Flop BB check。Hero 持 A♣K♦。', street: 'Flop', position: 'BTN', frequencyPer100: 1.8,
    choices: [
      { id: 'check', label: 'Check', decision: { type: 'check' }, evBB: 1.18 },
      { id: 'bet25', label: 'Bet 25%', decision: { type: 'bet', sizePot: 25 }, evBB: 1.42 },
      { id: 'bet66', label: 'Bet 66%', decision: { type: 'bet', sizePot: 66 }, evBB: 1.31 },
      { id: 'bet125', label: 'Bet 125%', decision: { type: 'bet', sizePot: 125 }, evBB: 0.96 },
    ],
    explanation: '乾燥高牌面通常允許小尺寸高頻率施壓；這組 EV 是教學用相對值，目標是訓練「同樣 Bet 但尺寸不同也有 EV regret」。',
  },
  {
    id: 'river-thin-value-size', title: 'River 薄價值 · 尺寸選擇', context: 'SRP River，Hero 頂對好踢腳，對手範圍含大量 bluff-catcher。', street: 'River', position: 'BTN', frequencyPer100: 0.55,
    choices: [
      { id: 'check', label: 'Check', decision: { type: 'check' }, evBB: 2.95 },
      { id: 'bet33', label: 'Bet 33%', decision: { type: 'bet', sizePot: 33 }, evBB: 3.38 },
      { id: 'bet66', label: 'Bet 66%', decision: { type: 'bet', sizePot: 66 }, evBB: 3.55 },
      { id: 'bet125', label: 'Bet 125%', decision: { type: 'bet', sizePot: 125 }, evBB: 2.74 },
    ],
    explanation: '薄價值的核心不是「有 value 就下注」，而是選能讓較差牌繼續付錢的尺寸；過大尺寸可能把 bluff-catcher 全趕走。',
  },
  {
    id: 'turn-polar-size', title: 'Turn 極化 · 大尺寸還是中尺寸', context: '3-Bet pot Turn，Hero range advantage 下降但 nut advantage 仍在，持強 draw。', street: 'Turn', position: 'CO', frequencyPer100: 0.32,
    choices: [
      { id: 'check', label: 'Check', decision: { type: 'check' }, evBB: 1.74 },
      { id: 'bet50', label: 'Bet 50%', decision: { type: 'bet', sizePot: 50 }, evBB: 1.91 },
      { id: 'bet80', label: 'Bet 80%', decision: { type: 'bet', sizePot: 80 }, evBB: 2.08 },
      { id: 'bet130', label: 'Bet 130%', decision: { type: 'bet', sizePot: 130 }, evBB: 2.02 },
    ],
    explanation: '極化節點可以使用較大尺寸，但「越大越好」仍然錯；當 fold equity 與 river realization 的邊際收益下降，EV 會開始回落。',
  },
];

const CONFIDENCE: Array<{ value: ConfidenceLevel; label: string }> = [
  { value: 1, label: '猜測' }, { value: 2, label: '不太確定' }, { value: 3, label: '大致確定' }, { value: 4, label: '非常確定' },
];

export function SizingTrainer({ onExit }: { onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const startedAt = useRef(Date.now());
  const spot = SPOTS[index % SPOTS.length];
  const best = [...spot.choices].sort((a, b) => b.evBB - a.evBB)[0];
  const choice = spot.choices.find(item => item.id === selected);
  const regret = choice ? evRegret(best.evBB, choice.evBB) : 0;

  const submit = () => {
    if (!choice || !confidence) return;
    const history = loadHistory();
    const now = Date.now();
    const previous = history.filter(item => item.scenarioId === `sizing-${spot.id}`).sort((a, b) => b.timestamp - a.timestamp)[0];
    const score = Math.round(evRegretScore(regret) / 10);
    const item: HistoryItem = {
      schemaVersion: 4,
      attemptId: createAttemptId(),
      trainingType: 'transfer',
      scenarioId: `sizing-${spot.id}`,
      stepId: 'sizing-choice',
      masteryKey: makeMasteryKey(`sizing-${spot.id}`, 'sizing-choice'),
      transferGroupId: 'bet-sizing',
      skillIds: ['postflop.bet-sizing', 'decision.boundary'],
      situationIds: [`situation.street.${spot.street.toLowerCase()}`, choice.decision.sizePot && choice.decision.sizePot >= 100 ? 'situation.size.overbet' : choice.decision.sizePot && choice.decision.sizePot >= 66 ? 'situation.size.large' : choice.decision.sizePot ? 'situation.size.small' : 'situation.size.check'],
      category: ['Bet Sizing', 'EV Regret', spot.street],
      score,
      judgment: choice.id === best.id ? '正確' : regret <= 0.15 ? '可接受' : '需要修正',
      timestamp: now,
      selectedAction: choice.label,
      bestAction: best.label,
      selectedDecision: choice.decision,
      bestDecision: best.decision,
      street: spot.street,
      position: spot.position,
      durationMs: now - startedAt.current,
      confidence,
      correct: regret <= 0.15,
      chosenEvBB: choice.evBB,
      bestEvBB: best.evBB,
      evLossBB: regret,
      truthTier: 'heuristic-estimate',
      spotFrequencyPer100Hands: spot.frequencyPer100,
      difficultyWeight: getDifficultyWeight('中階'),
      isReview: Boolean(previous),
      isDelayedReview: isDelayedReview(previous, now),
      isUnseen: !previous,
      isTransferTest: true,
      questionLabel: spot.title,
      notes: `${spot.explanation}\nEV 數值為教學相對值，不是 solver export。`,
      ...getReviewSchedule(score, confidence, previous, now),
    };
    saveHistory([...history, item]);
    setSubmitted(true);
  };

  const next = () => {
    setIndex(value => (value + 1) % SPOTS.length);
    setSelected(null); setConfidence(null); setSubmitted(false); startedAt.current = Date.now();
  };

  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8"><div className="mx-auto max-w-5xl">
    <button type="button" onClick={onExit} className="pc-interactive flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
    <section className="pc-hero-glow mt-6 rounded-3xl border border-teal-500/20 bg-[linear-gradient(135deg,rgba(20,184,166,0.13),rgba(15,23,42,0.78))] p-6 md:p-8"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-teal-300"><Ruler className="h-4 w-4" />Bet Size as Action</div><h1 className="mt-3 text-3xl font-bold">Bet 對了，不代表尺寸對了</h1><p className="mt-3 text-sm leading-7 text-slate-300">每個尺寸都是不同 action，會分別保存 chosen EV、best EV 與 regret。這讓「Bet 75% 也算 Bet」不再掩蓋尺寸錯誤。</p></section>
    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6"><div className="text-xs text-slate-500">{spot.context}</div><h2 className="mt-2 text-xl font-semibold">{spot.title}</h2><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{spot.choices.map(item => <button key={item.id} type="button" disabled={submitted} onClick={() => setSelected(item.id)} className={`pc-card-lift rounded-2xl border p-4 text-left ${selected === item.id ? 'border-teal-400 bg-teal-500/10' : 'border-slate-800 bg-slate-950/35'}`}><div className="font-semibold">{item.label}</div>{submitted && <div className="mt-2 font-mono text-sm text-slate-400">EV {item.evBB.toFixed(2)}BB</div>}</button>)}</div>
      {!submitted ? <><div className="mt-6 grid gap-2 sm:grid-cols-4">{CONFIDENCE.map(item => <button key={item.value} type="button" onClick={() => setConfidence(item.value)} className={`rounded-xl border px-3 py-3 text-sm ${confidence === item.value ? 'border-amber-400/60 bg-amber-400/10 text-amber-200' : 'border-slate-700 text-slate-400'}`}>{item.label}</button>)}</div><button type="button" disabled={!choice || !confidence} onClick={submit} className="pc-interactive pc-shimmer mt-4 w-full rounded-xl bg-teal-500 px-5 py-3 font-semibold text-teal-950 disabled:opacity-40">提交尺寸決策</button></>
      : <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/6 p-5"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-emerald-400" />EV 回饋</div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label="Best" value={best.label} /><Metric label="Your EV" value={`${choice?.evBB.toFixed(2)}BB`} /><Metric label="EV Regret" value={`${regret.toFixed(2)}BB`} /></div><p className="mt-4 text-sm leading-7 text-slate-300">{spot.explanation}</p><div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/7 p-3 text-xs text-amber-100/80"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />內建數值只用來教尺寸比較；匯入 verified solver EV 後可直接替換這層 Truth。</div><button type="button" onClick={next} className="mt-4 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950">下一題</button></div>}
    </section>
  </div></div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-lg font-bold">{value}</div></div>; }
