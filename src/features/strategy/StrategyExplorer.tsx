import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Database, Download, Grid3X3, List, Upload } from 'lucide-react';
import {
  formatFrequency,
  getAllStartingHands,
  getDecision,
  getRangeStats,
  importSolverEnvelope,
  isMixedStrategy,
  mergeImmutableProfiles,
  normalizeFrequencies,
  STRATEGY_PROFILES_V2,
  STRATEGY_RANKS,
  StrategyAction,
  StrategyProfile,
  StrategySpot,
} from '../../strategy-engine-v2';

const ACTION_LABELS: Record<StrategyAction, string> = { raise: '加注', call: '跟注', limp: '跛入', fold: '棄牌', allIn: '全下' };
const POSITION_LABELS: Record<string, string> = { utg: 'UTG', utg1: 'UTG+1', utg2: 'UTG+2', mp: 'MP', hj: 'HJ', co: 'CO', btn: 'BTN', sb: 'SB', bb: 'BB' };
const SPOT_LABELS: Record<StrategySpot, string> = { rfi: 'RFI', 'vs-open': '對開池', 'bb-defense': 'BB 防守', '3bet': '3-Bet', '4bet': '4-Bet', 'push-fold': 'Push/Fold' };
const CUSTOM_PROFILES_KEY = 'poker_strategy_profiles_v2';

