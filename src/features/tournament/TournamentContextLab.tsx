import { useState } from 'react';
import { ArrowLeft, ShieldCheck, Trophy } from 'lucide-react';
import { parseHandHistoryText } from '../../real-game/handHistory';
import { importTournamentContextEnvelope, joinTournamentContextsToHands, TournamentUtilityEvaluation } from '../../real-game/tournamentContext';
import { loadHistory, saveHistory } from '../../utils/history';

export function TournamentContextLab({ onExit }: { onExit: () => void }) {
  const [handText, setHandText] = useState('');
  const [contextText, setContextText] = useState('');
  const [message, setMessage] = useState('');
  const [evaluations, setEvaluations] = useState<TournamentUtilityEvaluation[]>([]);

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
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300"><Trophy className="h-4 w-4" />P9-D · Tournament truth join</div>
        <h1 className="mt-3 text-3xl font-bold">HH 只提供 handId；ICM / PKO / FGS 狀態必須明確提供</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">把 PokerStars/GGPoker MTT HH 與外部 tournament context envelope 以 handId join。Payout、所有 player stack、showdown equity、bounty、FGS branch probability 都不從一般 HH 猜測。</p>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <label className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 text-xs text-slate-500">MTT Hand History<textarea data-testid="tournament-hh" value={handText} onChange={event => setHandText(event.target.value)} className="mt-3 min-h-80 w-full rounded-xl border border-slate-700 bg-slate-950/60 p-4 font-mono text-xs leading-5 text-slate-200" placeholder="PokerStars Hand #... Tournament #..." /></label>
        <label className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 text-xs text-slate-500">Tournament context envelope JSON<textarea data-testid="tournament-context-json" value={contextText} onChange={event => setContextText(event.target.value)} className="mt-3 min-h-80 w-full rounded-xl border border-slate-700 bg-slate-950/60 p-4 font-mono text-xs leading-5 text-slate-200" placeholder='{"schemaVersion":1,"contexts":[...]}' /></label>
      </section>
      <button data-testid="tournament-evaluate" type="button" disabled={!handText.trim() || !contextText.trim()} onClick={evaluate} className="mt-4 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-amber-950 disabled:opacity-40">Join → Evaluate → Save exact utility evidence</button>
      {message && <div data-testid="tournament-message" className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/6 px-4 py-3 text-sm text-amber-100">{message}</div>}

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
        <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-cyan-300" />Conditional utility evidence</div>
        <p className="mt-2 text-xs leading-6 text-slate-500">結果只代表「在你提供的 tournament state / probabilities 下」的 exact ICM/PKO/FGS 計算。它不代表系統自動求出了未來 Nash game tree。</p>
        <div className="mt-4 space-y-3">{evaluations.map(item => <div key={item.contextId} className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/35 p-4 text-xs sm:grid-cols-6"><div className="sm:col-span-2"><div className="text-slate-500">Context</div><div className="mt-1 font-mono">{item.contextId}</div></div><Metric label="Model" value={item.model.toUpperCase()} /><Metric label="Chosen" value={item.chosenAction} /><Metric label="Best" value={item.bestAction} /><Metric label="Loss" value={`${item.utilityLoss.toFixed(4)} ${item.utilityUnit}`} /></div>)}</div>
      </section>
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><div className="text-slate-500">{label}</div><div className="mt-1 font-mono font-semibold">{value}</div></div>; }
