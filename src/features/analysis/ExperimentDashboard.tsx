import { useMemo, useState } from 'react';
import { ArrowLeft, FlaskConical, ShieldCheck } from 'lucide-react';
import { createRandomizedBlockExperiment, evaluateLearningExperiment, LearningExperimentMetric, LearningExperimentSpec } from '../../learning-engine/experiment';
import { loadHistory } from '../../utils/history';

const EXPERIMENT_KEY = 'poker_learning_experiment_v1';
const DAY = 86400000;

function loadExperiment(): LearningExperimentSpec | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(EXPERIMENT_KEY) || 'null');
    return parsed && parsed.schemaVersion === 1 ? parsed : null;
  } catch { return null; }
}

export function ExperimentDashboard({ onExit }: { onExit: () => void }) {
  const [metric, setMetric] = useState<LearningExperimentMetric>('holdout-accuracy');
  const [seed, setSeed] = useState('feedback-study-v1');
  const [hypothesis, setHypothesis] = useState('Contrastive feedback improves delayed generalization versus standard feedback.');
  const [blockDays, setBlockDays] = useState(2);
  const [blockCount, setBlockCount] = useState(6);
  const [minSamples, setMinSamples] = useState(8);
  const [standard, setStandard] = useState('Standard progressive-disclosure feedback');
  const [contrastive, setContrastive] = useState('One-variable contrastive feedback');
  const [spec, setSpec] = useState<LearningExperimentSpec | null>(loadExperiment);
  const history = loadHistory();
  const result = useMemo(() => spec ? evaluateLearningExperiment(history, spec) : null, [history, spec]);

  const create = () => {
    try {
      const now = Date.now();
      const next = createRandomizedBlockExperiment({
        id: `learning-n1-${now}`,
        version: '1',
        preRegisteredAt: now,
        startAt: now + 1000,
        blockDurationMs: Math.max(1, blockDays) * DAY,
        blockCount: Math.max(4, blockCount),
        arms: [
          { id: 'standard', label: 'Standard', intervention: standard },
          { id: 'contrastive', label: 'Contrastive', intervention: contrastive },
        ],
        metric,
        assignmentSeed: seed,
        hypothesis,
        washoutMs: Math.min(Math.max(0, blockDays * DAY * 0.1), blockDays * DAY - 1),
        minSamplesPerArm: Math.max(1, minSamples),
      });
      localStorage.setItem(EXPERIMENT_KEY, JSON.stringify(next));
      setSpec(next);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Experiment 建立失敗');
    }
  };

  return <div data-testid="experiment-lab" className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-6xl">
      <button type="button" onClick={onExit} className="pc-interactive flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
      <section className="pc-hero-glow mt-6 rounded-3xl border border-fuchsia-500/20 bg-[linear-gradient(135deg,rgba(217,70,239,0.12),rgba(15,23,42,0.82))] p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300"><FlaskConical className="h-4 w-4" />P10 · Randomized N-of-1</div>
        <h1 className="mt-3 text-3xl font-bold">不是「最近變強了」；先預註冊，再隨機比較教法</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">系統會把 intervention 分配到平衡 randomized time blocks，排除每 block 起始 washout，只評估預先指定的 primary metric。每個 arm 至少兩個有證據 block 且達樣本門檻，才會報 individual experimental winner。</p>
      </section>

      <section className="mt-6 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs text-slate-500">Primary metric<select value={metric} onChange={event => setMetric(event.target.value as LearningExperimentMetric)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm"><option value="holdout-accuracy">Holdout accuracy</option><option value="transfer-accuracy">Transfer accuracy</option><option value="delayed-retention">Delayed retention</option><option value="verified-ev-loss">Verified real-game EV loss</option></select></label>
        <Field label="Assignment seed" value={seed} onChange={setSeed} testId="experiment-seed" />
        <NumberField label="Block days" value={blockDays} onChange={setBlockDays} />
        <NumberField label="Block count" value={blockCount} onChange={setBlockCount} />
        <NumberField label="Min samples / arm" value={minSamples} onChange={setMinSamples} />
        <Field label="Hypothesis" value={hypothesis} onChange={setHypothesis} />
        <Field label="Standard intervention" value={standard} onChange={setStandard} />
        <Field label="Contrastive intervention" value={contrastive} onChange={setContrastive} />
      </section>
      <button data-testid="experiment-create" type="button" onClick={create} className="mt-4 rounded-xl bg-fuchsia-400 px-5 py-2.5 text-sm font-bold text-fuchsia-950">Pre-register randomized block experiment</button>

      {spec && <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
        <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-cyan-300" />Active experiment · {spec.id}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Metric" value={spec.metric} /><Metric label="Blocks" value={String(spec.blocks.length)} /><Metric label="Washout / block" value={`${(spec.washoutMs / 3600000).toFixed(1)}h`} /><Metric label="History rows now" value={String(history.length)} /></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">{spec.blocks.map(block => <div key={block.id} className="rounded-xl border border-slate-800 bg-slate-950/35 p-3 text-xs"><span className="font-mono text-fuchsia-300">{block.armId}</span><br /><span className="text-slate-500">{new Date(block.startAt).toLocaleString()} → {new Date(block.endAt).toLocaleString()}</span></div>)}</div>
      </section>}

      {result && <section className="mt-6 rounded-2xl border border-fuchsia-500/15 bg-fuchsia-500/5 p-5">
        <h2 className="font-semibold">Current preregistered result</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{result.arms.map(arm => <div key={arm.armId} className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="font-semibold">{arm.label}</div><div className="mt-2 font-mono text-sm">n={arm.samples} · evidence blocks={arm.blocksWithEvidence} · mean={arm.mean === null ? 'Unavailable' : arm.mean.toFixed(4)}</div></div>)}</div>
        <div data-testid="experiment-result" className="mt-4 rounded-xl border border-fuchsia-500/20 bg-slate-950/30 p-4 text-sm leading-6 text-fuchsia-100">{result.claim}</div>
      </section>}
    </div>
  </div>;
}

function Field({ label, value, onChange, testId }: { label: string; value: string; onChange: (value: string) => void; testId?: string }) { return <label className="text-xs text-slate-500">{label}<input data-testid={testId} value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm" /></label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="text-xs text-slate-500">{label}<input type="number" min="1" value={value} onChange={event => onChange(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm" /></label>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-[11px] text-slate-500">{label}</div><div className="mt-2 break-all font-mono text-sm font-bold">{value}</div></div>; }
