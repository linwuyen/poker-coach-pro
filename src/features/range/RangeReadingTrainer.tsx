import { useMemo, useState } from 'react';
import { ArrowLeft, Brain, CheckCircle2, RotateCcw, Target } from 'lucide-react';

type RangeBucket = 'monster' | 'strong' | 'medium' | 'draw' | 'air';

interface RangeQuestion {
  id: string;
  title: string;
  table: string;
  stack: string;
  villain: string;
  action: string[];
  board?: string;
  prompt: string;
  options: Array<{ hand: string; bucket: RangeBucket }>;
  answer: string[];
  explanation: string;
}

const BUCKET_LABELS: Record<RangeBucket, string> = {
  monster: '超強牌', strong: '強牌', medium: '中等牌', draw: '聽牌', air: '空氣／詐唬',
};

const QUESTIONS: RangeQuestion[] = [
  {
    id: 'utg-call-3bet', title: 'UTG 開池後跟 3-Bet', table: '9 人桌', stack: '100BB', villain: 'UTG 一般 TAG',
    action: ['UTG 開到 2.5BB', '你在 BTN 3-Bet 到 8.5BB', 'UTG Call'],
    prompt: '哪些牌最合理地留在對手的跟注範圍？',
    options: [
      { hand: 'AA', bucket: 'monster' }, { hand: 'KK', bucket: 'monster' }, { hand: 'QQ', bucket: 'strong' },
      { hand: 'JJ', bucket: 'strong' }, { hand: 'TT', bucket: 'medium' }, { hand: 'AKs', bucket: 'strong' },
      { hand: 'AQs', bucket: 'strong' }, { hand: '76s', bucket: 'draw' }, { hand: 'KJo', bucket: 'air' },
    ],
    answer: ['QQ', 'JJ', 'TT', 'AKs', 'AQs'],
    explanation: '一般玩家會把 AA、KK 與部分 AK 拿去 4-Bet；UTG 跟注 3-Bet 的核心通常是 QQ–TT、AQs 與部分 AKs。76s 與 KJo 對前位範圍通常太寬。',
  },
  {
    id: 'btn-cbet-k94', title: 'BTN 在 K-9-4 持續下注', table: '6 人桌', stack: '80BB', villain: 'BTN 偏積極',
    action: ['BTN 開到 2.3BB', '你在 BB Call', 'Flop K♠ 9♦ 4♠', '你 Check，BTN 打 33% Pot'],
    board: 'K♠ 9♦ 4♠', prompt: '哪些牌屬於合理的下注範圍？',
    options: [
      { hand: 'KK', bucket: 'monster' }, { hand: '99', bucket: 'monster' }, { hand: 'AK', bucket: 'strong' },
      { hand: 'KQ', bucket: 'strong' }, { hand: 'QQ', bucket: 'medium' }, { hand: 'A♠Q♠', bucket: 'draw' },
      { hand: 'QJ', bucket: 'draw' }, { hand: '76o', bucket: 'air' }, { hand: 'A5', bucket: 'air' },
    ],
    answer: ['KK', '99', 'AK', 'KQ', 'QQ', 'A♠Q♠', 'QJ', 'A5'],
    explanation: '小尺寸持續下注通常保留很寬的範圍：價值牌、口袋對子、同花聽牌、卡順與帶後門權益的 A 高都可能下注。76o 幾乎沒有阻擋牌與後門權益。',
  },
  {
    id: 'turn-check-raise', title: 'Turn 突然 Check-Raise', table: '9 人桌', stack: '100BB', villain: '偏被動常客',
    action: ['CO 開池，BB Call', 'Flop A♦ 7♣ 2♣：BB Check-Call 40%', 'Turn J♠：BB Check-Raise 3 倍'],
    board: 'A♦ 7♣ 2♣ J♠', prompt: '對手的範圍應優先放在哪些牌？',
    options: [
      { hand: 'AJ', bucket: 'monster' }, { hand: '77', bucket: 'monster' }, { hand: '22', bucket: 'monster' },
      { hand: 'A7s', bucket: 'monster' }, { hand: 'AT', bucket: 'strong' }, { hand: '88', bucket: 'medium' },
      { hand: 'K♣Q♣', bucket: 'draw' }, { hand: 'Q♣T♣', bucket: 'draw' }, { hand: '65s', bucket: 'air' },
    ],
    answer: ['AJ', '77', '22', 'A7s', 'K♣Q♣', 'Q♣T♣'],
    explanation: '被動玩家在 Turn Check-Raise 時通常高度極化：兩對、Set 與高權益梅花聽牌。AT、88 這類攤牌價值牌通常不會如此加注。',
  },
  {
    id: 'river-overbet', title: 'River 超池 All-In', table: '6 人桌', stack: '120BB', villain: '有能力詐唬的 LAG',
    action: ['BTN 開池，BB Call', 'Flop Q♥ 8♥ 3♣：BTN Bet，BB Call', 'Turn 2♠：BTN Bet，BB Call', 'River K♣：BTN 150% Pot All-In'],
    board: 'Q♥ 8♥ 3♣ 2♠ K♣', prompt: '哪些牌合理形成極化河牌範圍？',
    options: [
      { hand: 'KK', bucket: 'monster' }, { hand: 'KQ', bucket: 'monster' }, { hand: 'QQ', bucket: 'monster' },
      { hand: 'AQ', bucket: 'strong' }, { hand: 'QJ', bucket: 'medium' }, { hand: 'A♥J♥', bucket: 'air' },
      { hand: 'J♥T♥', bucket: 'air' }, { hand: 'A♣5♣', bucket: 'air' }, { hand: '99', bucket: 'medium' },
    ],
    answer: ['KK', 'KQ', 'QQ', 'A♥J♥', 'J♥T♥'],
    explanation: '超池通常代表極化範圍：能承受跟注的兩對以上，以及錯過的高品質聽牌。AQ、QJ、99 多半有攤牌價值，不適合轉成巨大詐唬。',
  },
  {
    id: 'short-stack-shove', title: '18BB CO 直接 Shove', table: '錦標賽 9 人桌', stack: '18BB', villain: 'CO 一般玩家',
    action: ['前位 Fold 到 CO', 'CO 直接 All-In 18BB'],
    prompt: '哪些牌最可能出現在這個直接推範圍？',
    options: [
      { hand: 'AA', bucket: 'monster' }, { hand: 'KK', bucket: 'monster' }, { hand: '77', bucket: 'strong' },
      { hand: '44', bucket: 'medium' }, { hand: 'AJs', bucket: 'strong' }, { hand: 'ATo', bucket: 'medium' },
      { hand: 'KQs', bucket: 'strong' }, { hand: 'K8o', bucket: 'air' }, { hand: '76s', bucket: 'draw' },
    ],
    answer: ['77', '44', 'AJs', 'ATo', 'KQs'],
    explanation: '18BB 直接推常由不想 Raise/Fold、又有足夠攤牌權益的中口袋對、強 Ax 與高張同花牌組成。AA、KK 更常採小加注誘導。',
  },
  {
    id: 'multiway-donk', title: '多人池翻牌 Donk Bet', table: '9 人桌', stack: '70BB', villain: 'BB 鬆弱玩家',
    action: ['UTG 開池，CO Call，BB Call', 'Flop 8♣ 7♣ 4♦', 'BB 領打 75% Pot'],
    board: '8♣ 7♣ 4♦', prompt: '多人池大尺寸領打通常偏向哪些牌？',
    options: [
      { hand: '88', bucket: 'monster' }, { hand: '77', bucket: 'monster' }, { hand: '65s', bucket: 'monster' },
      { hand: '87s', bucket: 'monster' }, { hand: 'A8', bucket: 'strong' }, { hand: '9♣6♣', bucket: 'draw' },
      { hand: 'A♣5♣', bucket: 'draw' }, { hand: 'KQ', bucket: 'air' }, { hand: '55', bucket: 'medium' },
    ],
    answer: ['88', '77', '65s', '87s', '9♣6♣', 'A♣5♣'],
    explanation: '多人池大尺寸領打通常比單挑更偏強：Set、兩對、順子與高權益複合聽牌。單純一對或弱口袋對通常更常 Check。',
  },
];

