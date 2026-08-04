import { useMemo, useState } from 'react';
import {
  ArrowLeft, BarChart3, Brain, CheckCircle2, HelpCircle, RotateCcw, Target, XCircle,
} from 'lucide-react';

type RangeBucket = 'monster' | 'strong' | 'medium' | 'draw' | 'air';
type HeroAction = 'fold' | 'call' | 'raise' | 'shove';
type EquityBand = 'under-30' | '30-39' | '40-49' | '50-59' | '60-plus';
type Phase = 'range' | 'decision' | 'result';

interface RangeOption {
  hand: string;
  bucket: RangeBucket;
}

interface RangeOutcome {
  label: string;
  equity: number;
  bestAction: HeroAction;
  description: string;
}

interface RangeQuestion {
  id: string;
  title: string;
  table: string;
  stack: string;
  villain: string;
  heroHand: string;
  heroPosition: string;
  action: string[];
  board?: string;
  potAfterBet: number;
  callCost: number;
  prompt: string;
  options: RangeOption[];
  answer: string[];
  equityEstimate: number;
  bestAction: HeroAction;
  acceptableActions?: HeroAction[];
  explanation: string;
  blockerNote?: string;
  tight: RangeOutcome;
  wide: RangeOutcome;
}

const BUCKET_LABELS: Record<RangeBucket, string> = {
  monster: '超強牌', strong: '強牌', medium: '中等牌', draw: '聽牌', air: '空氣／詐唬',
};

const ACTION_LABELS: Record<HeroAction, string> = {
  fold: 'Fold', call: 'Call', raise: 'Raise', shove: 'All-In',
};

const EQUITY_BANDS: Array<{ id: EquityBand; label: string; min: number; max: number }> = [
  { id: 'under-30', label: '< 30%', min: 0, max: 29.999 },
  { id: '30-39', label: '30–39%', min: 30, max: 39.999 },
  { id: '40-49', label: '40–49%', min: 40, max: 49.999 },
  { id: '50-59', label: '50–59%', min: 50, max: 59.999 },
  { id: '60-plus', label: '≥ 60%', min: 60, max: 100 },
];

