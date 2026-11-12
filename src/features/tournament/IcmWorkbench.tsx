import { useMemo, useState } from 'react';
import { ArrowLeft, Coins, Medal, Scale, Ticket } from 'lucide-react';
import { calculateHeadsUpIcmRisk, calculateHeadsUpPkoRisk, satellitePayouts } from '../../tournament/icm';

type Mode = 'icm' | 'pko' | 'satellite';
function parseNumbers(value: string): number[] {
  return value.split(/[,\s]+/).map(Number).filter(number => Number.isFinite(number) && number >= 0);
}

export function IcmWorkbench({ onExit }: { onExit: () => void }) {
  const [mode, setMode] = useState<Mode>('icm');
  const [stacks, setStacks] = useState('25 40 18 12 7');
  const [payouts, setPayouts] = useState('40 25 18 10 7');
  const [heroIndex, setHeroIndex] = useState(0);
  const [villainIndex, setVillainIndex] = useState(1);
  const [risk, setRisk] = useState('18');
  const [showdown, setShowdown] = useState('55');
  const [bounty, setBounty] = useState('8');
  const [satelliteSeats, setSatelliteSeats] = useState('2');

  const result = useMemo(() => {
    try {
      const stackValues = parseNumbers(stacks);
      const payoutValues = mode === 'satellite' ? satellitePayouts(Number(satelliteSeats) || 1, 1) : parseNumbers(payouts);
      if (stackValues.length < 2 || payoutValues.length < 1) return null;
      const players = stackValues.map((stack, index) => ({ id: `P${index + 1}`, stack }));
      if (!players[heroIndex] || !players[villainIndex] || heroIndex === villainIndex) return null;
      const baseInput = {
        players,
        payouts: payoutValues,
        heroId: players[heroIndex].id,
        villainId: players[villainIndex].id,
        amountAtRisk: Number(risk) || 0,
        showdownEquity: (Number(showdown) || 0) / 100,
      };
      return mode === 'pko'
        ? { mode, base: calculateHeadsUpPkoRisk({ ...baseInput, villainBountyValue: Number(bounty) || 0 }) }
        : { mode, base: calculateHeadsUpIcmRisk(baseInput) };
    } catch { return null; }
  }, [mode, stacks, payouts, heroIndex, villainIndex, risk, showdown, bounty, satelliteSeats]);

  const playerCount = parseNumbers(stacks).length;
  const pko = result?.mode === 'pko' ? result.base : null;
  const base = result?.base;
  const indifferent = pko ? pko.pkoIndifferent : base?.icmIndifferent;
  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-5xl">
      <button type="button" onClick={onExit} className="pc-interactive flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
      <section className="pc-hero-glow mt-6 rounded-3xl border border-cyan-500/20 bg-[linear-gradient(135deg,rgba(6,182,212,0.12),rgba(15,23,42,0.75))] p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300"><Scale className="h-4 w-4" />Tournament $EV Workbench</div>
        <h1 className="mt-3 text-3xl font-bold">ChipEV、ICM、PKO、Satellite 不該混成同一個答案</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">此工具比較一個對稱風險：拒絕時維持初始籌碼；接受時 Hero / Villain 各承擔 R，勝負後互轉 R。假設沒有既有底池、盲注、ante、平手或後續下注；R 大於 0 時 Chip-EV 門檻為 50%，R 為 0 時兩者無差異。實戰面對 shove 的價格需另外計入底池，不能直接套用這個門檻。</p>
        <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-400">ICM 使用完整剩餘玩家與獎金，同等技術假設下計算主獎金期望；淘汰者仍取得其名次獎金。Satellite 以等值門票計算。PKO 只加本次能立即領取的賞金，未建模累加在自己頭上的賞金及未來賞金策略；FGS 需另行提供未來樹。</p>
        <div className="mt-5 flex flex-wrap gap-2">{([
          ['icm', 'ICM', Scale], ['pko', 'PKO', Coins], ['satellite', 'Satellite', Ticket],
        ] as const).map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setMode(value)} className={`pc-interactive flex items-center gap-2 rounded-xl border px-4 py-2 text-sm ${mode === value ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100' : 'border-slate-700 text-slate-400'}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
      </section>

      <section className="mt-6 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:grid-cols-2">
        <Field label="完整剩餘玩家的初始籌碼（BB，空白分隔）" value={stacks} onChange={setStacks} />
        {mode === 'satellite' ? <Field label="晉級席位數" value={satelliteSeats} onChange={setSatelliteSeats} /> : <Field label="獎金（同一單位）" value={payouts} onChange={setPayouts} />}
        <Select label="Hero" value={heroIndex} count={playerCount} onChange={setHeroIndex} />
        <Select label="Villain" value={villainIndex} count={playerCount} onChange={setVillainIndex} />
        <Field label="雙方各自承擔的風險 R（BB）" value={risk} onChange={setRisk} />
        <Field label="攤牌 Equity %" value={showdown} onChange={setShowdown} />
        {mode === 'pko' && <Field label="淘汰 Villain 後可立即領取的賞金（與獎金同單位）" value={bounty} onChange={setBounty} />}
      </section>

      {base ? <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={mode === 'satellite' ? '拒絕風險：席位機率' : '拒絕風險：獎金 EV'} value={base.foldEquity.toFixed(3)} />
        <Metric label={mode === 'satellite' ? '接受風險：席位機率' : mode === 'pko' ? '接受風險：主獎金 + 即時賞金 EV' : '接受風險：獎金 EV'} value={(pko ? pko.pkoCallEquity : base.callEquity).toFixed(3)} emphasize={(pko ? pko.pkoDollarEvDelta : base.dollarEvDelta) >= 0} />
        <Metric label={mode === 'pko' ? 'PKO Break-even' : 'ICM Break-even'} value={indifferent ? '無差異（皆可）' : `${(pko ? pko.pkoBreakEvenPercent : base.icmBreakEvenPercent).toFixed(1)}%`} />
        <Metric label="ICM Risk Premium" value={base.icmIndifferent ? '不適用：主獎金無差異' : `+${base.riskPremiumPercent.toFixed(1)}%`} />
        {pko && <><Metric label="Bounty EV" value={`${pko.bountyEv.toFixed(3)}`} emphasize={pko.bountyEv > 0} /><Metric label="可淘汰 Villain" value={pko.canEliminateVillain ? 'YES' : 'NO'} /></>}
        <div className="sm:col-span-2 lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 text-sm leading-7 text-slate-300">
          <Medal className="mr-2 inline h-4 w-4 text-cyan-300" /><b>判讀：</b> {base.chipEvIndifferent ? 'R=0，籌碼效用也無差異。' : `Chip-EV 參考門檻 ${base.chipEvBreakEvenPercent.toFixed(1)}%。`}{indifferent ? '在所選模型中，接受與拒絕風險對所有 0–100% equity 的效用相同，因此沒有唯一勝率門檻，也不產生正的 ICM risk premium。' : mode === 'satellite' ? `等值席位模型的最低接受 equity 為 ${base.icmBreakEvenPercent.toFixed(1)}%。` : mode === 'pko' ? `主獎金加即時賞金的最低接受 equity 為 ${(pko?.pkoBreakEvenPercent || 0).toFixed(1)}%；只有能實際淘汰對手時才產生即時 bounty EV。` : `ICM 的最低接受 equity 為 ${base.icmBreakEvenPercent.toFixed(1)}%。`}
        </div>
      </section> : <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-200">請確認完整玩家與獎金數、Hero/Villain 為不同存活玩家、0–100% equity，以及 0 ≤ R ≤ 雙方有效籌碼。若需記錄多位已淘汰玩家的名次，請在 FGS JSON 明示 eliminatedPlace。</div>}
    </div>
  </div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-xs text-slate-500">{label}<input value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/55 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500" /></label>; }
function Select({ label, value, count, onChange }: { label: string; value: number; count: number; onChange: (value: number) => void }) { return <label className="text-xs text-slate-500">{label}<select value={value} onChange={event => onChange(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/55 px-3 py-2.5 text-sm text-slate-100">{Array.from({ length: count }, (_, index) => <option key={index} value={index}>P{index + 1}</option>)}</select></label>; }
function Metric({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) { return <div className={`pc-card-lift rounded-2xl border p-5 ${emphasize ? 'border-emerald-500/25 bg-emerald-500/7' : 'border-slate-800 bg-slate-900/55'}`}><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-2xl font-bold">{value}</div></div>; }
