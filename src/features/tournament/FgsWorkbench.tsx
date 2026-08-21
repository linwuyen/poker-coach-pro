import { useMemo, useState } from 'react';
import { ArrowLeft, GitBranch, ShieldAlert, TreePine } from 'lucide-react';
import { FgsActionTree, compareFgsActions } from '../../tournament/icm';

const SAMPLE_ACTIONS: FgsActionTree[] = [
  {
    action: 'Fold / preserve stack',
    root: {
      id: 'fold-root',
      players: [{ id: 'Hero', stack: 30 }, { id: 'V1', stack: 40 }, { id: 'V2', stack: 30 }],
      children: [
        { id: 'fold-next-a', probability: 0.5, players: [{ id: 'Hero', stack: 28 }, { id: 'V1', stack: 42 }, { id: 'V2', stack: 30 }], note: 'Supplied future state A' },
        { id: 'fold-next-b', probability: 0.5, players: [{ id: 'Hero', stack: 32 }, { id: 'V1', stack: 38 }, { id: 'V2', stack: 30 }], note: 'Supplied future state B' },
      ],
    },
  },
  {
    action: 'Jam / take current risk',
    root: {
      id: 'jam-root',
      players: [{ id: 'Hero', stack: 30 }, { id: 'V1', stack: 40 }, { id: 'V2', stack: 30 }],
      children: [
        { id: 'jam-win', probability: 0.55, players: [{ id: 'Hero', stack: 60 }, { id: 'V1', stack: 10 }, { id: 'V2', stack: 30 }], note: 'User-supplied win/call branch' },
        { id: 'jam-lose', probability: 0.45, players: [{ id: 'Hero', stack: 0 }, { id: 'V1', stack: 70 }, { id: 'V2', stack: 30 }], note: 'User-supplied bust branch' },
      ],
    },
  },
];

export function FgsWorkbench({ onExit }: { onExit: () => void }) {
  const [heroId, setHeroId] = useState('Hero');
  const [payoutsText, setPayoutsText] = useState('50 30 20');
  const [treeText, setTreeText] = useState(JSON.stringify(SAMPLE_ACTIONS, null, 2));
  const result = useMemo(() => {
    try {
      const payouts = payoutsText.split(/[\s,]+/).filter(Boolean).map(Number);
      if (!payouts.length || payouts.some(value => !Number.isFinite(value) || value < 0)) throw new Error('Payouts 必須是非負數字。');
      const actions = JSON.parse(treeText) as FgsActionTree[];
      if (!Array.isArray(actions) || !actions.length) throw new Error('Action trees 必須是非空陣列。');
      return { rows: compareFgsActions(actions, payouts, heroId), error: '' };
    } catch (error) {
      return { rows: [], error: error instanceof Error ? error.message : 'FGS tree 無法計算' };
    }
  }, [heroId, payoutsText, treeText]);

  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8"><div className="mx-auto max-w-6xl">
    <button type="button" onClick={onExit} className="pc-interactive flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
    <section className="pc-hero-glow mt-6 rounded-3xl border border-cyan-500/20 bg-[linear-gradient(135deg,rgba(6,182,212,0.12),rgba(15,23,42,0.8))] p-6 md:p-8"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300"><TreePine className="h-4 w-4" />P8 · Finite Game Simulation</div><h1 className="mt-3 text-3xl font-bold">把「未來 game tree」真的放進 ICM，而不是用一句 FGS 當魔法</h1><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">每個 action 提供一棵未來狀態樹；每條 edge 的機率必須明確且同層加總為 1。葉節點用 exact ICM 算 $EV，再依分支機率 backward induction。系統不自行猜未來對手策略，因此結果嚴格是 conditional on supplied tree。</p></section>

    <section className="mt-6 grid gap-5 lg:grid-cols-[300px_1fr]">
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><label className="block text-xs text-slate-500">Hero ID<input value={heroId} onChange={event => setHeroId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm" /></label><label className="block text-xs text-slate-500">Payouts<input value={payoutsText} onChange={event => setPayoutsText(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 font-mono text-sm" /></label><div className="rounded-xl border border-amber-500/20 bg-amber-500/6 p-4 text-xs leading-6 text-amber-100/75"><ShieldAlert className="mb-2 h-4 w-4" />示範 JSON 的 55/45、50/50 都只是 demo assumptions，不是 bundled solver truth。實際使用時請輸入來自你的模型/solver/已驗證估計的 branch probabilities。</div></div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="flex items-center gap-2 font-semibold"><GitBranch className="h-4 w-4" />Action trees JSON</div><textarea data-testid="fgs-tree" value={treeText} onChange={event => setTreeText(event.target.value)} className="mt-4 min-h-[430px] w-full rounded-xl border border-slate-700 bg-slate-950/60 p-4 font-mono text-xs leading-5 outline-none focus:border-cyan-500" /></div>
    </section>

    {result.error ? <div className="mt-5 rounded-xl border border-red-500/25 bg-red-500/7 p-4 text-sm text-red-200">{result.error}</div> : <section className="mt-6 grid gap-4 md:grid-cols-2">{result.rows.map((row, index) => <div key={row.action} className={`rounded-2xl border p-5 ${index === 0 ? 'border-emerald-500/30 bg-emerald-500/7' : 'border-slate-800 bg-slate-900/55'}`}><div className="text-xs uppercase tracking-wider text-slate-500">{index === 0 ? 'Best under supplied tree' : 'Alternative'}</div><h2 className="mt-2 text-lg font-semibold">{row.action}</h2><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Hero $EV" value={row.heroEquity.toFixed(4)} /><Metric label="Δ vs best" value={row.deltaVsBest.toFixed(4)} /><Metric label="Leaves" value={String(row.leafCount)} /><Metric label="Depth" value={String(row.maxDepth)} /></div></div>)}</section>}
  </div></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3"><div className="text-[11px] text-slate-500">{label}</div><div className="mt-1 font-mono font-bold">{value}</div></div>; }