const QUESTIONS: RangeQuestion[] = [
  {
    id: 'co-shove-aqs', title: '18BB CO 直接推進', table: '錦標賽 9 人桌', stack: '有效 18BB', villain: 'CO 一般玩家',
    heroHand: 'A♠ Q♠', heroPosition: 'BTN',
    action: ['前位全部 Fold', 'CO 直接 All-In 18BB', '輪到 BTN 決定'],
    potAfterBet: 20.5, callCost: 18,
    prompt: '先建立 CO 的直接推進範圍，再判斷 AQs 如何對抗整個範圍。',
    options: [
      { hand: 'AA', bucket: 'monster' }, { hand: 'KK', bucket: 'monster' }, { hand: 'QQ', bucket: 'strong' },
      { hand: '77', bucket: 'strong' }, { hand: '44', bucket: 'medium' }, { hand: '22', bucket: 'medium' },
      { hand: 'AJs', bucket: 'strong' }, { hand: 'ATo', bucket: 'medium' }, { hand: 'KQs', bucket: 'strong' },
      { hand: 'K8o', bucket: 'air' }, { hand: '76s', bucket: 'draw' },
    ],
    answer: ['QQ', '77', '44', '22', 'AJs', 'ATo', 'KQs'],
    equityEstimate: 55, bestAction: 'call',
    explanation: '18BB 直接推常集中在不想 Raise/Fold 的中小口袋對、強 Ax 與高張同花牌。AQs 對這個基準範圍通常高於所需勝率，因此應 Call。AA、KK 很多玩家會保留小加注誘導。',
    blockerNote: 'Hero 持有 A 與 Q，會削減 AQ、AA、QQ 等強牌組合，讓對手範圍中的中口袋對與較弱 Ax 比重相對提高。',
    tight: { label: '偏緊', equity: 46, bestAction: 'fold', description: '若只推 77+、AJs+、AQo+，AQs 接近或低於門檻。' },
    wide: { label: '偏寬', equity: 61, bestAction: 'call', description: '若加入 22+、A8s+、A9o+、KTs+，AQs 明顯領先。' },
  },
  {
    id: 'fourbet-shove-qq', title: 'UTG 40BB 4-Bet Shove', table: '6 人桌現金局', stack: '有效 40BB', villain: 'UTG 一般 TAG',
    heroHand: 'Q♣ Q♦', heroPosition: 'BTN',
    action: ['UTG 開到 2.5BB', 'BTN 3-Bet 到 8.5BB', 'UTG All-In 40BB'],
    potAfterBet: 50, callCost: 31.5,
    prompt: '哪些牌會形成 UTG 的 4-Bet Shove 範圍？QQ 對整體範圍該怎麼做？',
    options: [
      { hand: 'AA', bucket: 'monster' }, { hand: 'KK', bucket: 'monster' }, { hand: 'QQ', bucket: 'strong' },
      { hand: 'JJ', bucket: 'strong' }, { hand: 'TT', bucket: 'medium' }, { hand: 'AKs', bucket: 'strong' },
      { hand: 'AKo', bucket: 'strong' }, { hand: 'AQs', bucket: 'medium' }, { hand: 'A5s', bucket: 'air' },
      { hand: '99', bucket: 'medium' },
    ],
    answer: ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'],
    equityEstimate: 47, bestAction: 'call',
    explanation: 'QQ 對 JJ+、AK 的基準 40BB 推進範圍仍通常高於跟注門檻。真正關鍵不是「他可能有 AA」，而是 AA、KK、QQ、JJ、AK 各自有多少組合。',
    blockerNote: 'Hero 的兩張 Q 讓對手 QQ 從 6 組降到 1 組，但不阻擋 AA、KK、AK；因此 QQ 並沒有看起來那麼輕鬆。',
    tight: { label: '偏緊', equity: 34, bestAction: 'fold', description: '若對手只用 KK+、AKs 推進，QQ 不足以支付跟注。' },
    wide: { label: '偏寬', equity: 54, bestAction: 'call', description: '若加入 TT、AQs 與部分 A5s，QQ 成為清楚的 Call。' },
  },
  {
    id: 'flop-cbet-second-pair', title: 'K-9-4 面對 33% C-Bet', table: '6 人桌現金局', stack: '有效 80BB', villain: 'BTN 偏積極',
    heroHand: 'A♦ 9♣', heroPosition: 'BB', board: 'K♠ 9♦ 4♠',
    action: ['BTN 開到 2.3BB', 'BB Call', 'BB Check，BTN 打 33% Pot'],
    potAfterBet: 6.8, callCost: 1.7,
    prompt: 'BTN 的小尺寸下注有多寬？Hero 的第二對如何對抗這個範圍？',
    options: [
      { hand: 'KK', bucket: 'monster' }, { hand: '99', bucket: 'monster' }, { hand: 'AK', bucket: 'strong' },
      { hand: 'KQ', bucket: 'strong' }, { hand: 'QQ', bucket: 'medium' }, { hand: 'TT', bucket: 'medium' },
      { hand: 'A♠Q♠', bucket: 'draw' }, { hand: 'QJ', bucket: 'draw' }, { hand: 'A5', bucket: 'air' },
      { hand: '76o', bucket: 'air' },
    ],
    answer: ['KK', '99', 'AK', 'KQ', 'QQ', 'TT', 'A♠Q♠', 'QJ', 'A5'],
    equityEstimate: 48, bestAction: 'call',
    explanation: '33% C-Bet 通常保留高頻率、寬範圍。A9 不需要擊敗每一手價值牌，只需要對整個下注範圍有足夠 Equity。由於所需勝率低，Call 明顯優於把第二對轉成 Raise。',
    blockerNote: 'A9 阻擋部分 A9、99 與 A 高空氣；同時沒有黑桃，對手仍可保有完整的黑桃聽牌組合。',
    tight: { label: '價值偏重', equity: 18, bestAction: 'fold', description: '若此玩家只用 Kx、Set 與強同花聽牌下注，第二對可直接 Fold。' },
    wide: { label: '高頻寬打', equity: 58, bestAction: 'call', description: '若所有口袋對、A 高後門與卡順都下注，A9 是穩定 Call。' },
  },
  {
    id: 'turn-checkraise-aq', title: 'Turn 面對被動玩家 Check-Raise', table: '9 人桌現金局', stack: '有效 100BB', villain: '偏被動常客',
    heroHand: 'A♠ Q♦', heroPosition: 'CO', board: 'A♦ 7♣ 2♣ J♠',
    action: ['CO 開池，BB Call', 'Flop：BB Check-Call 40%', 'Turn：Hero Bet 8BB，BB Raise 到 28BB'],
    potAfterBet: 52, callCost: 20,
    prompt: '先辨識極化範圍，再決定頂對好踢腳是否能繼續。',
    options: [
      { hand: 'AJ', bucket: 'monster' }, { hand: '77', bucket: 'monster' }, { hand: '22', bucket: 'monster' },
      { hand: 'A7s', bucket: 'monster' }, { hand: 'AT', bucket: 'strong' }, { hand: '88', bucket: 'medium' },
      { hand: 'K♣Q♣', bucket: 'draw' }, { hand: 'Q♣T♣', bucket: 'draw' }, { hand: '6♣5♣', bucket: 'draw' },
      { hand: '65s 無梅花', bucket: 'air' },
    ],
    answer: ['AJ', '77', '22', 'A7s', 'K♣Q♣', 'Q♣T♣', '6♣5♣'],
    equityEstimate: 22, bestAction: 'fold',
    explanation: '被動玩家的 Turn Check-Raise 常嚴重低詐唬。即使理論上的極化範圍包含梅花聽牌，實戰權重通常更偏兩對與 Set；AQ 對加權後範圍低於跟注門檻，應 Exploit Fold。',
    blockerNote: 'Hero 的 Q♦ 會阻擋部分 Q♣X♣ 聽牌嗎？不會。花色必須精確考慮；沒有持有梅花時，對手可用的梅花半詐唬組合更多。',
    tight: { label: '極少詐唬', equity: 14, bestAction: 'fold', description: '幾乎只有 AJ、A7、77、22 時，AQ 是明確 Fold。' },
    wide: { label: '聽牌充足', equity: 41, bestAction: 'call', description: '若所有高梅花與複合聽牌都 Check-Raise，AQ 可 Call。' },
  },
  {
    id: 'river-overbet-kj', title: 'River 面對 150% Pot All-In', table: '6 人桌現金局', stack: '有效 120BB', villain: '有能力詐唬的 LAG',
    heroHand: 'K♠ J♦', heroPosition: 'BB', board: 'Q♥ 8♥ 3♣ 2♠ K♣',
    action: ['BTN 開池，BB Call', 'Flop 與 Turn：BTN 連打，BB 連續 Call', 'River：BTN 打 150% Pot All-In'],
    potAfterBet: 100, callCost: 60,
    prompt: '建立價值＋詐唬的極化範圍，判斷頂對是否達到 Bluff-Catch 門檻。',
    options: [
      { hand: 'KK', bucket: 'monster' }, { hand: 'KQ', bucket: 'monster' }, { hand: 'QQ', bucket: 'monster' },
      { hand: '88', bucket: 'monster' }, { hand: 'AQ', bucket: 'strong' }, { hand: 'QJ', bucket: 'medium' },
      { hand: 'A♥J♥', bucket: 'air' }, { hand: 'J♥T♥', bucket: 'air' }, { hand: 'T♥9♥', bucket: 'air' },
      { hand: '99', bucket: 'medium' },
    ],
    answer: ['KK', 'KQ', 'QQ', '88', 'A♥J♥', 'J♥T♥', 'T♥9♥'],
    equityEstimate: 39, bestAction: 'call',
    explanation: '面對 150% Pot，Hero 需要約 37.5% 勝率。對手若真的能把錯過紅心聽牌推成詐唬，KJ 是接近門檻的 Bluff Catch；但這是一個高度依賴玩家傾向的決策。',
    blockerNote: 'KJ 阻擋部分 KQ、KK，也可能阻擋 J♥T♥ 類詐唬，阻擋價值與阻擋詐唬會產生相反效果，不能只看到「有 Blocker」就 Call。',
    tight: { label: 'Underbluff', equity: 22, bestAction: 'fold', description: '若錯過聽牌不會三槍，所有一對 Bluff Catcher 都應大幅棄牌。' },
    wide: { label: 'Overbluff', equity: 50, bestAction: 'call', description: '若所有錯過紅心都推進，KJ 是高獲利 Call。' },
  },
  {
    id: 'multiway-donk-aa', title: '多人池面對 75% Donk Bet', table: '9 人桌現金局', stack: '有效 70BB', villain: 'BB 鬆弱玩家',
    heroHand: 'A♠ A♦', heroPosition: 'UTG', board: '8♣ 7♣ 4♦',
    action: ['UTG 開池，CO Call，BB Call', 'Flop：BB 領打 75% Pot', 'CO 尚未行動'],
    potAfterBet: 17.5, callCost: 7.5,
    prompt: '多人池大尺寸領打通常多強？AA 應 Fold、Call 還是 Raise？',
    options: [
      { hand: '88', bucket: 'monster' }, { hand: '77', bucket: 'monster' }, { hand: '44', bucket: 'monster' },
      { hand: '65s', bucket: 'monster' }, { hand: '87s', bucket: 'monster' }, { hand: 'A8', bucket: 'strong' },
      { hand: '9♣6♣', bucket: 'draw' }, { hand: 'A♣5♣', bucket: 'draw' }, { hand: 'T♣9♣', bucket: 'draw' },
      { hand: '55', bucket: 'medium' }, { hand: 'KQ', bucket: 'air' },
    ],
    answer: ['88', '77', '44', '65s', '87s', '9♣6♣', 'A♣5♣', 'T♣9♣'],
    equityEstimate: 43, bestAction: 'call',
    explanation: '多人池大尺寸 Donk 比單挑更偏強，但仍可能包含高 Equity 複合聽牌。AA 對基準範圍通常足以 Call；Raise 會讓較差聽牌棄牌，卻被兩對以上繼續，容易把自己隔離到更強範圍。',
    blockerNote: 'AA 沒有梅花，對手保有完整同花與複合聽牌；這提高 Call 的價值，也降低立即 Raise 的必要性。',
    tight: { label: '只領打成牌', equity: 26, bestAction: 'fold', description: '若對手只用兩對、Set、順子領打，AA 可以 Exploit Fold。' },
    wide: { label: '聽牌也領打', equity: 58, bestAction: 'call', description: '若加入所有強梅花與順子聽牌，AA 是清楚 Call。' },
  },
];

