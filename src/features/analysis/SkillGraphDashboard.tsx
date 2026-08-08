import { ArrowLeft, CalendarRange, Crosshair, Network, TrendingDown } from 'lucide-react';
import { loadHistory } from '../../utils/history';
import { calculateSkillMastery, SKILL_GRAPH, topEvLeaks } from '../../learning-engine/skillGraph';
import { calculateSituationLeaks } from '../../learning-engine/situationGraph';
import { buildTrainingPrescription } from '../../learning-engine/prescription';

export function SkillGraphDashboard({ onExit }: { onExit: () => void }) {
  const history = loadHistory();
  const mastery = calculateSkillMastery(history);
  const leaks = topEvLeaks(history, 6);
  const situations = calculateSituationLeaks(history).filter(item => item.attempts >= 2).slice(0, 8);
  const prescription = buildTrainingPrescription(history);
  const masteryById = new Map(mastery.map(item => [item.skillId, item]));
  const parents = ['preflop', 'range', 'math', 'postflop', 'tournament', 'decision'];

  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-6xl">
      <button type="button" onClick={onExit} className="pc-interactive flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
      <section className="pc-hero-glow mt-6 rounded-3xl border border-amber-500/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(15,23,42,0.75))] p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300"><Network className="h-4 w-4" />Poker Skill + Situation Graph</div>
        <h1 className="mt-3 text-3xl font-bold">不是「River 很差」，而是找出哪一種 River 在燒 BB</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Skill Graph 追能力；Situation Graph 追位置、籌碼、Pot type、Street 與下注尺寸。兩者交叉才能區分「不會 Pot Odds」和「只在 River overbet 高估 bluff frequency」。</p>
      </section>

      <section className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/6 p-5 md:p-6">
        <div className="flex items-center gap-2"><CalendarRange className="h-5 w-5 text-emerald-300" /><h2 className="font-semibold">7 天訓練處方</h2></div>
        <p className="mt-2 text-sm leading-7 text-slate-300">{prescription.rationale}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{prescription.days.map(day => <div key={day.day} className="pc-card-lift rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-xs text-slate-500">Day {day.day} · {day.purpose}</div><div className="mt-1 font-semibold">{day.focus}</div><div className="mt-3 font-mono text-xl font-bold text-emerald-200">{day.questions} 題</div></div>)}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><NorthStar label="近 30 天預估漏損" value={`${prescription.northStar.recentExpectedLossPer100.toFixed(3)} BB/100`} /><NorthStar label="前 30 天" value={`${prescription.northStar.priorExpectedLossPer100.toFixed(3)} BB/100`} /><NorthStar label="EV Leak 改善" value={`${prescription.northStar.improvementPercent > 0 ? '+' : ''}${prescription.northStar.improvementPercent.toFixed(1)}%`} /><NorthStar label="Hidden Benchmark" value={`${prescription.northStar.benchmarkAccuracy.toFixed(1)}%`} /></div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6">
        <div className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-red-300" /><h2 className="font-semibold">最高 EV Skill Leak</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{leaks.length ? leaks.map((item, index) => <div key={item.skillId} className="pc-card-lift rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-xs text-slate-500">#{index + 1}</div><div className="mt-1 font-semibold">{item.label}</div><div className="mt-3 flex items-end justify-between"><div><div className="font-mono text-2xl font-bold text-red-300">{item.averageEvLossBB.toFixed(3)}BB</div><div className="text-xs text-slate-500">平均 EV regret</div></div><div className="text-right text-xs text-slate-500"><div>Mastery {item.score}%</div><div>{item.attempts} samples</div></div></div></div>) : <div className="text-sm text-slate-500">還沒有足夠 EV 標記資料。完成決策邊界或具 EV evidence 的題目後會開始排序。</div>}</div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6">
        <div className="flex items-center gap-2"><Crosshair className="h-5 w-5 text-cyan-300" /><h2 className="font-semibold">Situation Leak</h2></div>
        <p className="mt-1 text-xs text-slate-500">總 EV loss 用來找「哪類局面」最值得先修，不再只用大類正確率。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{situations.length ? situations.map(item => <div key={item.situationId} className="pc-card-lift rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-xs uppercase tracking-wider text-slate-600">{item.situationId.split('.')[1]}</div><div className="mt-1 font-semibold capitalize">{item.label}</div><div className="mt-3 font-mono text-xl font-bold text-cyan-200">{item.totalEvLossBB.toFixed(2)}BB</div><div className="mt-1 text-xs text-slate-500">{item.attempts} samples · score {item.score}%</div></div>) : <div className="text-sm text-slate-500">Situation sample 尚不足；新 v4 訓練會逐步寫入尺寸與節點 metadata。</div>}</div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">{parents.map(parent => {
        const nodes = SKILL_GRAPH.filter(node => node.parent === parent);
        return <div key={parent} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><h2 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-300">{parent}</h2><div className="mt-4 space-y-3">{nodes.map(node => {
          const item = masteryById.get(node.id);
          const score = item?.score || 0;
          return <div key={node.id}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="text-slate-300">{node.label}</span><span className="font-mono text-slate-500">{score}% · {item?.status || 'new'} · T{item?.transferAttempts || 0}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full transition-[width] duration-700 ${score >= 82 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${Math.max(2, score)}%` }} /></div></div>;
        })}</div></div>;
      })}</section>
    </div>
  </div>;
}

function NorthStar({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-emerald-500/15 bg-slate-950/35 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-lg font-bold text-emerald-200">{value}</div></div>; }
