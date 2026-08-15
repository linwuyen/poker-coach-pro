import { useMemo, useState, useSyncExternalStore } from 'react';
import { Activity, ArrowLeft, Calculator, CheckCircle2, ExternalLink, LockKeyhole, Radio, RefreshCcw, Shield, Sparkles, Target } from 'lucide-react';
import { loadHistory } from '../../utils/history';
import { formatFrequency, StrategyAction } from '../../strategy-engine-v2';
import { companionStateFromManual, ManualCompanionInput } from '../../companion/adapters';
import { analyzeCompanionState } from '../../companion/companionEngine';
import { clearCompanionHandState, getCompanionHandState, publishCompanionHandState, subscribeCompanionHandState } from '../../companion/handStateBus';
import { CompanionHandState, CompanionMode } from '../../companion/types';

const ACTION_LABELS: Record<StrategyAction, string> = { raise: 'Raise', call: 'Call', limp: 'Limp', fold: 'Fold', allIn: 'Jam' };
const TOOL_LINKS = [
  ['Boundary', 'boundary-map'], ['Range', 'range-reading'], ['Equity', 'equity-workbench'], ['ICM / $EV', 'icm-workbench'], ['Contrastive', 'contrastive-trainer'], ['Solver', 'solver-corpus'],
] as const;
const SHOW_DEV_BRIDGE = import.meta.env.DEV;

interface CompanionPanelProps { onExit?: () => void; }

