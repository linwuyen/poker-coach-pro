import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { analysisContextHref, AnalysisContext, captureCurrentAnalysisContext, prettyCardCode } from '../analysis/analysisContext';

interface AdvancedToolLinksProps {
  tournament?: boolean;
  context?: AnalysisContext | null;
}

const CORE_TOOLS = [
  { href: '#current-analysis', label: '當前手牌總分析' },
  { href: '#minimal-flip', label: '最小翻轉' },
  { href: '#equity-workbench', label: 'Equity / 勝率' },
  { href: '#boundary-map', label: '決策邊界' },
  { href: '#range-reading', label: 'Range 閱讀' },
  { href: '#strategy-surface', label: 'Solver Surface' },
] as const;

const TRANSFER_TOOLS = [
  { href: '#semantic-counterfactual', label: '驗證是否真的懂' },
  { href: '#decision-boundary', label: '反事實題' },
  { href: '#contrastive-trainer', label: '對照題' },
  { href: '#sizing-trainer', label: 'Sizing' },
  { href: '#variant-trainer', label: '相似變式' },
] as const;

const LEARNING_TOOLS = [
  { href: '#skill-graph', label: 'Skill Graph' },
  { href: '#calibration', label: 'Calibration' },
] as const;

const TOURNAMENT_TOOLS = [
  { href: '#icm-workbench', label: 'ICM' },
  { href: '#fgs-workbench', label: 'FGS' },
] as const;

export function AdvancedToolLinks({ tournament = false, context: providedContext }: AdvancedToolLinksProps) {
  const [capturedContext, setCapturedContext] = useState<AnalysisContext | null>(null);
  useEffect(() => {
    if (providedContext !== undefined) return;
    setCapturedContext(captureCurrentAnalysisContext());
  }, [providedContext]);
  const context = providedContext === undefined ? capturedContext : providedContext;
  const summary = context ? `${context.heroCards.map(prettyCardCode).join(' ')} · ${context.street || '?'} · ${context.position || '?'}` : '正在擷取當前題目…';

  return (
    <div data-testid="advanced-analysis-tools" data-analysis-context-ready={context ? 'true' : 'false'} className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">深入分析工具</div>
        <div className="font-mono text-[10px] text-cyan-200/70">{summary}</div>
      </div>
      <ToolGroup label="直接分析" tools={CORE_TOOLS} context={context} />
      <ToolGroup label="理解驗證 / 變化題" tools={TRANSFER_TOOLS} context={context} />
      {tournament && <ToolGroup label="錦標賽" tools={TOURNAMENT_TOOLS} context={context} />}
      <details className="mt-3 rounded-lg border border-slate-800 bg-slate-950/25 px-3 py-2">
        <summary className="cursor-pointer text-[11px] font-semibold text-slate-400">學習診斷</summary>
        <ToolGroup label="" tools={LEARNING_TOOLS} context={context} />
      </details>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">連結會把這一手的 cards / board / street / position / pot / stack / action result / truth provenance 一起帶到新分頁；最小翻轉只接受 exact reversal 或 verified one-variable solver sibling。缺少的 solver range、EV 或 frequency 不會被補造。</p>
    </div>
  );
}

function ToolGroup({ label, tools, context }: { label: string; tools: ReadonlyArray<{ href: string; label: string }>; context: AnalysisContext | null }) {
  return <div className="mt-3">
    {label && <div className="mb-2 text-[10px] font-semibold text-slate-600">{label}</div>}
    <div className="flex flex-wrap gap-2">{tools.map(tool => (
      <a
        data-analysis-route={tool.href}
        key={tool.href}
        href={analysisContextHref(tool.href, context)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/45 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-200"
      >
        {tool.label}<ExternalLink className="h-3.5 w-3.5" />
      </a>
    ))}</div>
  </div>;
}
