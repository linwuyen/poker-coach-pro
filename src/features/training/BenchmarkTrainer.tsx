import { useMemo, useState } from 'react';
import { ArrowLeft, EyeOff, ShieldCheck } from 'lucide-react';
import { scenarios } from '../../data';
import { HistoryItem, Scenario } from '../../types';
import { loadPlayerProfile } from '../../domain/playerProfile';
import { getHiddenBenchmarkScenarios } from '../../learning-engine/benchmark';
import { loadHistory, saveHistory } from '../../utils/history';
import { TrainingSession } from './TrainingSession';

export function BenchmarkTrainer({ onExit }: { onExit: () => void }) {
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const profile = useMemo(loadPlayerProfile, []);
  const holdout = useMemo(() => getHiddenBenchmarkScenarios(scenarios, profile), [profile]);
  const unseen = holdout.filter(scenario => !history.some(item => item.trainingType === 'benchmark' && item.scenarioId === scenario.id));
  const pool: Scenario[] = (unseen.length ? unseen : holdout).slice(0, Math.min(12, holdout.length));

  const record = (item: HistoryItem) => {
    const benchmarkItem: HistoryItem = {
      ...item,
      trainingType: 'benchmark',
      isTransferTest: true,
      isUnseen: !history.some(previous => previous.trainingType === 'benchmark' && previous.scenarioId === item.scenarioId && previous.stepId === item.stepId),
      notes: `${item.notes ? `${item.notes}\n` : ''}Hidden holdout benchmark：此 scenario 不會進入 daily / 專項訓練池。`,
    };
    setHistory(previous => {
      const next = [...previous, benchmarkItem];
      saveHistory(next);
      return next;
    });
  };

  if (!pool.length) return <div className="grid min-h-screen place-items-center bg-slate-950 p-6 text-slate-100"><div className="max-w-lg rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center"><EyeOff className="mx-auto h-8 w-8 text-slate-400" /><h1 className="mt-4 text-xl font-semibold">目前沒有 Holdout 題</h1><p className="mt-2 text-sm text-slate-500">題庫太小或分池失敗時，系統不會把 training 題假裝成 hidden benchmark。</p><button type="button" onClick={onExit} className="mt-5 rounded-xl border border-slate-700 px-4 py-2 text-sm">返回</button></div></div>;

  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onExit} className="pc-interactive flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />離開 Benchmark</button>
        <div className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/8 px-3 py-1.5 text-xs text-amber-200"><ShieldCheck className="h-3.5 w-3.5" />Holdout 與一般訓練隔離</div>
      </div>
      <section className="pc-hero-glow mb-6 rounded-3xl border border-amber-500/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.11),rgba(15,23,42,0.72))] p-5 md:p-7">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300"><EyeOff className="h-4 w-4" />Hidden Transfer Benchmark</div>
        <h1 className="mt-3 text-2xl font-bold">測你會不會，不讓你先背題</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">這批 scenario 由穩定 hash 分池，平常 daily、專項訓練與 normal review 都不會看到。完成後才寫入 benchmark history，用來衡量真正泛化，而不是 training accuracy。</p>
      </section>
      <TrainingSession title={unseen.length ? 'Hidden Benchmark · 初見' : 'Hidden Benchmark · 重測'} scenarios={pool} history={history} onRecord={record} onExit={onExit} onComplete={onExit} />
    </div>
  </div>;
}