export function StrategyExplorer() {
  const [customProfiles, setCustomProfiles] = useState<StrategyProfile[]>(loadCustomProfiles);
  const profiles = useMemo(() => mergeImmutableProfiles(STRATEGY_PROFILES_V2, customProfiles), [customProfiles]);
  const [profileId, setProfileId] = useState(profiles[0]?.id || '');
  const [selectedHand, setSelectedHand] = useState('AKs');
  const [view, setView] = useState<'matrix' | 'list'>('matrix');
  const [notice, setNotice] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const profile = profiles.find(item => item.id === profileId) || profiles[0];
  const decision = getDecision(profile, selectedHand);
  const stats = getRangeStats(profile);
  const groupedSpots = [...new Set(profiles.map(item => item.context.spot))];
  const visibleHands = getAllStartingHands().filter(hand => {
    const frequencies = normalizeFrequencies(profile.ranges[hand]);
    return frequencies.fold < 0.999;
  });

  const selectSpot = (spot: StrategySpot) => {
    const next = profiles.find(item => item.context.spot === spot);
    if (next) setProfileId(next.id);
  };

  const importProfiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const imported = importSolverEnvelope(await file.text(), profiles);
      const next = mergeImmutableProfiles(customProfiles, imported.profiles);
      setCustomProfiles(next);
      localStorage.setItem(CUSTOM_PROFILES_KEY, JSON.stringify(next));
      if (imported.profiles[0]) setProfileId(imported.profiles[0].id);
      setNotice(`已匯入 ${imported.profiles.length} 份不可變策略 Profile。${imported.warnings.length ? ` ${imported.warnings.join(' ')}` : ''}`);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : '匯入失敗。');
    }
  };

  const exportSchema = () => {
    const sample = { schemaVersion: 2, exportedAt: new Date().toISOString(), exporter: 'solver-name/version', profiles: [] };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'strategy-engine-v2-import-template.json';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4 md:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Strategy Engine v2.2</div><h2 className="mt-2 text-xl font-semibold">情境化翻前策略</h2><p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">Range Profile 仍可用於頻率矩陣，但內建 heuristic 只做 fallback。Solver-computed 單點決策改由 PokerBench Corpus 提供，沒有對應真值時不以 heuristic 冒充 verified solver。</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={exportSchema} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300"><Download className="h-4 w-4" />匯入格式</button><button type="button" onClick={() => importRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-emerald-500/30 px-3 py-2 text-xs text-emerald-300"><Upload className="h-4 w-4" />匯入 Solver</button><button type="button" onClick={() => { window.location.hash = 'solver-corpus'; }} className="pc-interactive flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/8 px-3 py-2 text-xs text-blue-200"><Database className="h-4 w-4" />PokerBench Solver</button><input ref={importRef} type="file" accept="application/json" className="hidden" onChange={importProfiles} /></div>
        </div>
        {notice && <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/8 p-3 text-xs leading-relaxed text-amber-200">{notice}</div>}

        <div className="mt-5 flex flex-wrap gap-2">{groupedSpots.map(spot => <button key={spot} type="button" onClick={() => selectSpot(spot)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${profile.context.spot === spot ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-300' : 'border-slate-800 text-slate-500'}`}>{SPOT_LABELS[spot]}</button>)}</div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{profiles.filter(item => item.context.spot === profile.context.spot).map(item => <button key={`${item.id}@${item.version}`} type="button" onClick={() => setProfileId(item.id)} className={`shrink-0 rounded-lg border px-3 py-2 text-xs ${item.id === profile.id ? 'border-blue-500/40 bg-blue-500/10 text-blue-200' : 'border-slate-800 text-slate-500'}`}>{POSITION_LABELS[item.context.position]}{item.context.villainPosition ? ` vs ${POSITION_LABELS[item.context.villainPosition]}` : ''} · {item.context.stackDepthBB}BB</button>)}</div>

        <div className="mt-5 flex items-center justify-between"><div className="text-sm font-semibold">{profile.name}</div><div className="flex rounded-lg border border-slate-800 p-1 text-xs"><button type="button" onClick={() => setView('matrix')} className={`flex items-center gap-1 rounded-md px-2 py-1.5 ${view === 'matrix' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}><Grid3X3 className="h-3.5 w-3.5" />矩陣</button><button type="button" onClick={() => setView('list')} className={`flex items-center gap-1 rounded-md px-2 py-1.5 ${view === 'list' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}><List className="h-3.5 w-3.5" />清單</button></div></div>

        {view === 'matrix' ? <div className="mt-4 overflow-x-auto"><div className="grid min-w-[540px] grid-cols-13 gap-1 rounded-xl border border-slate-800 bg-slate-950 p-2">{STRATEGY_RANKS.map((rowRank, row) => STRATEGY_RANKS.map((columnRank, column) => {
          const hand = row === column ? `${rowRank}${columnRank}` : row < column ? `${rowRank}${columnRank}s` : `${columnRank}${rowRank}o`;
          const frequencies = normalizeFrequencies(profile.ranges[hand]);
          const selected = selectedHand === hand;
          return <button key={hand} type="button" onClick={() => setSelectedHand(hand)} title={frequencyTitle(hand, frequencies)} style={{ background: frequencyBackground(frequencies) }} className={`aspect-square rounded-[5px] text-[10px] font-bold text-white [text-shadow:0_1px_2px_#000] transition ${selected ? 'z-10 ring-2 ring-amber-300 ring-offset-1 ring-offset-slate-950' : 'hover:scale-110 hover:ring-1 hover:ring-white/50'}`}>{hand}</button>;
        }))}</div></div> : <div className="mt-4 grid max-h-[520px] gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{visibleHands.map(hand => { const f = normalizeFrequencies(profile.ranges[hand]); return <button key={hand} type="button" onClick={() => setSelectedHand(hand)} className={`rounded-xl border p-3 text-left ${selectedHand === hand ? 'border-amber-400/50 bg-amber-400/8' : 'border-slate-800 bg-slate-950/30'}`}><div className="font-mono font-bold">{hand}</div><div className="mt-1 text-[11px] text-slate-500">{frequencyTitle('', f)}</div></button>; })}</div>}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="flex items-start justify-between"><div><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Selected hand</div><div className="mt-1 font-mono text-4xl font-black">{decision.hand}</div></div><span className={`rounded-full px-3 py-1 text-xs ${decision.mixed ? 'bg-amber-400/12 text-amber-300' : 'bg-emerald-500/12 text-emerald-300'}`}>{decision.primaryAction ? ACTION_LABELS[decision.primaryAction] : '平衡混合'}</span></div><div className="mt-5 space-y-3">{(['raise', 'call', 'limp', 'allIn', 'fold'] as StrategyAction[]).map(action => <FrequencyRow key={action} label={ACTION_LABELS[action]} value={decision.frequencies[action]} className={actionClass(action)} />)}</div>{decision.actionEv && <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/7 p-3 text-xs text-blue-200">此手含行動 EV 資料；最佳 EV {decision.bestEvBB?.toFixed(2)}BB。</div>}</section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="text-sm font-semibold">範圍摘要</div><div className="mt-4 grid grid-cols-2 gap-3"><Stat label="持續範圍" value={`${stats.continuePercentage.toFixed(1)}%`} /><Stat label="主動範圍" value={`${stats.aggressivePercentage.toFixed(1)}%`} /><Stat label="有效籌碼" value={`${profile.context.stackDepthBB}BB`} /><Stat label="開池尺寸" value={`${profile.context.openSizeBB || '-'}BB`} /></div><div className="mt-4 text-xs leading-relaxed text-slate-500">Raise {stats.raiseCombos.toFixed(0)} · Call {stats.callCombos.toFixed(0)} · Limp {stats.limpCombos.toFixed(0)} · Jam {stats.allInCombos.toFixed(0)} combos</div></section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 text-sm"><div className="flex items-center gap-2 font-semibold"><Database className="h-4 w-4 text-emerald-400" />資料可信度</div><dl className="mt-4 space-y-2 text-xs"><InfoRow label="版本" value={profile.version} /><InfoRow label="節點" value={SPOT_LABELS[profile.context.spot]} /><InfoRow label="信任層級" value={profile.source.trustTier} /><InfoRow label="模型" value={profile.source.solverName || profile.source.label} /><InfoRow label="雜湊" value={profile.contentHash || 'built-in immutable'} /></dl><div className="mt-4 flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/7 p-3 text-xs leading-relaxed text-amber-200/80"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{profile.source.disclaimer}</div></section>
      </div>
    </div>
  );
}

function loadCustomProfiles(): StrategyProfile[] { try { const value = JSON.parse(localStorage.getItem(CUSTOM_PROFILES_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function frequencyTitle(hand: string, f: ReturnType<typeof normalizeFrequencies>): string { const text = (Object.keys(ACTION_LABELS) as StrategyAction[]).filter(action => f[action] >= 0.01).map(action => `${ACTION_LABELS[action]} ${formatFrequency(f[action])}`).join(' · '); return `${hand}${hand ? ' · ' : ''}${text}`; }
function frequencyBackground(f: ReturnType<typeof normalizeFrequencies>): string { const segments: Array<[number, string]> = [[f.raise, '#10b981'], [f.call, '#06b6d4'], [f.limp, '#3b82f6'], [f.allIn, '#8b5cf6'], [f.fold, '#1e293b']]; let cursor = 0; const stops: string[] = []; segments.forEach(([value, color]) => { if (value <= 0) return; const start = cursor * 100; cursor += value; stops.push(`${color} ${start}%`, `${color} ${cursor * 100}%`); }); return `linear-gradient(90deg, ${stops.join(',')})`; }
function actionClass(action: StrategyAction): string { return action === 'raise' ? 'bg-emerald-500' : action === 'call' ? 'bg-cyan-500' : action === 'limp' ? 'bg-blue-500' : action === 'allIn' ? 'bg-violet-500' : 'bg-slate-600'; }
function FrequencyRow({ label, value, className }: { label: string; value: number; className: string }) { return <div><div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-400">{label}</span><span className="font-mono">{formatFrequency(value)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${className}`} style={{ width: `${value * 100}%` }} /></div></div>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3"><div className="text-[11px] text-slate-500">{label}</div><div className="mt-1 font-mono text-lg font-bold">{value}</div></div>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="break-all text-right font-mono text-slate-300">{value}</dd></div>; }
