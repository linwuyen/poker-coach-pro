import { useMemo, useState } from 'react';
import { ArrowLeft, Database, ShieldCheck, Trophy } from 'lucide-react';
import {
  buildPostflopCoverageReport,
  importPostflopTruthPack,
  loadPostflopTruthNodes,
  mergeImmutablePostflopNodes,
  savePostflopTruthNodes,
} from '../../strategy-engine-v3';
import { importTournamentMetadataEnvelope } from '../../real-game/tournamentReconstruction';
import { loadObservedPopulationCohorts, loadTournamentMetadata, saveTournamentMetadata } from '../../real-game/p12Storage';

export function PostflopTruthLab({ onExit }: { onExit: () => void }) {
  const [nodes, setNodes] = useState(() => loadPostflopTruthNodes());
  const [solverJson, setSolverJson] = useState('');
  const [tournamentJson, setTournamentJson] = useState('');
  const [message, setMessage] = useState('');
  const [tournamentCount, setTournamentCount] = useState(() => loadTournamentMetadata().length);
  const cohorts = loadObservedPopulationCohorts();
  const coverage = useMemo(() => buildPostflopCoverageReport(nodes), [nodes]);

  const importSolver = () => {
    try {
      const imported = importPostflopTruthPack(solverJson, nodes);
      const merged = mergeImmutablePostflopNodes(nodes, imported.nodes);
      savePostflopTruthNodes(merged);
      setNodes(merged);
      setMessage(`Postflop truth：新增 ${imported.nodes.length} nodes，略過 ${imported.skipped.length} 個既有 immutable versions。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Solver pack 匯入失敗'); }
  };

  const importTournament = () => {
    try {
      const imported = importTournamentMetadataEnvelope(tournamentJson);
      const byId = new Map(loadTournamentMetadata().map(item => [item.tournamentId, item]));
      imported.forEach(item => byId.set(item.tournamentId, item));
      const merged = [...byId.values()];
      saveTournamentMetadata(merged);
      setTournamentCount(merged.length);
      setMessage(`Tournament metadata：已保存 ${merged.length} 個 tournaments。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Tournament metadata 匯入失敗'); }
  };

  return <div data-testid="postflop-truth-lab" className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-7xl">
      <button type="button" onClick={onExit} className="flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回</button>
      <section className="mt-6 rounded-3xl border border-cyan-500/20 bg-cyan-500/6 p-6 md:p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">P12 · Postflop closed loop</div>
        <h1 className="mt-3 text-3xl font-bold">Flop / Turn / River Truth Ops</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">v3 只做 exact heads-up postflop truth：board、pot、SPR、to-call、preflop line、當街 action line、位置、rake 與 exact hole cards 都要吻合。沒有唯一 verified node 就保持 Unknown。</p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <Metric label="Verified v3 nodes" value={coverage.nodes} />
        <Metric label="Contexts / EV combos" value={`${coverage.contexts} / ${coverage.comboEvRows}`} />
        <Metric label="Flop / Turn / River" value={`${coverage.streets.Flop} / ${coverage.streets.Turn} / ${coverage.streets.River}`} />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel icon={<Database className="h-5 w-5" />} title="P12-A/B · Strategy Truth Pack v3">
          <p className="text-xs leading-6 text-slate-400">匯入 immutable solver nodes。這是 full-truth ingestion 能力，不會把 PokerBench label 或缺 EV 的資料偽裝成完整 solver surface。</p>
          <textarea data-testid="p12-solver-json" value={solverJson} onChange={event => setSolverJson(event.target.value)} className="mt-3 min-h-56 w-full rounded-xl border border-slate-700 bg-slate-950/60 p-3 font-mono text-xs" placeholder='{"schemaVersion":3,"packId":"...","nodes":[...]}' />
          <button data-testid="p12-import-solver" type="button" onClick={importSolver} disabled={!solverJson.trim()} className="mt-3 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-cyan-950 disabled:opacity-40">匯入 v3 truth pack</button>
        </Panel>

        <Panel icon={<Trophy className="h-5 w-5" />} title="P12-E · Tournament metadata registry">
          <p className="text-xs leading-6 text-slate-400">一次匯入 tournament payout + full-field stack snapshots，後續 HH 以 tournamentId/handId 自動 join。普通 table HH 不會被當成整個 field。</p>
          <textarea data-testid="p12-tournament-json" value={tournamentJson} onChange={event => setTournamentJson(event.target.value)} className="mt-3 min-h-56 w-full rounded-xl border border-slate-700 bg-slate-950/60 p-3 font-mono text-xs" placeholder='{"schemaVersion":1,"tournaments":[...]}' />
          <button type="button" onClick={importTournament} disabled={!tournamentJson.trim()} className="mt-3 rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-amber-950 disabled:opacity-40">保存 tournament metadata</button>
          <div className="mt-3 text-xs text-slate-500">已保存：{tournamentCount} tournaments</div>
        </Panel>
      </section>

      <section className="mt-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-5">
        <div className="flex items-center gap-2 font-semibold text-emerald-200"><ShieldCheck className="h-5 w-5" />P12-D · Measured local population</div>
        <p className="mt-2 text-xs leading-6 text-slate-400">HH importer 會從真實匯入手牌聚合 postflop numerator/denominator。這些 cohort 是 measured-local-cohort，不會自動升級成 population-exploit，也不會從觀測率直接捏造 exploit 建議。</p>
        <div className="mt-3 text-sm">已保存 cohort：<b>{cohorts.length}</b>{cohorts[0] ? ` · 最近 ${cohorts[cohorts.length - 1].sampleHands} hands / ${cohorts[cohorts.length - 1].decisionOpportunities} decisions` : ''}</div>
      </section>

      {message && <div data-testid="p12-message" className="mt-5 rounded-xl border border-cyan-500/15 bg-cyan-500/6 px-4 py-3 text-sm text-cyan-100">{message}</div>}
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-xl font-bold">{value}</div></div>;
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="flex items-center gap-2 font-semibold">{icon}{title}</div><div className="mt-3">{children}</div></div>;
}
