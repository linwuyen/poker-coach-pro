import { useMemo, useState } from 'react';
import { ArrowLeft, Layers3, ShieldAlert } from 'lucide-react';
import { STRATEGY_PROFILES_V2, StrategyAction, StrategyProfile, mergeImmutableProfiles, normalizeFrequencies } from '../../strategy-engine-v2';
import { compareStrategyContexts, fingerprintStrategyContext } from '../../solver-data/contextFingerprint';
import { expectedStrategyEv, normalizeStrategyVector, strategyDistance, strategyEvRegret } from '../../learning-engine/strategyDistance';

const CUSTOM_PROFILES_KEY = 'poker_strategy_profiles_v2';
const ACTIONS: StrategyAction[] = ['raise', 'call', 'limp', 'allIn', 'fold'];
const LABELS: Record<StrategyAction, string> = { raise: 'Raise', call: 'Call', limp: 'Limp', allIn: 'All-In', fold: 'Fold' };

function loadCustom(): StrategyProfile[] {
  try { const value = JSON.parse(localStorage.getItem(CUSTOM_PROFILES_KEY) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
}

export function SolverSurfaceLab({ onExit }: { onExit: () => void }) {
  const profiles = useMemo(() => mergeImmutableProfiles(STRATEGY_PROFILES_V2, loadCustom()), []);
  const fullProfiles = profiles.filter(profile => profile.source.trustTier === 'verified-solver' || profile.evByHand);
  const visible = fullProfiles.length ? fullProfiles : profiles;
  const [profileId, setProfileId] = useState(visible[0]?.id || '');
  const profile = visible.find(item => item.id === profileId) || visible[0];
  const hands = profile ? Object.keys(profile.ranges).sort() : [];
  const [hand, setHand] = useState(hands[0] || 'AKs');
  const [chosen, setChosen] = useState<Record<string, number>>({ raise: 100, call: 0, limp: 0, allIn: 0, fold: 0 });
  const [stack, setStack] = useState(profile?.context.stackDepthBB || 100);
  const [openSize, setOpenSize] = useState(profile?.context.openSizeBB || 0);
  const [rake, setRake] = useState(profile?.context.rakePercent || 0);

  if (!profile) return <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-400">沒有 Strategy Profile。</div>;
  const solver = normalizeFrequencies(profile.ranges[hand]);
  const chosenVector = normalizeStrategyVector(Object.fromEntries(ACTIONS.map(action => [action, (chosen[action] || 0) / 100])));
  const targetVector = Object.fromEntries(ACTIONS.map(action => [action, solver[action]]));
  const distance = strategyDistance(targetVector, chosenVector);
  const actionEv = profile.evByHand?.[hand] || {};
  const regret = strategyEvRegret(targetVector, chosenVector, actionEv);
  const chosenEv = expectedStrategyEv(chosenVector, actionEv);
  const targetContext = { ...profile.context, stackDepthBB: stack, ...(profile.context.openSizeBB !== undefined ? { openSizeBB: openSize } : {}), ...(profile.context.rakePercent !== undefined ? { rakePercent: rake } : {}) };
  const contextMatch = compareStrategyContexts(targetContext, profile.context);
  const fingerprint = fingerprintStrategyContext(profile.context);

  const selectProfile = (id: string) => {
    const next = visible.find(item => item.id === id);
    setProfileId(id);
    if (next) {
      setHand(Object.keys(next.ranges).sort()[0] || 'AKs');
      setStack(next.context.stackDepthBB);
      setOpenSize(next.context.openSizeBB || 0);
      setRake(next.context.rakePercent || 0);
    }
  };

  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8"><div className="mx-auto max-w-6xl">
    <button type="button" onClick={onExit} className="pc-interactive flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
    <section className="pc-hero-glow mt-6 rounded-3xl border border-blue-500/20 bg-[linear-gradient(135deg,rgba(59,130,246,0.13),rgba(15,23,42,0.78))] p-6 md:p-8"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300"><Layers3 className="h-4 w-4" />Full Strategy Surface</div><h1 className="mt-3 text-3xl font-bold">不只問「最佳動作」，直接比較整個策略分布</h1><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">有 frequency 就算 Strategy Distance；有 per-action EV 才算策略 EV regret。若 profile 缺 EV，系統明確顯示 unavailable，不補假數字。</p></section>

    <section className="mt-6 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs text-slate-500">Profile<select value={profile.id} onChange={event => selectProfile(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm">{visible.map(item => <option key={`${item.id}@${item.version}`} value={item.id}>{item.name}</option>)}</select></label>
      <label className="text-xs text-slate-500">Hand<select value={hand} onChange={event => setHand(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm">{hands.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      <NumberField label="Target stack BB" value={stack} onChange={setStack} />
      <NumberField label="Target open BB" value={openSize} onChange={setOpenSize} />
      {profile.context.rakePercent !== undefined && <NumberField label="Target rake %" value={rake} onChange={setRake} />}
    </section>

    <section className="mt-6 grid gap-5 lg:grid-cols-2"><StrategyCard title="Solver / Profile" values={targetVector} /><StrategyEditor values={chosen} onChange={setChosen} /></section>
    <section className="mt-6 grid gap-4 md:grid-cols-4"><Metric label="Strategy similarity" value={`${distance.similarity.toFixed(1)}%`} /><Metric label="TV distance" value={distance.totalVariation.toFixed(3)} /><Metric label="Chosen EV" value={chosenEv === undefined ? 'Unavailable' : `${chosenEv.toFixed(3)}BB`} /><Metric label="EV regret" value={regret === undefined ? 'Unavailable' : `${regret.toFixed(3)}BB`} /></section>

    <section className="mt-6 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><h2 className="font-semibold">Strict Context Match</h2><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Status" value={contextMatch.status.toUpperCase()} /><Metric label="Fingerprint" value={fingerprint.id} /></div><div className="mt-4 text-xs leading-6 text-slate-400">Material mismatch：{contextMatch.materialMismatches.join('、') || 'none'}<br />Approx difference：{contextMatch.approximateDifferences.join('、') || 'none'}</div></div><div className="rounded-2xl border border-amber-500/20 bg-amber-500/7 p-5"><div className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" />Truth boundary</div><p className="mt-3 text-sm leading-7 text-amber-100/80">目前內建 profiles 多數仍是 teaching fallback。只有 source.trustTier = verified-solver 且 provenance 完整時，才應把頻率當 solver truth；EV 只有 profile 真正提供時才計算。</p><div className="mt-3 font-mono text-xs text-amber-200">{profile.source.trustTier} · {profile.source.solverName || profile.source.label}</div></div></section>
  </div></div>;
}

function StrategyCard({ title, values }: { title: string; values: Record<string, number> }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><h2 className="font-semibold">{title}</h2><div className="mt-4 space-y-3">{ACTIONS.map(action => <div key={action}><div className="mb-1 flex justify-between text-xs"><span>{LABELS[action]}</span><span className="font-mono">{((values[action] || 0) * 100).toFixed(1)}%</span></div><div className="h-2 rounded-full bg-slate-800"><div className="h-full rounded-full bg-blue-400" style={{ width: `${(values[action] || 0) * 100}%` }} /></div></div>)}</div></div>; }
function StrategyEditor({ values, onChange }: { values: Record<string, number>; onChange: (value: Record<string, number>) => void }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><h2 className="font-semibold">你的策略頻率</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{ACTIONS.map(action => <label key={action} className="text-xs text-slate-500">{LABELS[action]} %<input type="number" min="0" max="100" step="5" value={values[action] || 0} onChange={event => onChange({ ...values, [action]: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 font-mono text-sm text-slate-100" /></label>)}</div></div>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="text-xs text-slate-500">{label}<input type="number" value={value} onChange={event => onChange(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 font-mono text-sm text-slate-100" /></label>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="pc-card-lift rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 break-all font-mono text-lg font-bold">{value}</div></div>; }
