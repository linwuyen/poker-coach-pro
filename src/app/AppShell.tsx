import { ReactNode } from 'react';
import { BarChart3, Brain, CalendarCheck2, ChartNoAxesCombined, Database, FileUp, FlaskConical, Gauge, GitCompareArrows, Layers3, Settings2, ShieldCheck, Shuffle, TreePine, Trophy } from 'lucide-react';

export type AppPage = 'today' | 'train' | 'analysis';

const NAV_ITEMS: Array<{ id: AppPage; label: string; description: string; icon: typeof CalendarCheck2 }> = [
  { id: 'today', label: '今天', description: '只看下一個最高價值行動', icon: CalendarCheck2 },
  { id: 'train', label: '訓練', description: '看牌、決策、深挖、下一手', icon: Brain },
  { id: 'analysis', label: '進度', description: '複習、漏點、實戰回饋與診斷', icon: BarChart3 },
];

interface AppShellProps {
  page: AppPage;
  onPageChange: (page: AppPage) => void;
  children: ReactNode;
  onOpenSettings: () => void;
}

export function AppShell({ page, onPageChange, children, onOpenSettings }: AppShellProps) {
  const current = NAV_ITEMS.find(item => item.id === page) || NAV_ITEMS[0];
  const openLab = (hash: string) => { window.location.hash = hash; };
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="pc-ambient-layer" aria-hidden="true"><div className="pc-grid-fade" /><div className="pc-ambient-orb pc-ambient-orb-a" /><div className="pc-ambient-orb pc-ambient-orb-b" /></div>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 overflow-y-auto border-r border-slate-800/80 bg-slate-950/92 px-4 py-5 backdrop-blur-xl lg:flex lg:flex-col">
        <button type="button" onClick={() => onPageChange('today')} className="pc-interactive flex items-center gap-3 rounded-2xl px-2 py-2 text-left">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-lg font-black text-emerald-950 shadow-lg shadow-emerald-950/30">高</div>
          <div><div className="font-semibold tracking-tight">想高龍了 德撲訓練機</div><div className="text-xs text-slate-500">Closed-loop Poker Coach</div></div>
        </button>
        <nav className="mt-8 space-y-1.5">{NAV_ITEMS.map(item => { const Icon = item.icon; const active = item.id === page; return <button key={item.id} type="button" onClick={() => onPageChange(item.id)} className={`pc-interactive flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${active ? 'bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-500/25 shadow-lg shadow-emerald-950/10' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'}`}><Icon className="h-5 w-5 shrink-0" /><span><span className="block text-sm font-semibold">{item.label}</span><span className="block text-[11px] text-slate-500">{item.description}</span></span></button>; })}</nav>
        <div className="mt-4 space-y-2 border-t border-slate-800/70 pt-4">
          <button type="button" onClick={() => openLab('hand-history')} className="pc-interactive flex w-full items-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2.5 text-left text-emerald-200 hover:border-emerald-500/35"><FileUp className="h-4 w-4" /><span><span className="block text-sm font-semibold">實戰 HH → Leak</span><span className="block text-[11px] text-slate-500">Multi-site exact truth join</span></span></button>
          <button type="button" onClick={() => openLab('postflop-truth')} className="pc-interactive flex w-full items-center gap-3 rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-3 py-2.5 text-left text-cyan-200 hover:border-cyan-500/35"><Layers3 className="h-4 w-4" /><span><span className="block text-sm font-semibold">Postflop Truth v3</span><span className="block text-[11px] text-slate-500">Flop / Turn / River exact state</span></span></button>
          <button type="button" onClick={() => openLab('truth-ops')} className="pc-interactive flex w-full items-center gap-3 rounded-xl border border-blue-500/15 bg-blue-500/5 px-3 py-2.5 text-left text-blue-200 hover:border-blue-500/35"><ShieldCheck className="h-4 w-4" /><span><span className="block text-sm font-semibold">Truth Ops</span><span className="block text-[11px] text-slate-500">Solver / population / review</span></span></button>
          <button type="button" onClick={() => openLab('production-intelligence')} className="pc-interactive flex w-full items-center gap-3 rounded-xl border border-violet-500/15 bg-violet-500/5 px-3 py-2.5 text-left text-violet-200 hover:border-violet-500/35"><Gauge className="h-4 w-4" /><span><span className="block text-sm font-semibold">Production Intelligence</span><span className="block text-[11px] text-slate-500">P24–P30 acquisition / reliability</span></span></button>
          <button type="button" onClick={() => openLab('effectiveness')} className="pc-interactive flex w-full items-center gap-3 rounded-xl border border-amber-500/15 bg-amber-500/5 px-3 py-2.5 text-left text-amber-200 hover:border-amber-500/35"><ChartNoAxesCombined className="h-4 w-4" /><span><span className="block text-sm font-semibold">學習成效</span><span className="block text-[11px] text-slate-500">Observational before → follow-up</span></span></button>
          <button type="button" onClick={() => openLab('semantic-counterfactual')} className="pc-interactive flex w-full items-center gap-3 rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-3 py-2.5 text-left text-cyan-200 hover:border-cyan-500/35"><GitCompareArrows className="h-4 w-4" /><span><span className="block text-sm font-semibold">語義反事實</span><span className="block text-[11px] text-slate-500">One-variable solver flips</span></span></button>
          <button type="button" onClick={() => openLab('solver-corpus')} className="pc-interactive flex w-full items-center gap-3 rounded-xl border border-blue-500/15 bg-blue-500/5 px-3 py-2.5 text-left text-blue-200 hover:border-blue-500/35"><Database className="h-4 w-4" /><span><span className="block text-sm font-semibold">Solver 題庫</span><span className="block text-[11px] text-slate-500">PokerBench 11,000 labels</span></span></button>
          <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => openLab('experiment')} className="rounded-xl border border-fuchsia-500/15 bg-fuchsia-500/5 px-2 py-2 text-xs text-fuchsia-200"><FlaskConical className="mx-auto mb-1 h-4 w-4" />N-of-1</button><button type="button" onClick={() => openLab('tournament-context')} className="rounded-xl border border-amber-500/15 bg-amber-500/5 px-2 py-2 text-xs text-amber-200"><Trophy className="mx-auto mb-1 h-4 w-4" />MTT Join</button></div>
          <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => openLab('variant-trainer')} className="rounded-xl border border-violet-500/15 bg-violet-500/5 px-2 py-2 text-xs text-violet-200"><Shuffle className="mx-auto mb-1 h-4 w-4" />同構練習</button><button type="button" onClick={() => openLab('fgs-workbench')} className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-2 py-2 text-xs text-cyan-200"><TreePine className="mx-auto mb-1 h-4 w-4" />FGS</button></div>
        </div>
        <div className="mt-4 rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3 text-xs leading-5 text-slate-500"><span className="font-semibold text-slate-300">閉環</span><br />實戰 exposure → exact truth join → regret → 高價值訓練 → delayed/holdout → randomized N-of-1 / real-game recheck。缺資料一律 Unknown。</div>
        <div className="mt-auto space-y-2 pt-4"><button type="button" onClick={onOpenSettings} className="pc-interactive flex w-full items-center gap-3 rounded-xl border border-slate-800 px-3 py-3 text-left text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-slate-100"><Settings2 className="h-5 w-5" /><span><span className="block text-sm font-semibold">玩家與資料設定</span><span className="block text-[11px] text-slate-500">個人化、備份、加密同步</span></span></button><p className="px-2 text-[11px] leading-relaxed text-slate-600">Daily 只用 PokerBench training partition；Sibling / Holdout 保持隔離。</p></div>
      </aside>

      <div className="relative z-10 min-h-screen pb-24 lg:ml-64 lg:pb-0">
        <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/78 px-4 py-3 backdrop-blur-xl md:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div><h1 className="text-lg font-semibold tracking-tight md:text-xl">{current.label}</h1><p className="text-xs text-slate-500">{current.description}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => openLab('hand-history')} className="hidden rounded-lg border border-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/8 md:block">匯入 HH</button><button type="button" onClick={() => openLab('production-intelligence')} className="hidden rounded-lg border border-violet-500/20 px-3 py-2 text-xs font-medium text-violet-300 hover:bg-violet-500/8 lg:block">P24–P30</button><button type="button" onClick={() => openLab('truth-ops')} className="hidden rounded-lg border border-blue-500/20 px-3 py-2 text-xs font-medium text-blue-300 hover:bg-blue-500/8 xl:block">Truth Ops</button><button type="button" onClick={onOpenSettings} className="pc-interactive rounded-lg border border-slate-800 px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-900 hover:text-slate-100 lg:hidden">設定</button></div></div></header>
        <main className="pc-enter mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8 lg:px-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-slate-800 bg-slate-950/92 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">{NAV_ITEMS.map(item => { const Icon = item.icon; const active = item.id === page; return <button key={item.id} type="button" onClick={() => onPageChange(item.id)} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] ${active ? 'text-emerald-400' : 'text-slate-500'}`}><Icon className="h-5 w-5" />{item.label}</button>; })}</nav>
    </div>
  );
}
