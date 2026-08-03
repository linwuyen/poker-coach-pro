import { ReactNode } from 'react';
import { BarChart3, BookOpen, Brain, CalendarCheck2, GraduationCap, Settings2 } from 'lucide-react';

export type AppPage = 'today' | 'train' | 'review' | 'learn' | 'analysis';

const NAV_ITEMS: Array<{ id: AppPage; label: string; description: string; icon: typeof CalendarCheck2 }> = [
  { id: 'today', label: '今日', description: '下一個最佳行動', icon: CalendarCheck2 },
  { id: 'train', label: '訓練', description: '綜合與專項練習', icon: Brain },
  { id: 'review', label: '複習', description: '錯題與薄弱主題', icon: GraduationCap },
  { id: 'learn', label: '學習', description: '範圍與策略工具', icon: BookOpen },
  { id: 'analysis', label: '分析', description: '進步與進階工具', icon: BarChart3 },
];

interface AppShellProps {
  page: AppPage;
  onPageChange: (page: AppPage) => void;
  children: ReactNode;
  onOpenLegacy: () => void;
}

export function AppShell({ page, onPageChange, children, onOpenLegacy }: AppShellProps) {
  const current = NAV_ITEMS.find(item => item.id === page) || NAV_ITEMS[0];
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-800/80 bg-slate-950/95 px-4 py-5 backdrop-blur lg:flex lg:flex-col">
        <button type="button" onClick={() => onPageChange('today')} className="flex items-center gap-3 rounded-2xl px-2 py-2 text-left">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-lg font-black text-emerald-950">P</div>
          <div>
            <div className="font-semibold tracking-tight">Poker Coach Pro</div>
            <div className="text-xs text-slate-500">System UI · Strategy v2</div>
          </div>
        </button>

        <nav className="mt-8 space-y-1.5">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = item.id === page;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPageChange(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                  active ? 'bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-500/25' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="block text-[11px] text-slate-500">{item.description}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2">
          <button type="button" onClick={onOpenLegacy} className="flex w-full items-center gap-3 rounded-xl border border-slate-800 px-3 py-3 text-left text-slate-400 transition hover:border-slate-700 hover:bg-slate-900 hover:text-slate-100">
            <Settings2 className="h-5 w-5" />
            <span>
              <span className="block text-sm font-semibold">進階工具</span>
              <span className="block text-[11px] text-slate-500">開啟原完整版介面</span>
            </span>
          </button>
          <p className="px-2 text-[11px] leading-relaxed text-slate-600">策略資料會標示版本與來源；基準模型不等同特定 solver 輸出。</p>
        </div>
      </aside>

      <div className="min-h-screen pb-24 lg:ml-64 lg:pb-0">
        <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/85 px-4 py-3 backdrop-blur md:px-8 lg:px-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight md:text-xl">{current.label}</h1>
              <p className="text-xs text-slate-500">{current.description}</p>
            </div>
            <button type="button" onClick={onOpenLegacy} className="rounded-lg border border-slate-800 px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-900 hover:text-slate-100 lg:hidden">
              進階工具
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8 lg:px-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-800 bg-slate-950/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = item.id === page;
          return (
            <button key={item.id} type="button" onClick={() => onPageChange(item.id)} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] ${active ? 'text-emerald-400' : 'text-slate-500'}`}>
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
