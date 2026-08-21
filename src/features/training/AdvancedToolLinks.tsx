import { ExternalLink } from 'lucide-react';

interface AdvancedToolLinksProps {
  tournament?: boolean;
}

const CORE_TOOLS = [
  { href: '#range-reading', label: 'Range 閱讀' },
  { href: '#boundary-map', label: '決策邊界' },
  { href: '#equity-workbench', label: 'Equity / 勝率' },
  { href: '#strategy-surface', label: 'Solver Surface' },
] as const;

const TOURNAMENT_TOOLS = [
  { href: '#icm-workbench', label: 'ICM' },
  { href: '#fgs-workbench', label: 'FGS' },
] as const;

export function AdvancedToolLinks({ tournament = false }: AdvancedToolLinksProps) {
  const tools = tournament ? [...CORE_TOOLS, ...TOURNAMENT_TOOLS] : CORE_TOOLS;

  return (
    <div data-testid="advanced-analysis-tools" className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">深入分析工具</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {tools.map(tool => (
          <a
            key={tool.href}
            href={tool.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/45 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-200"
          >
            {tool.label}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-slate-500">工具會在新分頁開啟；目前這一題與解說會保留。</p>
    </div>
  );
}