function scoreSelection(selected: string[], answer: string[]): number {
  const selectedSet = new Set(selected);
  const answerSet = new Set(answer);
  const truePositive = selected.filter(item => answerSet.has(item)).length;
  const falsePositive = selected.filter(item => !answerSet.has(item)).length;
  const missed = answer.filter(item => !selectedSet.has(item)).length;
  const raw = (truePositive * 10 - falsePositive * 5 - missed * 3) / Math.max(1, answer.length) * 10;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function equityBandFor(equity: number): EquityBand {
  return EQUITY_BANDS.find(band => equity >= band.min && equity <= band.max)?.id || '60-plus';
}

function equityPoints(selected: EquityBand | null, answer: EquityBand): number {
  if (!selected) return 0;
  const selectedIndex = EQUITY_BANDS.findIndex(band => band.id === selected);
  const answerIndex = EQUITY_BANDS.findIndex(band => band.id === answer);
  if (selectedIndex === answerIndex) return 20;
  return Math.abs(selectedIndex - answerIndex) === 1 ? 10 : 0;
}

function actionPoints(selected: HeroAction | null, question: RangeQuestion): number {
  if (!selected) return 0;
  if (selected === question.bestAction) return 30;
  return question.acceptableActions?.includes(selected) ? 18 : 0;
}

function percentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getRangeBias(selected: string[], answer: string[]): string {
  const extras = selected.filter(hand => !answer.includes(hand)).length;
  const missed = answer.filter(hand => !selected.includes(hand)).length;
  if (extras >= missed + 2) return '偏寬';
  if (missed >= extras + 2) return '偏窄';
  return '接近基準';
}

export function RangeReadingTrainer({ onExit }: { onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [selectedRange, setSelectedRange] = useState<string[]>([]);
  const [selectedEquity, setSelectedEquity] = useState<EquityBand | null>(null);
  const [selectedAction, setSelectedAction] = useState<HeroAction | null>(null);
  const [phase, setPhase] = useState<Phase>('range');
  const [session, setSession] = useState({ score: 0, answered: 0 });
  const question = QUESTIONS[index];

  const potOdds = useMemo(
    () => question.callCost / (question.potAfterBet + question.callCost) * 100,
    [question],
  );
  const correctEquityBand = equityBandFor(question.equityEstimate);
  const rangeScore = useMemo(
    () => scoreSelection(selectedRange, question.answer),
    [selectedRange, question.answer],
  );
  const totalScore = Math.round(
    rangeScore * 0.5 + equityPoints(selectedEquity, correctEquityBand) + actionPoints(selectedAction, question),
  );

  const toggleRange = (hand: string) => {
    if (phase !== 'range') return;
    setSelectedRange(previous => previous.includes(hand)
      ? previous.filter(item => item !== hand)
      : [...previous, hand]);
  };

  const next = () => {
    setSession(previous => ({ score: previous.score + totalScore, answered: previous.answered + 1 }));
    setIndex(previous => (previous + 1) % QUESTIONS.length);
    setSelectedRange([]);
    setSelectedEquity(null);
    setSelectedAction(null);
    setPhase('range');
  };

  const reset = () => {
    setIndex(0);
    setSelectedRange([]);
    setSelectedEquity(null);
    setSelectedAction(null);
    setPhase('range');
    setSession({ score: 0, answered: 0 });
  };

  const average = session.answered ? Math.round(session.score / session.answered) : 0;
  const correctSelected = selectedRange.filter(hand => question.answer.includes(hand));
  const missed = question.answer.filter(hand => !selectedRange.includes(hand));
  const extras = selectedRange.filter(hand => !question.answer.includes(hand));

  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <button type="button" onClick={onExit} className="flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
        <div className="flex flex-wrap gap-3 text-sm"><span className="rounded-xl bg-slate-900 px-4 py-2">題目 {index + 1}/{QUESTIONS.length}</span><span className="rounded-xl bg-emerald-500/10 px-4 py-2 text-emerald-300">平均 {average} 分</span><span className="rounded-xl bg-blue-500/10 px-4 py-2 text-blue-300">{phase === 'range' ? '① 建立範圍' : phase === 'decision' ? '② 對抗決策' : '③ 結果解析'}</span></div>
      </header>

      <section className="rounded-3xl border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(15,23,42,0.75))] p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400"><Brain className="h-4 w-4" />Range Versus Hand Drill</div>
        <h1 className="mt-3 text-3xl font-bold">{question.title}</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400"><span>{question.table}</span><span>·</span><span>{question.stack}</span><span>·</span><span>{question.villain}</span></div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">{question.action.map((line, lineIndex) => <div key={line} className="rounded-xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm"><span className="mr-2 font-mono text-emerald-400">{lineIndex + 1}</span>{line}</div>)}</div>
        <div className="mt-5 flex flex-wrap items-center gap-3"><div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3"><span className="text-xs text-blue-300">Hero · {question.heroPosition}</span><div className="mt-1 font-mono text-2xl font-bold">{question.heroHand}</div></div>{question.board && <div className="rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3"><span className="text-xs text-slate-500">Board</span><div className="mt-1 font-mono text-xl font-bold tracking-wider">{question.board}</div></div>}</div>
        <p className="mt-6 text-lg font-semibold">{question.prompt}</p>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold">① 選出 Villain 可能持有的牌</h2><p className="mt-1 text-xs text-slate-500">不要猜單一手牌；選出能走到目前節點的整體範圍。</p></div><span className="text-xs text-slate-500">已選 {selectedRange.length}</span></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {question.options.map(option => {
            const active = selectedRange.includes(option.hand);
            const correct = question.answer.includes(option.hand);
            let state = active ? 'border-blue-500/60 bg-blue-500/10' : 'border-slate-800 bg-slate-900/50';
            if (phase === 'result') {
              if (correct && active) state = 'border-emerald-500/60 bg-emerald-500/10';
              else if (correct) state = 'border-amber-500/60 bg-amber-500/10';
              else if (active) state = 'border-red-500/60 bg-red-500/10';
              else state = 'border-slate-800 bg-slate-900/50 opacity-60';
            }
            return <button key={option.hand} type="button" onClick={() => toggleRange(option.hand)} disabled={phase !== 'range'} className={`rounded-2xl border p-4 text-left transition ${state}`}>
              <div className="flex items-center justify-between"><span className="font-mono text-xl font-bold">{option.hand}</span>{phase === 'result' && correct && active && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}{phase === 'result' && !correct && active && <XCircle className="h-5 w-5 text-red-400" />}</div>
              <div className="mt-2 text-xs text-slate-500">{BUCKET_LABELS[option.bucket]}</div>
            </button>;
          })}
        </div>
      </section>

      {phase !== 'range' && <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6">
        <div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-400" /><h2 className="font-semibold">② 用 Hero 手牌對抗你建立的範圍</h2></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-950/50 p-4"><div className="text-xs text-slate-500">目前底池（含對手下注）</div><div className="mt-2 font-mono text-2xl font-bold">{question.potAfterBet}BB</div></div><div className="rounded-xl bg-slate-950/50 p-4"><div className="text-xs text-slate-500">Hero 跟注成本</div><div className="mt-2 font-mono text-2xl font-bold">{question.callCost}BB</div></div><div className="rounded-xl bg-slate-950/50 p-4"><div className="text-xs text-slate-500">你需要自己算</div><div className="mt-2 text-sm font-semibold text-amber-300">最低勝率與最佳動作</div></div></div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2"><div><div className="mb-3 text-sm font-semibold">Hero 對基準範圍的 Equity 約在哪一區？</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-2 xl:grid-cols-5">{EQUITY_BANDS.map(band => <button key={band.id} type="button" disabled={phase === 'result'} onClick={() => setSelectedEquity(band.id)} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${selectedEquity === band.id ? 'border-blue-500 bg-blue-500/15 text-blue-200' : 'border-slate-800 bg-slate-950/40 text-slate-400'}`}>{band.label}</button>)}</div></div><div><div className="mb-3 text-sm font-semibold">最佳動作</div><div className="grid grid-cols-2 gap-2">{(['fold', 'call', 'raise', 'shove'] as HeroAction[]).map(action => <button key={action} type="button" disabled={phase === 'result'} onClick={() => setSelectedAction(action)} className={`rounded-xl border px-4 py-3 text-sm font-bold ${selectedAction === action ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200' : 'border-slate-800 bg-slate-950/40 text-slate-400'}`}>{ACTION_LABELS[action]}</button>)}</div></div></div>
      </section>}

      {phase === 'result' && <section className="mt-6 space-y-5">
        <div className="grid gap-4 md:grid-cols-4"><ResultMetric label="總分" value={`${totalScore}/100`} detail="Range 50＋Equity 20＋Action 30" /><ResultMetric label="範圍品質" value={`${rangeScore}%`} detail={`你的範圍：${getRangeBias(selectedRange, question.answer)}`} /><ResultMetric label="Pot Odds" value={percentage(potOdds)} detail={`${question.callCost} ÷ (${question.potAfterBet}＋${question.callCost})`} /><ResultMetric label="基準 Equity" value={`約 ${question.equityEstimate}%`} detail={`優勢 ${question.equityEstimate >= potOdds ? '+' : ''}${(question.equityEstimate - potOdds).toFixed(1)}%`} /></div>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"><div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"><div className="flex items-center gap-3"><Target className="h-6 w-6 text-emerald-400" /><div><div className="text-sm text-slate-400">建議動作</div><div className="mt-1 text-2xl font-bold">{ACTION_LABELS[question.bestAction]}</div></div></div><p className="mt-4 text-sm leading-7 text-slate-300">{question.explanation}</p>{question.blockerNote && <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/8 p-4 text-sm leading-6 text-blue-100"><span className="font-semibold">Blocker 檢查：</span>{question.blockerNote}</div>}</div><div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"><div className="flex items-center gap-2"><HelpCircle className="h-5 w-5 text-amber-400" /><h3 className="font-semibold">你的範圍誤差</h3></div><RangeFeedback label="選對" items={correctSelected} empty="沒有選中基準組合" tone="text-emerald-300" /><RangeFeedback label="漏選" items={missed} empty="沒有漏選" tone="text-amber-300" /><RangeFeedback label="多選" items={extras} empty="沒有多選" tone="text-red-300" /></div></div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"><h3 className="font-semibold">答案會在哪裡反轉？</h3><p className="mt-1 text-xs text-slate-500">同一手 Hero 手牌，對手範圍權重不同，最佳動作可能完全相反。</p><div className="mt-5 grid gap-3 md:grid-cols-3"><OutcomeCard outcome={question.tight} /><OutcomeCard outcome={{ label: '基準範圍', equity: question.equityEstimate, bestAction: question.bestAction, description: `所需勝率 ${percentage(potOdds)}；題庫採用此範圍作為評分基準。` }} featured /><OutcomeCard outcome={question.wide} /></div></div>
        <p className="text-center text-xs text-slate-600">Equity 為題庫教學估算，用於訓練範圍思考與決策門檻，不代表特定 Solver 精確頻率。</p>
      </section>}

      <footer className="mt-6 flex flex-wrap justify-between gap-3">
        <button type="button" onClick={reset} className="flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-3 text-sm text-slate-400"><RotateCcw className="h-4 w-4" />重置紀錄</button>
        {phase === 'range' && <button type="button" disabled={!selectedRange.length} onClick={() => setPhase('decision')} className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40">鎖定範圍，進入決策</button>}
        {phase === 'decision' && <button type="button" disabled={!selectedEquity || !selectedAction} onClick={() => setPhase('result')} className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40">提交對抗決策</button>}
        {phase === 'result' && <button type="button" onClick={next} className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-emerald-950">下一題</button>}
      </footer>
    </div>
  </div>;
}

function ResultMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-2xl font-bold">{value}</div><div className="mt-2 text-xs text-slate-500">{detail}</div></div>;
}

function RangeFeedback({ label, items, empty, tone }: { label: string; items: string[]; empty: string; tone: string }) {
  return <div className="mt-4"><div className={`text-xs font-semibold ${tone}`}>{label}</div><div className="mt-1 text-sm text-slate-400">{items.length ? items.join('、') : empty}</div></div>;
}

function OutcomeCard({ outcome, featured = false }: { outcome: RangeOutcome; featured?: boolean }) {
  return <div className={`rounded-xl border p-4 ${featured ? 'border-emerald-500/30 bg-emerald-500/8' : 'border-slate-800 bg-slate-950/40'}`}><div className="flex items-center justify-between"><span className="text-sm font-semibold">{outcome.label}</span><span className="rounded-lg bg-slate-900 px-2 py-1 font-mono text-xs">{outcome.equity}%</span></div><div className="mt-3 text-xl font-bold text-white">{ACTION_LABELS[outcome.bestAction]}</div><p className="mt-2 text-xs leading-5 text-slate-500">{outcome.description}</p></div>;
}
