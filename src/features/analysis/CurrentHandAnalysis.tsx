import { ArrowLeft, Calculator, Crosshair, ShieldCheck, Sparkles } from 'lucide-react';
import { analyzeHandMath, evaluateHandStrength } from '../../utils/handMath';
import { CardUI } from '../../components/CardUI';
import { AnalysisContextBanner } from './AnalysisContextBanner';
import { analysisContextHref, codeToCard, readAnalysisContextFromHash } from './analysisContext';

const TOOLS = [
  ['#equity-workbench', 'Equity / 勝率'],
  ['#boundary-map', '決策邊界'],
  ['#range-reading', 'Range 閱讀'],
  ['#strategy-surface', 'Solver Surface'],
  ['#semantic-counterfactual', '驗證是否真的懂'],
  ['#contrastive-trainer', '對照題'],
  ['#sizing-trainer', 'Sizing'],
  ['#variant-trainer', '相似變式'],
] as const;

export function CurrentHandAnalysis({ onExit }: { onExit: () => void }) {
  const context = readAnalysisContextFromHash();
  const hero = (context?.heroCards || []).map(codeToCard).filter((card): card is NonNullable<ReturnType<typeof codeToCard>> => Boolean(card));
  const board = (context?.boardCards || []).map(codeToCard).filter((card): card is NonNullable<ReturnType<typeof codeToCard>> => Boolean(card));
  const strength = hero.length === 2 ? evaluateHandStrength(hero, board) : null;
  const minimumEquity = context?.minimumCallingEquityPercent;
  const rawPotOdds = context?.potOddsPercent;
  const math = hero.length === 2 ? analyzeHandMath(hero, board, minimumEquity === undefined ? undefined : `${minimumEquity}%`) : null;
  const hasMeasuredEquity = typeof context?.heroEquityPercent === 'number';
  const equityMargin = hasMeasuredEquity && minimumEquity !== undefined ? context!.heroEquityPercent! - minimumEquity : undefined;
  const thresholdValue = minimumEquity === undefined ? (rawPotOdds === undefined ? '未提供' : '不適用') : `${minimumEquity}%`;
  const thresholdDetail = minimumEquity !== undefined
    ? '當前決策含 Call option，題目 pot odds 可作為最低跟注 equity 門檻'
    : rawPotOdds !== undefined
      ? `題目顯示 ${rawPotOdds}%，但這個決策不是 facing-call；不把它轉成跟注門檻`
      : '當前題沒有可驗證的 facing-call 價格門檻';
  const marginDetail = equityMargin !== undefined
    ? `Hero equity ${context!.heroEquityPercent}% − call threshold ${minimumEquity}%`
    : hasMeasuredEquity
      ? `Hero showdown equity ${context!.heroEquityPercent}% 已帶入；本題沒有 facing-call threshold，所以不計 call margin`
      : '這題沒有可靠 villain range / Hero equity，所以不虛構';

  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-6xl">
      <button type="button" onClick={onExit} className="flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
      <section className="mt-6 rounded-3xl border border-cyan-500/20 bg-[linear-gradient(135deg,rgba(6,182,212,0.12),rgba(15,23,42,0.78))] p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300"><Sparkles className="h-4 w-4" />Current Hand Analysis</div>
        <h1 className="mt-3 text-3xl font-bold">直接分析你剛剛那一題，不再從空白工具開始</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">只使用當前題可驗證的資料。牌力、outs、facing-call pot-odds 邊界屬於本機數學；PokerBench 若只有 optimal label，就不會假裝有 per-action EV 或 mixed frequency。</p>
      </section>

      <div className="mt-5"><AnalysisContextBanner context={context} /></div>

      {context && <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div><div className="text-xs text-slate-500">Hero</div><div className="mt-2 flex gap-2">{hero.map((card, index) => <CardUI key={`${card.rank}-${card.suit}-${index}`} card={card} size="sm" />)}</div></div>
          <div className="min-w-[240px] flex-1"><div className="text-xs text-slate-500">Board</div><div className="mt-2 flex flex-wrap gap-2">{board.length ? board.map((card, index) => <CardUI key={`${card.rank}-${card.suit}-${index}`} card={card} size="sm" />) : <span className="rounded-xl border border-dashed border-slate-700 px-5 py-3 text-xs text-slate-500">Preflop</span>}</div></div>
        </div>
      </section>}

      <section className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<ShieldCheck className="h-4 w-4" />} label="目前牌力" value={strength?.name || '資料不足'} detail={strength?.draw || '以目前可見牌面分類'} />
        <Metric icon={<Calculator className="h-4 w-4" />} label="Draw / Outs" value={math?.hasDraw ? `${math.outs} outs` : '無明確 draw'} detail={math?.hasDraw ? `${math.drawDescription} · 下一張約 ${math.hitProbNext}%${context?.street === 'Flop' ? ` · 到 River 約 ${math.hitProbRiver}%` : ''}` : '不把未知 range 當成已知 equity'} />
        <Metric icon={<Crosshair className="h-4 w-4" />} label="最低跟注 Equity" value={thresholdValue} detail={thresholdDetail} />
        <Metric icon={<Calculator className="h-4 w-4" />} label="Equity margin" value={equityMargin === undefined ? 'Unavailable' : `${equityMargin >= 0 ? '+' : ''}${equityMargin.toFixed(1)}%`} detail={marginDetail} />
      </section>

      <section className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
        <div className="font-semibold text-violet-100">證據邊界</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Fact label="可直接證明" value={context?.source === 'pokerbench' ? '這筆 PokerBench row 的 exact optimal label、牌面結構、本機牌力與數學。' : '此題已驗證 feedback、牌面結構、本機牌力與題目提供的 EV/range evidence；若題目明示 showdown equity，也會原值帶入。'} />
          <Fact label="不能憑空補" value={context?.source === 'pokerbench' ? 'per-action EV、mixed frequency、solver 因果理由與 villain range。' : '非 facing-call 題目的百分比不會被轉成 call threshold；題目沒提供的 solver frequency / EV / range 也不會被猜測。'} />
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
        <div className="text-sm font-semibold">帶著同一手牌繼續深入</div>
        <div className="mt-3 flex flex-wrap gap-2">{TOOLS.map(([route, label]) => <a key={route} href={analysisContextHref(route, context)} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-700 bg-slate-950/45 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200">{label}</a>)}</div>
        <p className="mt-3 text-[11px] leading-5 text-slate-500">能直接套用 context 的工具會預填；沒有 exact input 的工具只顯示 context 並要求你補必要資料，不以近似資料冒充答案。</p>
      </section>
    </div>
  </div>;
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="flex items-center gap-2 text-xs text-slate-500">{icon}{label}</div><div className="mt-2 font-mono text-xl font-bold">{value}</div><div className="mt-2 text-xs leading-5 text-slate-500">{detail}</div></div>;
}
function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 text-sm leading-6 text-slate-300">{value}</div></div>; }
