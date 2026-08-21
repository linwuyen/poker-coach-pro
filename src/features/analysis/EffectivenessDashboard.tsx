import { ArrowLeft, ChartNoAxesCombined, ShieldAlert, TrendingDown, TrendingUp } from 'lucide-react';
import { evaluateLearningEffectiveness } from '../../learning-engine/effectiveness';
import { loadHistory } from '../../utils/history';

export function EffectivenessDashboard({ onExit }: { onExit: () => void }) {
  const report = evaluateLearningEffectiveness(loadHistory());
  const [baseline, training, followup] = report.windows;
  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8"><div className="mx-auto max-w-6xl">
    <button type="button" onClick={onExit} className="pc-interactive flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
    <section className="pc-hero-glow mt-6 rounded-3xl border border-amber-500/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(15,23,42,0.8))] p-6 md:p-8"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300"><ChartNoAxesCombined className="h-4 w-4" />Learning Effectiveness</div><h1 className="mt-3 text-3xl font-bold">Before → Training → Follow-up：看能力有沒有真的留下來</h1><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">只比較訓練機自己的未洩漏 holdout、transfer 與 delayed retention。這是單一玩家的 observational before/after，不是 RCT，因此只報趨勢與 evidence level。</p><div className="mt-4 inline-flex rounded-xl border border-amber-500/20 bg-amber-500/7 px-4 py-2 text-sm font-semibold text-amber-200">Evidence：{report.evidenceLevel.toUpperCase()}</div></section>

    <section className="mt-6 grid gap-4 md:grid-cols-3"><WindowCard title={baseline.window.label} metrics={baseline} /><WindowCard title={training.window.label} metrics={training} /><WindowCard title={followup.window.label} metrics={followup} /></section>
    <section className="mt-6 grid gap-4 md:grid-cols-3"><DeltaCard label="Holdout accuracy" delta={report.holdout} suffix="%" /><DeltaCard label="Transfer accuracy" delta={report.transfer} suffix="%" /><DeltaCard label="Delayed retention" delta={report.delayedRetention} suffix="%" /></section>

    <section className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/6 p-5"><div className="flex items-center gap-2 font-semibold text-amber-200"><ShieldAlert className="h-5 w-5" />如何解讀</div><ul className="mt-3 space-y-2 text-sm leading-6 text-amber-100/75">{report.caveats.map(caveat => <li key={caveat}>• {caveat}</li>)}</ul></section>
  </div></div>;
}

function WindowCard({ title, metrics }: { title: string; metrics: ReturnType<typeof evaluateLearningEffectiveness>['windows'][number] }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><h2 className="font-semibold">{title}</h2><div className="mt-4 space-y-2 text-xs"><Row label="Training decisions" value={metrics.trainingDecisions} /><Row label="Holdout" value={`${metrics.holdoutAttempts} · ${fmt(metrics.holdoutAccuracy, '%')}`} /><Row label="Transfer" value={`${metrics.transferAttempts} · ${fmt(metrics.transferAccuracy, '%')}`} /><Row label="Delayed" value={`${metrics.delayedAttempts} · ${fmt(metrics.delayedRetention, '%')}`} /></div></div>;
}

function DeltaCard({ label, delta, suffix }: { label: string; delta: ReturnType<typeof evaluateLearningEffectiveness>['holdout']; suffix: string }) {
  const Icon = delta.improved === undefined ? ChartNoAxesCombined : delta.improved ? TrendingUp : TrendingDown;
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="flex items-center gap-2 text-sm text-slate-400"><Icon className="h-4 w-4" />{label}</div><div className="mt-3 font-mono text-2xl font-bold">{delta.delta === undefined ? 'Insufficient' : `${delta.delta >= 0 ? '+' : ''}${delta.delta.toFixed(2)}${suffix}`}</div><div className="mt-2 text-xs text-slate-500">{fmt(delta.baseline, suffix)} → {fmt(delta.followup, suffix)}</div></div>;
}

function Row({ label, value }: { label: string; value: string | number }) { return <div className="flex justify-between gap-3"><span className="text-slate-500">{label}</span><span className="font-mono text-slate-300">{value}</span></div>; }
function fmt(value: number | undefined, suffix: string): string { return value === undefined ? '-' : `${value.toFixed(1)}${suffix}`; }
