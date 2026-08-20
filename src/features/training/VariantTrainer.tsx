import { useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw, Shuffle, ShieldCheck } from 'lucide-react';
import { coreScenarios } from '../../teaching/scenarioCatalog';
import { buildGeneratedVariantPool, sampleVariantSession } from '../../learning-engine/variantGenerator';
import { HistoryItem } from '../../types';
import { loadHistory, saveHistory } from '../../utils/history';
import { TrainingSessionV12 } from './TrainingSessionV12';

export function VariantTrainer({ onExit }: { onExit: () => void }) {
  const pool = useMemo(() => buildGeneratedVariantPool(coreScenarios, 6), []);
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [session, setSession] = useState(() => sampleVariantSession(pool, 24));
  const [running, setRunning] = useState(false);

  const record = (item: HistoryItem) => {
    setHistory(previous => {
      const updated = [...previous, item];
      saveHistory(updated);
      return updated;
    });
  };

  const newSession = () => {
    setSession(sampleVariantSession(pool, 24));
    setRunning(true);
  };

  if (running) {
    return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
      <TrainingSessionV12
        title="泛化變式 · 24 題"
        scenarios={session}
        history={history}
        onRecord={record}
        onExit={() => setRunning(false)}
        onComplete={() => setRunning(false)}
      />
    </div>;
  }

  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8"><div className="mx-auto max-w-5xl">
    <button type="button" onClick={onExit} className="flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
    <section className="mt-6 rounded-3xl border border-violet-500/20 bg-[linear-gradient(135deg,rgba(139,92,246,0.14),rgba(15,23,42,0.78))] p-6 md:p-8">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300"><Shuffle className="h-4 w-4" />Transfer Variant Lab</div>
      <h1 className="mt-3 text-3xl font-bold">不是背牌面：換一套花色，再做一次</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">目前由 88 個核心情境各產生 6 個策略等價變式，共 <strong className="text-violet-200">{pool.length}</strong> 個 transfer nodes。只做全域花色同構，不擅自改 stack、位置、下注尺寸或 range，因此不會為了「變題」而改壞 ground truth。</p>
      <div className="mt-5 flex flex-wrap gap-3"><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/7 px-4 py-3 text-sm text-emerald-200"><ShieldCheck className="mr-2 inline h-4 w-4" />策略真值保持不變</div><div className="rounded-xl border border-slate-700 bg-slate-950/35 px-4 py-3 text-sm text-slate-300">每輪隨機 24 題 · 同來源不連發</div></div>
      <button type="button" onClick={newSession} className="mt-6 flex items-center gap-2 rounded-xl bg-violet-400 px-6 py-3.5 text-sm font-bold text-violet-950"><RefreshCw className="h-4 w-4" />隨機產生新一輪</button>
    </section>
  </div></div>;
}
