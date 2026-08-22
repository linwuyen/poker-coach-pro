import { useMemo, useState } from 'react';
import { ArrowLeft, Crosshair, Sigma } from 'lucide-react';
import { AnalysisContextBanner } from '../analysis/AnalysisContextBanner';
import { readAnalysisContextFromHash } from '../analysis/analysisContext';

interface BoundaryPoint {
  sizePot: number;
  threshold: number;
  bestAction: 'Call' | 'Fold';
}

function callThreshold(sizePot: number): number {
  const bet = sizePot / 100;
  return bet / (1 + 2 * bet) * 100;
}

function betSizeFromThreshold(thresholdPercent: number): number | undefined {
  const t = thresholdPercent / 100;
  if (t <= 0 || t >= 0.5) return undefined;
  return t / (1 - 2 * t) * 100;
}

export function DecisionBoundaryMap({ onExit }: { onExit: () => void }) {
  const context = readAnalysisContextFromHash();
  const callThresholdPercent = context?.minimumCallingEquityPercent;
  const [equity, setEquity] = useState(context?.heroEquityPercent ?? 30);
  const [bluffShare, setBluffShare] = useState(callThresholdPercent ?? 30);
  const points = useMemo<BoundaryPoint[]>(() => Array.from({ length: 20 }, (_, index) => {
    const sizePot = 10 + index * 10;
    const threshold = callThreshold(sizePot);
    return { sizePot, threshold, bestAction: equity >= threshold ? 'Call' : 'Fold' };
  }), [equity]);
  const equityBoundary = points.find(point => equity < point.threshold)?.sizePot ?? 200;
  const bluffBoundary = points.find(point => bluffShare < point.threshold)?.sizePot ?? 200;
  const contextBetSize = callThresholdPercent === undefined ? undefined : betSizeFromThreshold(callThresholdPercent);
  const hasRawNonCallPercentage = context?.potOddsPercent !== undefined && callThresholdPercent === undefined;

  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8"><div className="mx-auto max-w-6xl">
    <button type="button" onClick={onExit} className="pc-interactive flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
    <div className="mt-4"><AnalysisContextBanner context={context} compact /></div>
    <section className="pc-hero-glow mt-6 rounded-3xl border border-violet-500/20 bg-[linear-gradient(135deg,rgba(139,92,246,0.14),rgba(15,23,42,0.78))] p-6 md:p-8"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300"><Crosshair className="h-4 w-4" />Decision Boundary Map</div><h1 className="mt-3 text-3xl font-bold">記住答案不夠，要知道答案在哪裡翻轉</h1><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">River 面對下注時，Call 的最低 equity / bluff-share 門檻由 pot odds 精確決定。只有當上一題真的存在 Call price 時才會自動帶入；Check / Bet 題不會被硬轉成 facing-bet 幾何。</p></section>

    {callThresholdPercent !== undefined && <section data-testid="context-boundary" className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/6 p-4 text-sm text-cyan-100">當前題目的 facing-call threshold 是 <b>{callThresholdPercent}%</b>{contextBetSize === undefined ? '' : `，等價於約 ${contextBetSize.toFixed(0)}% pot 的下注幾何`}。這是 exact math；若來源沒有 Hero equity，就不會自行補一個。</section>}
    {hasRawNonCallPercentage && <section data-testid="context-boundary-not-applicable" className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/6 p-4 text-sm text-amber-100">上一題雖顯示 <b>{context!.potOddsPercent}%</b> 的題目百分比，但決策沒有 Call option，因此不把它解讀成最低跟注 equity，也不反推出 facing-bet size。</section>}

    <section className="mt-6 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:grid-cols-2">
      <Slider label="Hero Equity" value={equity} onChange={setEquity} />
      <Slider label="Villain Bluff Share" value={bluffShare} onChange={setBluffShare} />
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-4"><Metric label="Equity boundary" value={`≈ ${equityBoundary}% pot`} detail="超過此下注尺寸後，目前 equity 會跨向 Fold" /><Metric label="Bluff boundary" value={`≈ ${bluffBoundary}% pot`} detail="極化 river 模型下的 bluff-catch 邊界" /><Metric label="Current call threshold" value={callThresholdPercent === undefined ? 'Unavailable' : `${callThresholdPercent}%`} detail="只接受已確認 facing-call 的上一題 context" /><Metric label="Truth" value="exact-math" detail="B / (P + 2B)" /></section>

    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6"><div className="flex items-center gap-2 font-semibold"><Sigma className="h-4 w-4 text-violet-300" />下注尺寸 → 最低跟注門檻</div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{points.map(point => <div key={point.sizePot} className={`rounded-xl border p-3 ${point.bestAction === 'Call' ? 'border-emerald-500/20 bg-emerald-500/6' : 'border-slate-800 bg-slate-950/35'}`}><div className="flex justify-between text-xs text-slate-500"><span>{point.sizePot}% pot</span><span>{point.bestAction}</span></div><div className="mt-2 font-mono text-lg font-bold">{point.threshold.toFixed(1)}%</div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-400" style={{ width: `${Math.min(100, point.threshold * 2)}%` }} /></div></div>)}</div></section>
  </div></div>;
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="text-sm text-slate-300"><div className="flex justify-between"><span>{label}</span><span className="font-mono text-violet-200">{value}%</span></div><input className="mt-3 w-full accent-violet-400" type="range" min="5" max="70" step="1" value={value} onChange={event => onChange(Number(event.target.value))} /></label>; }
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="pc-card-lift rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-2xl font-bold">{value}</div><div className="mt-2 text-xs leading-5 text-slate-500">{detail}</div></div>; }
