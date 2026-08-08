import { useMemo, useState } from 'react';
import { ArrowLeft, Scale } from 'lucide-react';
import { calculateHeadsUpIcmRisk } from '../../tournament/icm';

function parseNumbers(value: string): number[] {
  return value.split(/[,\s]+/).map(Number).filter(number => Number.isFinite(number) && number >= 0);
}

export function IcmWorkbench({ onExit }: { onExit: () => void }) {
  const [stacks, setStacks] = useState('25 40 18 12 7');
  const [payouts, setPayouts] = useState('40 25 18 10 7');
  const [heroIndex, setHeroIndex] = useState(0);
  const [villainIndex, setVillainIndex] = useState(1);
  const [risk, setRisk] = useState('18');
  const [showdown, setShowdown] = useState('55');

  const result = useMemo(() => {
    try {
      const stackValues = parseNumbers(stacks);
      const payoutValues = parseNumbers(payouts);
      if (stackValues.length < 2 || payoutValues.length < 1) return null;
      const players = stackValues.map((stack, index) => ({ id: `P${index + 1}`, stack }));
      if (!players[heroIndex] || !players[villainIndex] || heroIndex === villainIndex) return null;
      return calculateHeadsUpIcmRisk({
        players,
        payouts: payoutValues,
        heroId: players[heroIndex].id,
        villainId: players[villainIndex].id,
        amountAtRisk: Number(risk) || 0,
        showdownEquity: (Number(showdown) || 0) / 100,
      });
    } catch { return null; }
  }, [stacks, payouts, heroIndex, villainIndex, risk, showdown]);

  const playerCount = parseNumbers(stacks).length;
  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-5xl">
      <button type="button" onClick={onExit} className="flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
      <section className="mt-6 rounded-3xl border border-cyan-500/20 bg-[linear-gradient(135deg,rgba(6,182,212,0.12),rgba(15,23,42,0.75))] p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300"><Scale className="h-4 w-4" />ICM / $EV Workbench</div>
        <h1 className="mt-3 text-3xl font-bold">把「泡沫所以要緊」變成可計算的 Risk Premium</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">輸入桌上籌碼、獎金結構、Hero/Villain 與攤牌勝率。引擎用 Independent Chip Model 計算 Fold $EV、Call $EV 與 ICM break-even equity。這是結構模型，不等於完整 FGS 或 solver tree。</p>
      </section>

      <section className="mt-6 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:grid-cols-2">
        <Field label="籌碼（空白分隔）" value={stacks} onChange={setStacks} />
        <Field label="獎金（同一單位）" value={payouts} onChange={setPayouts} />
        <Select label="Hero" value={heroIndex} count={playerCount} onChange={setHeroIndex} />
        <Select label="Villain" value={villainIndex} count={playerCount} onChange={setVillainIndex} />
        <Field label="Hero 冒險籌碼" value={risk} onChange={setRisk} />
        <Field label="攤牌 Equity %" value={showdown} onChange={setShowdown} />
      </section>

      {result ? <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Fold $EV" value={result.foldEquity.toFixed(3)} />
        <Metric label="Call $EV" value={result.callEquity.toFixed(3)} emphasize={result.dollarEvDelta >= 0} />
        <Metric label="ICM Break-even" value={`${result.icmBreakEvenPercent.toFixed(1)}%`} />
        <Metric label="Risk Premium" value={`+${result.riskPremiumPercent.toFixed(1)}%`} />
        <div className="sm:col-span-2 lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 text-sm leading-7 text-slate-300">
          <b>判讀：</b> Chip-EV 的基準需要約 {result.chipEvBreakEvenPercent.toFixed(1)}% Equity；ICM 把門檻推到 {result.icmBreakEvenPercent.toFixed(1)}%。目前輸入的攤牌勝率讓 Call 相對 Fold 的 $EV 差為 <span className={result.dollarEvDelta >= 0 ? 'text-emerald-300' : 'text-red-300'}>{result.dollarEvDelta >= 0 ? '+' : ''}{result.dollarEvDelta.toFixed(3)}</span>。
        </div>
      </section> : <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-200">請確認玩家數、Hero/Villain 不同，以及輸入皆為有效數字。</div>}
    </div>
  </div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-xs text-slate-500">{label}<input value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/55 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500" /></label>; }
function Select({ label, value, count, onChange }: { label: string; value: number; count: number; onChange: (value: number) => void }) { return <label className="text-xs text-slate-500">{label}<select value={value} onChange={event => onChange(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/55 px-3 py-2.5 text-sm text-slate-100">{Array.from({ length: count }, (_, index) => <option key={index} value={index}>P{index + 1}</option>)}</select></label>; }
function Metric({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) { return <div className={`rounded-2xl border p-5 ${emphasize ? 'border-emerald-500/25 bg-emerald-500/7' : 'border-slate-800 bg-slate-900/55'}`}><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-2xl font-bold">{value}</div></div>; }