function scoreSelection(selected: string[], answer: string[]): number {
  const selectedSet = new Set(selected);
  const answerSet = new Set(answer);
  const truePositive = selected.filter(item => answerSet.has(item)).length;
  const falsePositive = selected.filter(item => !answerSet.has(item)).length;
  const missed = answer.filter(item => !selectedSet.has(item)).length;
  return Math.max(0, Math.round((truePositive * 10 - falsePositive * 5 - missed * 3) / answer.length * 10));
}

export function RangeReadingTrainer({ onExit }: { onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [session, setSession] = useState({ score: 0, answered: 0 });
  const question = QUESTIONS[index];
  const questionScore = useMemo(() => scoreSelection(selected, question.answer), [selected, question]);

  const toggle = (hand: string) => {
    if (submitted) return;
    setSelected(previous => previous.includes(hand) ? previous.filter(item => item !== hand) : [...previous, hand]);
  };
  const next = () => {
    setSession(previous => ({ score: previous.score + questionScore, answered: previous.answered + 1 }));
    setIndex(previous => (previous + 1) % QUESTIONS.length);
    setSelected([]); setSubmitted(false);
  };
  const reset = () => { setIndex(0); setSelected([]); setSubmitted(false); setSession({ score: 0, answered: 0 }); };

  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <button type="button" onClick={onExit} className="flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
        <div className="flex gap-3 text-sm"><span className="rounded-xl bg-slate-900 px-4 py-2">題目 {index + 1}/{QUESTIONS.length}</span><span className="rounded-xl bg-emerald-500/10 px-4 py-2 text-emerald-300">平均 {session.answered ? Math.round(session.score / session.answered) : 0} 分</span></div>
      </header>

      <section className="rounded-3xl border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(15,23,42,0.75))] p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400"><Brain className="h-4 w-4" />Range Reading Drill</div>
        <h1 className="mt-3 text-3xl font-bold">{question.title}</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400"><span>{question.table}</span><span>·</span><span>{question.stack}</span><span>·</span><span>{question.villain}</span></div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">{question.action.map((line, lineIndex) => <div key={line} className="rounded-xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm"><span className="mr-2 font-mono text-emerald-400">{lineIndex + 1}</span>{line}</div>)}</div>
        {question.board && <div className="mt-5 font-mono text-xl font-bold tracking-wider text-white">Board：{question.board}</div>}
        <p className="mt-6 text-lg font-semibold">{question.prompt}</p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {question.options.map(option => {
          const active = selected.includes(option.hand);
          const correct = question.answer.includes(option.hand);
          const state = submitted ? (correct ? 'border-emerald-500/60 bg-emerald-500/10' : active ? 'border-red-500/60 bg-red-500/10' : 'border-slate-800 bg-slate-900/50') : active ? 'border-blue-500/60 bg-blue-500/10' : 'border-slate-800 bg-slate-900/50';
          return <button key={option.hand} type="button" onClick={() => toggle(option.hand)} className={`rounded-2xl border p-5 text-left transition ${state}`}>
            <div className="flex items-center justify-between"><span className="font-mono text-2xl font-bold">{option.hand}</span>{submitted && correct && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}</div>
            <div className="mt-2 text-xs text-slate-500">{BUCKET_LABELS[option.bucket]}</div>
          </button>;
        })}
      </section>

      {submitted && <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center gap-3"><Target className="h-6 w-6 text-emerald-400" /><div><div className="text-sm text-slate-400">本題得分</div><div className="font-mono text-3xl font-bold">{questionScore}/100</div></div></div>
        <p className="mt-4 text-sm leading-7 text-slate-300">{question.explanation}</p>
        <div className="mt-4 text-xs text-slate-500">正解範圍：{question.answer.join('、')}</div>
      </section>}

      <footer className="mt-6 flex flex-wrap justify-between gap-3">
        <button type="button" onClick={reset} className="flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-3 text-sm text-slate-400"><RotateCcw className="h-4 w-4" />重置紀錄</button>
        {!submitted ? <button type="button" disabled={!selected.length} onClick={() => setSubmitted(true)} className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40">提交範圍</button> : <button type="button" onClick={next} className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-emerald-950">下一題</button>}
      </footer>
    </div>
  </div>;
}
