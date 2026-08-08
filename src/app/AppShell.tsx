import { ReactNode } from 'react';
import { BarChart3, BookOpen, Brain, Calculator, CalendarCheck2, EyeOff, Gauge, GitCompareArrows, GraduationCap, Network, Ruler, Scale, Settings2 } from 'lucide-react';

export type AppPage = 'today' | 'train' | 'review' | 'learn' | 'analysis';

const NAV_ITEMS: Array<{ id: AppPage; label: string; description: string; icon: typeof CalendarCheck2 }> = [
  { id: 'today', label: '今日', description: '下一個最高 Poker EV 行動', icon: CalendarCheck2 },
  { id: 'train', label: '訓練', description: '決策、尺寸、範圍與 transfer', icon: Brain },
  { id: 'review', label: '複習', description: '延遲提取與薄弱能力', icon: GraduationCap },
  { id: 'learn', label: '學習', description: 'Truth、Equity、Exploit 與 ICM', icon: BookOpen },
  { id: 'analysis', label: '分析', description: 'EV leak、Situation 與處方', icon: BarChart3 },
];

interface AppShellProps {
  page: AppPage;
  onPageChange: (page: AppPage) => void;
  children: ReactNode;
  onOpenSettings: () => void;
}

export function AppShell({ page, onPageChange, children, onOpenSettings }: AppShellProps) {
  const current = NAV_ITEMS.find(item => item.id === page) || NAV_ITEMS[0];
  const openHash = (hash: string) => { window.location.hash = hash; };
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="pc-ambient-layer" aria-hidden="true"><div className="pc-grid-fade" /><div className="pc-ambient-orb pc-ambient-orb-a" /><div className="pc-ambient-orb pc-ambient-orb-b" /></div>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-800/80 bg-slate-950/92 px-4 py-5 backdrop-blur-xl lg:flex lg:flex-col">
        <button type="button" onClick={() => onPageChange('today')} className="pc-interactive flex items-center gap-3 rounded-2xl px-2 py-2 text-left">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-lg font-black text-emerald-950 shadow-lg shadow-emerald-950/30">高</div>
          <div><div className="font-semibold tracking-tight">想高龍了 德撲訓練機</div><div className="text-xs text-slate-500">Learning Engine v4 · Truth First</div></div>
        </button>
        <nav className="mt-8 space-y-1.5">{NAV_ITEMS.map(item => { const Icon = item.icon; const active = item.id === page; return <button key={item.id} type="button" onClick={() => onPageChange(item.id)} className={`pc-interactive flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${active ? 'bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-500/25 shadow-lg shadow-emerald-950/10' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'}`}><Icon className="h-5 w-5 shrink-0" /><span><span className="block text-sm font-semibold">{item.label}</span><span className="block text-[11px] text-slate-500">{item.description}</span></span></button>; })}</nav>
        <div className="mt-auto space-y-2"><button type="button" onClick={onOpenSettings} className="pc-interactive flex w-full items-center gap-3 rounded-xl border border-slate-800 px-3 py-3 text-left text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-slate-100"><Settings2 className="h-5 w-5" /><span><span className="block text-sm font-semibold">玩家與資料設定</span><span className="block text-[11px] text-slate-500">個人化、備份、加密同步</span></span></button><p className="px-2 text-[11px] leading-relaxed text-slate-600">Solver、Exact Math、Population、Expert 與 Heuristic 來源分層；不支援的節點不硬猜。</p></div>
      </aside>

      <div className="relative z-10 min-h-screen pb-24 lg:ml-64 lg:pb-0">
        <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/78 px-4 py-3 backdrop-blur-xl md:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div><h1 className="text-lg font-semibold tracking-tight md:text-xl">{current.label}</h1><p className="text-xs text-slate-500">{current.description}</p></div><div className="flex flex-wrap items-center justify-end gap-2">
          {page === 'train' && <><ToolButton onClick={() => openHash('decision-boundary')} icon={<Gauge className="h-4 w-4" />} label="決策邊界" tone="violet" /><ToolButton onClick={() => openHash('sizing-trainer')} icon={<Ruler className="h-4 w-4" />} label="尺寸 EV" tone="teal" /><ToolButton onClick={() => openHash('range-reading')} icon={<Brain className="h-4 w-4" />} label="對抗範圍" tone="emerald" /><ToolButton onClick={() => openHash('hidden-benchmark')} icon={<EyeOff className="h-4 w-4" />} label="Hidden" tone="amber" /></>}
          {page === 'learn' && <><ToolButton onClick={() => openHash('equity-workbench')} icon={<Calculator className="h-4 w-4" />} label="Equity" tone="blue" /><ToolButton onClick={() => openHash('exploit-workbench')} icon={<GitCompareArrows className="h-4 w-4" />} label="Exploit" tone="fuchsia" /><ToolButton onClick={() => openHash('icm-workbench')} icon={<Scale className="h-4 w-4" />} label="MTT $EV" tone="cyan" /></>}
          {page === 'analysis' && <ToolButton onClick={() => openHash('skill-graph')} icon={<Network className="h-4 w-4" />} label="EV Leak Graph" tone="amber" />}
          <button type="button" onClick={onOpenSettings} className="pc-interactive rounded-lg border border-slate-800 px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-900 hover:text-slate-100 lg:hidden">設定</button>
        </div></div></header>
        <main className="pc-enter mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8 lg:px-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-800 bg-slate-950/92 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">{NAV_ITEMS.map(item => { const Icon = item.icon; const active = item.id === page; return <button key={item.id} type="button" onClick={() => onPageChange(item.id)} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] ${active ? 'text-emerald-400' : 'text-slate-500'}`}><Icon className="h-5 w-5" />{item.label}</button>; })}</nav>
    </div>
  );
}

function ToolButton({ onClick, icon, label, tone }: { onClick: () => void; icon: ReactNode; label: string; tone: 'violet' | 'teal' | 'emerald' | 'amber' | 'blue' | 'fuchsia' | 'cyan' }) {
  const classes = {
    violet: 'border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15',
    teal: 'border-teal-500/30 bg-teal-500/10 text-teal-300 hover:bg-teal-500/15',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15',
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/15',
    fuchsia: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/15',
    cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/15',
  }[tone];
  return <button type="button" onClick={onClick} title={label} className={`pc-interactive flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${classes}`}>{icon}<span className="hidden xl:inline">{label}</span></button>;
}
