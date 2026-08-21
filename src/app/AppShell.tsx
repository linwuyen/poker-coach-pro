import { ReactNode } from 'react';
import { BarChart3, Brain, CalendarCheck2, Settings2 } from 'lucide-react';

export type AppPage = 'today' | 'train' | 'analysis';

const NAV_ITEMS: Array<{ id: AppPage; label: string; description: string; icon: typeof CalendarCheck2 }> = [
  { id: 'today', label: '今天', description: '直接繼續最值得的決策', icon: CalendarCheck2 },
  { id: 'train', label: '訓練', description: '一直打牌，系統自動調整題目', icon: Brain },
  { id: 'analysis', label: '進度', description: '只看進步、漏點與下一步', icon: BarChart3 },
];

interface AppShellProps {
  page: AppPage;
  onPageChange: (page: AppPage) => void;
  children: ReactNode;
  onOpenSettings: () => void;
}

export function AppShell({ page, onPageChange, children, onOpenSettings }: AppShellProps) {
  const current = NAV_ITEMS.find(item => item.id === page) || NAV_ITEMS[0];
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="pc-ambient-layer" aria-hidden="true"><div className="pc-grid-fade" /><div className="pc-ambient-orb pc-ambient-orb-a" /><div className="pc-ambient-orb pc-ambient-orb-b" /></div>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-800/80 bg-slate-950/92 px-4 py-5 backdrop-blur-xl lg:flex lg:flex-col">
        <button type="button" onClick={() => onPageChange('today')} className="pc-interactive flex items-center gap-3 rounded-2xl px-2 py-2 text-left">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-lg font-black text-emerald-950 shadow-lg shadow-emerald-950/30">高</div>
          <div><div className="font-semibold tracking-tight">想高龍了 德撲訓練機</div><div className="text-xs text-slate-500">Volume-first Poker Coach</div></div>
        </button>
        <nav className="mt-8 space-y-1.5">{NAV_ITEMS.map(item => { const Icon = item.icon; const active = item.id === page; return <button key={item.id} type="button" onClick={() => onPageChange(item.id)} className={`pc-interactive flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${active ? 'bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-500/25' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'}`}><Icon className="h-5 w-5 shrink-0" /><span><span className="block text-sm font-semibold">{item.label}</span><span className="block text-[11px] text-slate-500">{item.description}</span></span></button>; })}</nav>
        <div className="mt-6 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4 text-xs leading-6 text-slate-400">
          <div className="font-semibold text-slate-200">你只需要做決策</div>
          <p className="mt-2">題目排序、Solver truth、漏點、語義反事實、複習與個人化都在背景自動運作。缺資料時系統直接標 Unknown，不會叫你補 JSON。</p>
        </div>
        <div className="mt-auto pt-4"><button type="button" onClick={onOpenSettings} className="pc-interactive flex w-full items-center gap-3 rounded-xl border border-slate-800 px-3 py-3 text-left text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-slate-100"><Settings2 className="h-5 w-5" /><span><span className="block text-sm font-semibold">設定</span><span className="block text-[11px] text-slate-500">玩家偏好、資料與備份</span></span></button></div>
      </aside>

      <div className="relative z-10 min-h-screen pb-24 lg:ml-64 lg:pb-0">
        <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/78 px-4 py-3 backdrop-blur-xl md:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div><h1 className="text-lg font-semibold tracking-tight md:text-xl">{current.label}</h1><p className="text-xs text-slate-500">{current.description}</p></div><button type="button" onClick={onOpenSettings} className="pc-interactive rounded-lg border border-slate-800 px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-900 hover:text-slate-100"><Settings2 className="inline h-4 w-4" /><span className="ml-2 hidden sm:inline">設定</span></button></div></header>
        <main className="pc-enter mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8 lg:px-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-slate-800 bg-slate-950/92 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">{NAV_ITEMS.map(item => { const Icon = item.icon; const active = item.id === page; return <button key={item.id} type="button" onClick={() => onPageChange(item.id)} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] ${active ? 'text-emerald-400' : 'text-slate-500'}`}><Icon className="h-5 w-5" />{item.label}</button>; })}</nav>
    </div>
  );
}
