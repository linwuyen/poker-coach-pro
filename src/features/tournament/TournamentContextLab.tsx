import { useState } from 'react';
import { ArrowLeft, ShieldCheck, Trophy } from 'lucide-react';
import { parseHandHistoryText } from '../../real-game/handHistory';
import { loadTournamentMetadata } from '../../real-game/p12Storage';
import { reconstructTournamentContextDrafts, TournamentContextDraft } from '../../real-game/tournamentReconstruction';
import { importTournamentContextEnvelope, joinTournamentContextsToHands, TournamentUtilityEvaluation } from '../../real-game/tournamentContext';
import { loadHistory, saveHistory } from '../../utils/history';

export function TournamentContextLab({ onExit }: { onExit: () => void }) {
  const [handText, setHandText] = useState('');
  const [contextText, setContextText] = useState('');
  const [message, setMessage] = useState('');
  const [evaluations, setEvaluations] = useState<TournamentUtilityEvaluation[]>([]);
  const [drafts, setDrafts] = useState<TournamentContextDraft[]>([]);

  const reconstruct = () => {
    try {
      const hands = parseHandHistoryText(handText);
      const next = reconstructTournamentContextDrafts(hands, loadTournamentMetadata());
      setDrafts(next);
      const complete = next.filter(item => item.completeFieldState).length;
      setMessage(`P12 reconstruction：${complete}/${next.length} 個 MTT hands 已由 HH + saved tournament metadata 補齊 full-field/payout state。`);
    } catch (error) {
      setDrafts([]);
      setMessage(error instanceof Error ? error.message : 'Tournament reconstruction 失敗');
    }
  };

  const evaluate = () => {
    try {
      const hands = parseHandHistoryText(handText);
      const contexts = importTournamentContextEnvelope(contextText);
      const joined = joinTournamentContextsToHands(hands, contexts);
      if (joined.history.length) saveHistory([...loadHistory(), ...joined.history]);
      setEvaluations(joined.evaluations);
      setMessage(`解析 ${hands.length} MTT/other hands · 評估 ${joined.evaluations.length} explicit tournament contexts${joined.unmatchedContextIds.length ? ` · ${joined.unmatchedContextIds.length} 個 context 找不到對應 MTT handId` : ''}。`);
    } catch (error) {
      setEvaluations([]);
      setMessage(error instanceof Error ? error.message : 'Tournament context 評估失敗');
    }
  };

  return <div data-testid="tournament-context-lab" className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-6xl">
      <button type="button" onClick={onExit} className="pc-interactive flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
      <section className="pc-hero-glow mt-6 rounded-3xl border border-amber-500/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(15,23,42,0.82))] p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300"><Trophy className="h-4 w-4" />P12-E · Tournament reconstruction + truth join</div>
        <h1 className="mt-3 text-3xl font-bold">HH 自動抽可證明狀態；full field / payout 由 registry 補齊</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">先用 HH 的 tournamentId + handId 去接 `#postflop-truth` 保存的 tournament metadata。能補的 full-field stacks / payouts 自動補，缺的明確列出；之後 ICM/PKO/FGS decision-specific inputs 仍用 explicit context envelope，不猜 showdown equity、bounty 或 future probability。</p>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <label className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 text-xs text-slate-500">MTT Hand History<textarea data-testid="tournament-hh" value={handText} onChange={event => setHandText(event.target.value)} className="mt-3 min-h-80 w-full rounded-xl border border-slate-700 bg-slate-950/60 p-4 font-mono text-xs leading-5 text-slate-200" placeholder="PokerStars Hand #... Tournament #..." /></label>
        <label className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 text-xs text-slate-500">Decision-specific tournament context envelope JSON<textarea data-testid="tournament-context-json" value={contextText} onChange={event => setContextText(event.target.value)} className="mt-3 min-h-80 w-full rounded-xl border border-slate-700 bg-slate-950/60 p-4 font-mono text-xs leading-5 text-slate-200" placeholder='{"schemaVersion":1,"contexts":[...]}' /></label>
      </section>
      <div className="mt-4 flex flex-wrap gap-2">
        <button data-testid="tournament-reconstruct" type="button" disabled={!handText.trim()} onClick={reconstruct} className="rounded-xl border border-cyan-500/30 px-5 py-2.5 text-sm font-bold text-cyan-200 disabled:opacity-40">HH + saved metadata → Reconstruct</button>
        <button data-testid="tournament-evaluate" type="button" disabled={!handText.trim() || !contextText.trim()} onClick={evaluate} className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-amber-950 disabled:opacity-40">Join → Evaluate → Save exact utility evidence</button>
      </div>
      {message && <div data-testid="tournament-message" className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/6 px-4 py-3 text-sm text-amber-100">{message}</div>}

      {drafts.length > 0 && <section className="mt-6 rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-5">
        <h2 className="font-semibold text-cyan-100">Reconstruction drafts</h2>
        <div className="mt-3 space-y-2">{drafts.map(item => <div key={item.handId} className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-xs sm:grid-cols-5"><Metric label="Hand" value={item.handId} /><Metric label="Tournament" value={item.tournamentId || '-'} /><Metric label="Field" value={item.playersRemaining ? String(item.playersRemaining) : '-'} /><Metric label="Status" value={item.completeFieldState ? 'complete state' : 'incomplete'} /><Metric label="Missing" value={item.missing.join(', ') || '-'} /></div>)}</div>
      </section>}

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
        <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-cyan-300" />Conditional utility evidence</div>
        <p className="mt-2 text-xs leading-6 text-slate-500">Reconstruction 只補 metadata registry 真正提供的 state。最終 utility 結果只代表「在提供的 tournament state / probabilities 下」的 exact ICM/PKO/FGS 計算，不代表系統自動求出 Nash future tree。</p>
        <div className="mt-4 space-y-3">{evaluations.map(item => <div key={item.contextId} className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/35 p-4 text-xs sm:grid-cols-6"><div className="sm:col-span-2"><div className="text-slate-500">Context</div><div className="mt-1 font-mono">{item.contextId}</div></div><Metric label="Model" value={item.model.toUpperCase()} /><Metric label="Chosen" value={item.chosenAction} /><Metric label="Best" value={item.bestAction} /><Metric label="Loss" value={`${item.utilityLoss.toFixed(4)} ${item.utilityUnit}`} /></div>)}</div>
      </section>
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><div className="text-slate-500">{label}</div><div className="mt-1 break-words font-mono font-semibold">{value}</div></div>; }
