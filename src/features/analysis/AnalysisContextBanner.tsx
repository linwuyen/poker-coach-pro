import { Link2, ShieldCheck } from 'lucide-react';
import { AnalysisContext, prettyCardCode } from './analysisContext';

export function AnalysisContextBanner({ context, compact = false }: { context: AnalysisContext | null; compact?: boolean }) {
  if (!context) return null;
  const cards = context.heroCards.map(prettyCardCode).join(' ');
  const board = context.boardCards.length ? context.boardCards.map(prettyCardCode).join(' ') : 'Preflop';
  return <section data-testid="analysis-context-banner" className={`border border-cyan-500/20 bg-cyan-500/6 text-slate-200 ${compact ? 'rounded-xl p-3' : 'rounded-2xl p-4'}`}>
    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-cyan-200"><Link2 className="h-4 w-4" />已帶入上一題 context<span className="rounded-full border border-cyan-500/20 bg-slate-950/40 px-2 py-0.5 font-mono text-[10px]">{context.source}</span></div>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
      <span className="font-mono text-slate-100">{cards || '未知手牌'}</span>
      <span>Board {board}</span>
      {context.street && <span>{context.street}</span>}
      {context.position && <span>{context.position}</span>}
      {context.potBB !== undefined && <span>Pot {context.potBB} BB</span>}
      {context.effectiveStackBB !== undefined && <span>Effective {context.effectiveStackBB} BB</span>}
      {context.spr !== undefined && <span>SPR {context.spr}</span>}
      {context.minimumCallingEquityPercent !== undefined
        ? <span>Call threshold {context.minimumCallingEquityPercent}%</span>
        : context.potOddsPercent !== undefined && <span>題目 Pot Odds {context.potOddsPercent}% · 非 call threshold</span>}
      {context.heroEquityPercent !== undefined && <span>Hero equity {context.heroEquityPercent}%</span>}
    </div>
    {!compact && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
      {context.selectedAction && <span>你：{context.selectedAction}</span>}
      {context.bestAction && <span>最佳解：{context.bestAction}</span>}
      {context.truthTier && <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />{context.truthTier}</span>}
      {context.truthSource && <span className="break-all">{context.truthSource}</span>}
    </div>}
  </section>;
}