export function CompanionPanel({ onExit }: CompanionPanelProps) {
  const state = useSyncExternalStore(subscribeCompanionHandState, getCompanionHandState, () => null);
  const history = useMemo(() => loadHistory(), []);
  const analysis = useMemo(() => analyzeCompanionState(state, history), [state, history]);
  const [manual, setManual] = useState<ManualCompanionInput>({
    mode: 'replay', gameFormat: 'Cash', tableSize: '6max', street: 'Preflop', heroPosition: 'BB', villainPosition: 'BTN', effectiveStackBB: 40, potBB: 4, amountToCallBB: 1.5, heroHand: 'AQs', spot: 'bb-defense', openSizeBB: 2.5, anteBB: 0, handComplete: false,
  });

  const syncManual = () => publishCompanionHandState(companionStateFromManual(manual));
  const openTool = (hash?: string) => {
    if (!hash || !analysis.policy.canOpenDecisionTools) return;
    const base = window.location.href.split('#')[0];
    window.open(`${base}#${hash}`, 'poker-coach-tool', 'popup=yes,width=1050,height=900,resizable=yes,scrollbars=yes');
  };

  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">{onExit && <button type="button" onClick={onExit} className="rounded-lg border border-slate-800 p-2 text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /></button>}<div><div className="flex items-center gap-2"><Radio className="h-4 w-4 text-emerald-400" /><h1 className="font-semibold">訓練助手</h1></div><p className="mt-0.5 text-[11px] text-slate-500">同步目前 TrainingSession · 作答後展開分析</p></div></div>
        <button type="button" onClick={() => clearCompanionHandState()} className="rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-400 hover:text-white">清除同步</button>
      </div>
    </header>

    <main className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      {!state ? <EmptyCompanion /> : <>
        <StatusStrip state={state} />
        <section className={`rounded-2xl border p-4 ${analysis.policy.level === 'full' ? 'border-emerald-500/25 bg-emerald-500/6' : 'border-amber-500/25 bg-amber-500/7'}`}>
          <div className="flex gap-3">{analysis.policy.level === 'full' ? <Shield className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" /> : <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />}<div><div className="text-sm font-semibold">{analysis.policy.level === 'full' ? '作答完成 · 完整分析已解鎖' : '作答中 · 不提前揭露答案'}</div><p className="mt-1 text-xs leading-5 text-slate-400">{analysis.policy.reason}</p></div></div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ContextMetric label="情境" value={`${state.heroPosition}${state.villainPosition ? ` vs ${state.villainPosition}` : ''}`} detail={`${state.gameFormat} · ${state.tableSize}`} />
          <ContextMetric label="Street / Spot" value={state.street} detail={state.spot || '未指定節點'} />
          <ContextMetric label="Stack / Pot" value={`${state.effectiveStackBB} / ${state.potBB} BB`} detail={analysis.spr === undefined ? 'SPR -' : `SPR ${analysis.spr.toFixed(2)}`} />
          <ContextMetric label="Pot Odds" value={analysis.potOdds === undefined ? '-' : `${(analysis.potOdds * 100).toFixed(1)}%`} detail={state.amountToCallBB === undefined ? '未提供 call amount' : `Call ${state.amountToCallBB}BB`} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <StrategyCard state={state} analysis={analysis} />
          <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-emerald-400" />推薦下一個訓練工具</div>
            {analysis.intervention ? <><div className="mt-4 text-xl font-bold text-white">{analysis.intervention.label}</div><p className="mt-2 text-xs leading-5 text-slate-400">{analysis.intervention.reason}</p>{analysis.intervention.hash && <button type="button" disabled={!analysis.policy.canOpenDecisionTools} onClick={() => openTool(analysis.intervention?.hash)} className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-30">開啟延伸訓練<ExternalLink className="h-3.5 w-3.5" /></button>}</> : <p className="mt-4 text-xs leading-5 text-slate-500">先完成目前決策；作答後系統才會依這一題的漏點推薦下一個分析或訓練工具。</p>}
          </section>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">延伸訓練工具</h2><p className="mt-1 text-xs text-slate-500">工具不是獨立入口；它們服務目前這一題，作答後才依需要打開。</p></div><Target className="h-5 w-5 text-slate-600" /></div>
          <div className="mt-4 flex flex-wrap gap-2">{TOOL_LINKS.map(([label, hash]) => <button key={hash} type="button" disabled={!analysis.policy.canOpenDecisionTools} onClick={() => openTool(hash)} className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-emerald-500/30 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-25">{label}</button>)}</div>
        </section>
      </>}

      {SHOW_DEV_BRIDGE && <ManualBridge value={manual} onChange={setManual} onSync={syncManual} current={state} />}
    </main>
  </div>;
}

function StatusStrip({ state }: { state: CompanionHandState }) {
  const ageSeconds = Math.max(0, Math.round((Date.now() - state.updatedAt) / 1000));
  return <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/55 px-4 py-3 text-xs"><span className="flex items-center gap-1.5 font-semibold text-emerald-300"><Activity className="h-3.5 w-3.5" />SYNC</span><span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">{state.source}</span><span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">{modeLabel(state.mode)}</span><span className="text-slate-600">{state.handId}</span><span className="ml-auto text-slate-500">更新 {ageSeconds}s 前</span></section>;
}

function StrategyCard({ state, analysis }: { state: CompanionHandState; analysis: ReturnType<typeof analyzeCompanionState> }) {
  if (!analysis.policy.canShowStrategy) return <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="flex items-center gap-2 text-sm font-semibold"><LockKeyhole className="h-4 w-4 text-amber-300" />先作答，再看策略</div><p className="mt-3 text-xs leading-5 text-slate-500">目前只保留情境與思考方向，不顯示 Fold / Call / Raise / Jam 頻率與 EV，避免把訓練變成抄答案。</p></section>;
  if (state.street !== 'Preflop') return <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="flex items-center gap-2 text-sm font-semibold"><Calculator className="h-4 w-4 text-blue-300" />翻後訓練分析</div><p className="mt-3 text-xs leading-5 text-slate-500">Preflop Strategy Engine 不冒充翻後 solver。這裡先用 SPR / Pot Odds 與推薦 intervention，完整翻後策略交給 Solver / Boundary 延伸訓練。</p></section>;
  if (!analysis.strategy) return <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="text-sm font-semibold">策略查詢</div><p className="mt-3 text-xs text-slate-500">需要 hero hand、position 與 strategy spot 才能查詢。</p></section>;
  if (analysis.strategy.status === 'unsupported') return <section className="rounded-2xl border border-amber-500/20 bg-amber-500/6 p-5"><div className="text-sm font-semibold text-amber-200">沒有可信的相符策略節點</div><p className="mt-3 text-xs leading-5 text-amber-100/60">{analysis.strategy.warnings.join(' ')}</p></section>;
  const decision = analysis.strategy.decision;
  return <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-xs text-slate-500">Strategy · {analysis.strategy.status}</div><div className="mt-1 font-mono text-3xl font-black">{decision.hand}</div></div>{analysis.strategy.status === 'exact' ? <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300"><CheckCircle2 className="h-3 w-3" />Exact</span> : <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">Approximate</span>}</div><div className="mt-5 space-y-2">{(['raise', 'call', 'allIn', 'limp', 'fold'] as StrategyAction[]).filter(action => decision.frequencies[action] >= 0.01).map(action => <div key={action} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/35 px-3 py-2 text-xs"><span className="text-slate-400">{ACTION_LABELS[action]}</span><span className="font-mono font-bold text-white">{formatFrequency(decision.frequencies[action])}</span></div>)}</div><p className="mt-4 text-[11px] leading-5 text-slate-600">{decision.profile.name} · {decision.profile.source.trustTier}</p></section>;
}

function ManualBridge({ value, onChange, onSync, current }: { value: ManualCompanionInput; onChange: (next: ManualCompanionInput) => void; onSync: () => void; current: CompanionHandState | null }) {
  const patch = <K extends keyof ManualCompanionInput>(key: K, next: ManualCompanionInput[K]) => onChange({ ...value, [key]: next });
  return <details className="rounded-2xl border border-slate-800 bg-slate-900/45"><summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold">DEV · HandState Adapter Simulator <span className="ml-2 text-xs font-normal text-slate-500">僅開發環境，用來測試底層 adapter / safety gate</span></summary><div className="border-t border-slate-800 p-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <Select label="模式" value={value.mode} options={['training','play-money','replay','completed-real-hand','live-real-money']} onChange={next => patch('mode', next as CompanionMode)} />
    <Select label="賽制" value={value.gameFormat} options={['Cash','MTT']} onChange={next => patch('gameFormat', next as 'Cash' | 'MTT')} />
    <Select label="Street" value={value.street} options={['Preflop','Flop','Turn','River']} onChange={next => patch('street', next as ManualCompanionInput['street'])} />
    <Select label="Spot" value={value.spot || ''} options={['rfi','vs-open','bb-defense','3bet','4bet','push-fold']} onChange={next => patch('spot', next as ManualCompanionInput['spot'])} />
    <Input label="Hero position" value={value.heroPosition} onChange={next => patch('heroPosition', next)} />
    <Input label="Villain position" value={value.villainPosition || ''} onChange={next => patch('villainPosition', next)} />
    <NumberInput label="Effective BB" value={value.effectiveStackBB} onChange={next => patch('effectiveStackBB', next)} />
    <NumberInput label="Pot BB" value={value.potBB} onChange={next => patch('potBB', next)} />
    <NumberInput label="Call BB" value={value.amountToCallBB || 0} onChange={next => patch('amountToCallBB', next)} />
    <Input label="Hero hand" value={value.heroHand || ''} onChange={next => patch('heroHand', next)} />
    <NumberInput label="Open size BB" value={value.openSizeBB || 0} onChange={next => patch('openSizeBB', next || undefined)} />
    <label className="rounded-xl border border-slate-800 bg-slate-950/35 p-3 text-xs"><span className="text-slate-500">Hand complete</span><input type="checkbox" checked={Boolean(value.handComplete)} onChange={event => patch('handComplete', event.target.checked)} className="ml-3 align-middle" /></label>
  </div><div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={onSync} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-emerald-950"><RefreshCcw className="h-3.5 w-3.5" />同步到 HandStateBus</button>{current?.mode === 'live-real-money' && !current.handComplete && <button type="button" onClick={() => publishCompanionHandState({ ...current, handComplete: true })} className="rounded-xl border border-amber-500/30 px-4 py-2.5 text-xs font-semibold text-amber-200">標記 Hand Complete</button>}</div></div></details>;
}

function EmptyCompanion() { return <section className="rounded-2xl border border-dashed border-slate-800 px-6 py-10 text-center"><Radio className="mx-auto h-8 w-8 text-slate-600" /><h2 className="mt-4 font-semibold">等待目前訓練題</h2><p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-slate-500">回到主畫面開始「今日訓練」或任一專項。進入題目後會自動同步；作答前只保留 retrieval，作答後才解鎖策略、EV 與延伸工具。</p></section>; }
function ContextMetric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4"><div className="text-[11px] text-slate-500">{label}</div><div className="mt-1 font-mono text-lg font-bold">{value}</div><div className="mt-1 text-[11px] text-slate-600">{detail}</div></div>; }
function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) { return <label className="text-xs"><span className="mb-1 block text-slate-500">{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200">{options.map(option => <option key={option}>{option}</option>)}</select></label>; }
function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-xs"><span className="mb-1 block text-slate-500">{label}</span><input value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200" /></label>; }
function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="text-xs"><span className="mb-1 block text-slate-500">{label}</span><input type="number" step="0.1" min="0" value={value} onChange={event => onChange(Number(event.target.value) || 0)} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-slate-200" /></label>; }
function modeLabel(mode: CompanionMode): string { return mode === 'live-real-money' ? 'Real-money live' : mode === 'completed-real-hand' ? 'Completed real hand' : mode === 'play-money' ? 'Play-money' : mode === 'training' ? 'Training' : 'Replay'; }