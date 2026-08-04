import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Database, GitCompareArrows, Layers3 } from 'lucide-react';
import {
  formatFrequency,
  getDecision,
  getPrimaryAction,
  getRangeStats,
  isMixedStrategy,
  normalizeFrequencies,
  STRATEGY_PROFILES_V2,
  STRATEGY_RANKS,
  StrategyAction,
  TableSize,
} from '../../strategy-engine-v2';

const ACTION_LABELS: Record<StrategyAction, string> = {
  raise: '加注', call: '跟注／跛入', fold: '棄牌', allIn: '全下',
};

const POSITION_LABELS: Record<string, string> = {
  utg: 'UTG', utg1: 'UTG+1', utg2: 'UTG+2', mp: 'MP', hj: 'HJ', co: 'CO', btn: 'BTN', sb: 'SB', bb: 'BB',
};

export function StrategyExplorer() {
  const [tableSize, setTableSize] = useState<TableSize>('9max');
  const [format, setFormat] = useState<'cash' | 'tournament'>('tournament');
  const matchingProfiles = useMemo(() => STRATEGY_PROFILES_V2.filter(profile => profile.context.tableSize === tableSize && profile.context.format === format), [tableSize, format]);
  const [position, setPosition] = useState('utg');
  const [selectedHand, setSelectedHand] = useState('AKs');

  useEffect(() => {
    if (!matchingProfiles.some(profile => profile.context.position === position)) setPosition(matchingProfiles[0]?.context.position || 'utg');
  }, [matchingProfiles, position]);

  const profile = matchingProfiles.find(item => item.context.position === position) || matchingProfiles[0] || STRATEGY_PROFILES_V2[0];
  const decision = getDecision(profile, selectedHand);
  const stats = getRangeStats(profile);

  const changeEnvironment = (nextTable: TableSize, nextFormat: 'cash' | 'tournament') => {
    setTableSize(nextTable);
    setFormat(nextFormat);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4 md:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400"><Layers3 className="h-4 w-4" />Strategy Engine v2</div>
            <h2 className="mt-2 text-xl font-semibold">翻前基準範圍</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">支援情境條件、混合頻率與組合加權。每一份策略都帶有版本與來源，不再把固定綠格誤稱為絕對 GTO。</p>
          </div>
          <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-1 text-xs">
            <button type="button" onClick={() => changeEnvironment('6max', 'cash')} className={`rounded-lg px-3 py-2 font-semibold ${tableSize === '6max' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>6-Max Cash</button>
            <button type="button" onClick={() => changeEnvironment('9max', 'tournament')} className={`rounded-lg px-3 py-2 font-semibold ${tableSize === '9max' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>9-Max MTT</button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {matchingProfiles.map(item => (
            <button key={item.id} type="button" onClick={() => setPosition(item.context.position)} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${profile.id === item.id ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-300' : 'border-slate-800 bg-slate-950/60 text-slate-500 hover:text-slate-200'}`}>
              {POSITION_LABELS[item.context.position]}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-13 gap-0.5 rounded-xl border border-slate-800 bg-slate-950 p-1.5 sm:gap-1 sm:p-2">
          {STRATEGY_RANKS.map((rowRank, row) => STRATEGY_RANKS.map((columnRank, column) => {
            const hand = row === column ? `${rowRank}${columnRank}` : row < column ? `${rowRank}${columnRank}s` : `${columnRank}${rowRank}o`;
            const frequencies = normalizeFrequencies(profile.ranges[hand]);
            const primary = getPrimaryAction(frequencies);
            const mixed = isMixedStrategy(frequencies);
            const selected = selectedHand === hand;
            return (
              <button
                key={hand}
                type="button"
                onClick={() => setSelectedHand(hand)}
                title={`${hand} · ${mixed ? '混合策略' : ACTION_LABELS[primary]}`}
                className={`aspect-square min-w-0 rounded-[4px] text-[8px] font-semibold transition sm:text-[10px] ${matrixClass(primary, mixed)} ${selected ? 'z-10 ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-950' : 'hover:scale-110 hover:ring-1 hover:ring-white/40'}`}
              >
                {hand}
              </button>
            );
          }))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
          <Legend className="bg-emerald-500" label="加注" />
          <Legend className="bg-cyan-500" label={position === 'sb' ? '跛入' : '跟注'} />
          <Legend className="bg-violet-500" label="全下" />
          <Legend className="bg-amber-400" label="混合頻率" />
          <Legend className="bg-slate-800" label="棄牌" />
        </div>
      </section>

      <aside className="space-y-5">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Selected hand</div>
              <div className="mt-1 font-mono text-4xl font-black text-white">{decision.hand}</div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${decision.mixed ? 'bg-amber-400/12 text-amber-300' : 'bg-emerald-500/12 text-emerald-300'}`}>{decision.mixed ? '混合策略' : ACTION_LABELS[decision.primaryAction]}</span>
          </div>

          <div className="mt-5 space-y-3">
            <FrequencyRow label="加注" value={decision.frequencies.raise} className="bg-emerald-500" />
            <FrequencyRow label={position === 'sb' ? '跛入' : '跟注'} value={decision.frequencies.call} className="bg-cyan-500" />
            <FrequencyRow label="全下" value={decision.frequencies.allIn} className="bg-violet-500" />
            <FrequencyRow label="棄牌" value={decision.frequencies.fold} className="bg-slate-600" />
          </div>

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/55 p-4 text-sm leading-relaxed text-slate-400">
            {decision.mixed ? '這手牌位於策略邊界，應依指定頻率混合，而不是背成永遠開或永遠棄。' : `此模型在目前節點以${ACTION_LABELS[decision.primaryAction]}為主要策略。`}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold"><GitCompareArrows className="h-4 w-4 text-blue-400" />範圍摘要</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="持續範圍" value={`${stats.continuePercentage.toFixed(1)}%`} />
            <Stat label="主動範圍" value={`${stats.aggressivePercentage.toFixed(1)}%`} />
            <Stat label="有效籌碼" value={`${profile.context.stackDepthBB}BB`} />
            <Stat label="開池尺寸" value={`${profile.context.openSizeBB || '-'}BB`} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 text-sm">
          <div className="flex items-center gap-2 font-semibold"><Database className="h-4 w-4 text-emerald-400" />資料來源</div>
          <dl className="mt-4 space-y-2 text-xs">
            <InfoRow label="Profile" value={profile.id} />
            <InfoRow label="版本" value={profile.version} />
            <InfoRow label="模型" value={profile.source.label} />
            <InfoRow label="類型" value={profile.source.type} />
          </dl>
          <div className="mt-4 flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/7 p-3 text-xs leading-relaxed text-amber-200/80"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{profile.source.disclaimer}</div>
        </section>
      </aside>
    </div>
  );
}

function matrixClass(primary: StrategyAction, mixed: boolean): string {
  if (mixed) return 'bg-amber-400 text-amber-950';
  if (primary === 'raise') return 'bg-emerald-500 text-emerald-950';
  if (primary === 'call') return 'bg-cyan-500 text-cyan-950';
  if (primary === 'allIn') return 'bg-violet-500 text-violet-950';
  return 'bg-slate-900 text-slate-600';
}

function FrequencyRow({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs"><span className="text-slate-400">{label}</span><span className="font-mono font-semibold text-slate-200">{formatFrequency(value)}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${className}`} style={{ width: `${value * 100}%` }} /></div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${className}`} />{label}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3"><div className="text-[11px] text-slate-500">{label}</div><div className="mt-1 font-mono text-lg font-bold text-slate-100">{value}</div></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="break-all text-right font-mono text-slate-300">{value}</dd></div>;
}
