import { ArrowLeft, Brain, Gauge } from 'lucide-react';
import { buildCalibrationReport } from '../../learning-engine/calibration';
import { classifyHistoryError } from '../../learning-engine/errorModel';
import { loadHistory } from '../../utils/history';

const ERROR_LABELS: Record<string, string> = {
  'knowledge-gap': '不知道',
  'mental-model': '高信心錯誤模型',
  'sizing-boundary': '尺寸邊界',
  'action-boundary': '動作邊界',
  'lucky-guess': '猜中',
  'fragile-knowledge': '脆弱知識',
  none: '穩定',
};

export function CalibrationDashboard({ onExit }: { onExit: () => void }) {
  const history = loadHistory();
  const report = buildCalibrationReport(history);
  const errors = history.map(classifyHistoryError).filter(type => type !== 'none');
  const counts = [...new Set(errors)].map(type => ({ type, count: errors.filter(item => item === type).length })).sort((a, b) => b.count - a.count);
  const label = report.label === 'overconfident' ? '偏過度自信' : report.label === 'underconfident' ? '偏低估自己' : report.label === 'insufficient-data' ? '樣本不足' : '校準良好';

  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8"><div className="mx-auto max-w-5xl">
    <button type="button" onClick={onExit} className="pc-interactive flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
    <section className="pc-hero-glow mt-6 rounded-3xl border border-cyan-500/20 bg-[linear-gradient(135deg,rgba(6,182,212,0.12),rgba(15,23,42,0.78))] p-6 md:p-8"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300"><Gauge className="h-4 w-4" />Decision Calibration</div><h1 className="mt-3 text-3xl font-bold">知道自己什麼時候不可靠，也是一種牌技</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">把信心 1–4 對照實際正確率。高信心錯誤優先視為 mental-model leak；低信心答對則不會被當成穩定 mastery。</p></section>

    <section className="mt-6 grid gap-4 md:grid-cols-4"><Metric label="狀態" value={label} /><Metric label="ECE" value={`${(report.expectedCalibrationError * 100).toFixed(1)}%`} /><Metric label="Overconfidence" value={`${(report.overconfidence * 100).toFixed(1)}%`} /><Metric label="Underconfidence" value={`${(report.underconfidence * 100).toFixed(1)}%`} /></section>

    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6"><div className="flex items-center gap-2 font-semibold"><Brain className="h-4 w-4 text-cyan-300" />信心 → 實際正確率</div><div className="mt-5 space-y-4">{report.bins.map(bin => <div key={bin.confidence}><div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-400">信心 {bin.confidence} · 樣本 {bin.count}</span><span className="font-mono">預期 {(bin.expectedProbability * 100).toFixed(0)}% / 實際 {(bin.observedAccuracy * 100).toFixed(0)}%</span></div><div className="relative h-3 overflow-hidden rounded-full bg-slate-800"><div className="absolute inset-y-0 left-0 bg-cyan-500" style={{ width: `${bin.observedAccuracy * 100}%` }} /><div className="absolute inset-y-0 w-0.5 bg-amber-300" style={{ left: `${bin.expectedProbability * 100}%` }} /></div></div>)}</div></section>

    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6"><h2 className="font-semibold">錯誤模式</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{counts.length ? counts.map(item => <div key={item.type} className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-sm font-semibold">{ERROR_LABELS[item.type] || item.type}</div><div className="mt-2 font-mono text-2xl font-bold">{item.count}</div></div>) : <div className="text-sm text-slate-500">目前還沒有足夠的信心＋結果資料。</div>}</div></section>
  </div></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="pc-card-lift rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-xl font-bold">{value}</div></div>; }
