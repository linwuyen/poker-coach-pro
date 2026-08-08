import { useMemo, useState } from 'react';
import { ArrowLeft, Calculator, Dices, ShieldCheck, Sparkles } from 'lucide-react';
import { calculateEquity, parseCardsText, WeightedRangeHand } from '../../poker/equityEngine';

function parseRange(text: string): WeightedRangeHand[] {
  return text.split(/\n|,/).map(line => line.trim()).filter(Boolean).map(line => {
    const [hand, weightText] = line.split(/\s+/);
    const weight = weightText === undefined ? 1 : Number(weightText);
    if (!hand || !Number.isFinite(weight)) throw new Error(`無法解析範圍：${line}`);
    return { hand, weight };
  });
}

export function EquityWorkbench({ onExit }: { onExit: () => void }) {
  const [hero, setHero] = useState('As Ks');
  const [board, setBoard] = useState('Qs Js 2c');
  const [rangeText, setRangeText] = useState('QQ 1\nJJ 1\nAKo 0.5\nAQs 0.5');
  const [iterations, setIterations] = useState('25000');
  const [nonce, setNonce] = useState(0);
  const [error, setError] = useState('');

  const result = useMemo(() => {
    try {
      setError('');
      return calculateEquity({
        hero: parseCardsText(hero),
        board: board.trim() ? parseCardsText(board) : [],
        villainRange: parseRange(rangeText),
        iterations: Math.max(1000, Number(iterations) || 25000),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '計算失敗');
      return null;
    }
  // nonce is an explicit recalc trigger for textarea/input workflows.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  const recalc = () => setNonce(value => value + 1);
  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-5xl">
      <button type="button" onClick={onExit} className="pc-interactive flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
      <section className="pc-hero-glow mt-6 overflow-hidden rounded-3xl border border-blue-500/20 bg-[linear-gradient(135deg,rgba(59,130,246,0.14),rgba(15,23,42,0.78))] p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300"><Calculator className="h-4 w-4" />Exact Equity Engine</div>
        <h1 className="mt-3 text-3xl font-bold">不要再把 Hero Equity 寫死在題庫裡</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">River / Turn / 小型 Flop 狀態空間直接完整枚舉；Preflop 或大型狀態空間自動切換成固定 seed Monte Carlo。範圍權重以每個 combo 的出現頻率計算。</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-blue-200"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />Truth: Exact Math / Monte Carlo</span><span className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-slate-400">支援 QQ / AKs / AKo / AsKh</span></div>
      </section>

      <section className="mt-6 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:grid-cols-2 md:p-6">
        <Field label="Hero（兩張）" value={hero} onChange={setHero} placeholder="As Ks" />
        <Field label="Board（0–5 張）" value={board} onChange={setBoard} placeholder="Qs Js 2c" />
        <label className="md:col-span-2 text-xs text-slate-500">Villain range：每行 `hand weight`，weight 0–1
          <textarea value={rangeText} onChange={event => setRangeText(event.target.value)} rows={6} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-3 font-mono text-sm text-slate-100 outline-none focus:border-blue-500" />
        </label>
        <Field label="Monte Carlo iterations" value={iterations} onChange={setIterations} placeholder="25000" />
        <button type="button" onClick={recalc} className="pc-interactive pc-shimmer flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white"><Dices className="h-4 w-4" />重新計算</button>
      </section>

      {error && <div className="mt-5 rounded-xl border border-red-500/25 bg-red-500/7 p-4 text-sm text-red-200">{error}</div>}
      {result && <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Hero Equity" value={`${result.equity.toFixed(2)}%`} accent />
        <Metric label="Win / Tie" value={`${result.winRate.toFixed(1)} / ${result.tieRate.toFixed(1)}%`} />
        <Metric label="計算模式" value={result.method === 'exact' ? 'Exact' : 'Monte Carlo'} />
        <Metric label="Villain combos" value={String(result.villainCombos)} />
        <div className="sm:col-span-2 lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 text-sm leading-7 text-slate-300"><Sparkles className="mr-2 inline h-4 w-4 text-blue-300" />{result.method === 'exact' ? `完整枚舉 ${result.samples.toLocaleString()} 個 live states。` : `估計狀態空間約 ${result.estimatedStates.toLocaleString()}，使用 ${result.samples.toLocaleString()} 次固定 seed Monte Carlo；同一輸入可重現。`}</div>
      </section>}
    </div>
  </div>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="text-xs text-slate-500">{label}<input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 font-mono text-sm text-slate-100 outline-none focus:border-blue-500" /></label>;
}
function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className={`pc-card-lift rounded-2xl border p-5 ${accent ? 'border-blue-500/25 bg-blue-500/8' : 'border-slate-800 bg-slate-900/55'}`}><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-2xl font-bold">{value}</div></div>;
}
