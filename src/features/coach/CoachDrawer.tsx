import { useEffect, useMemo, useState } from 'react';
import { Brain, Loader2, Send, Wifi, WifiOff, X } from 'lucide-react';
import { Feedback, Scenario, ScenarioStep } from '../../types';
import { generateOfflineAnalysis, generateOfflineFollowUp } from '../../utils/offlineAnalysis';
import { getApiUrl } from '../../utils/api';

interface CoachDrawerProps {
  open: boolean;
  scenario: Scenario;
  step: ScenarioStep;
  feedback: Feedback;
  selectedAction?: string | null;
  onClose: () => void;
}

export function CoachDrawer({ open, scenario, step, feedback, selectedAction, onClose }: CoachDrawerProps) {
  const [mode, setMode] = useState<'offline' | 'online'>('offline');
  const [analysis, setAnalysis] = useState('');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const context = useMemo(() => ({ ...scenario, selectedAction, feedback }), [scenario, selectedAction, feedback]);

  useEffect(() => {
    if (!open) return;
    setAnalysis(generateOfflineAnalysis(context, step).analysis);
    setError('');
  }, [open, context, step]);

  const ask = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'offline') {
        const response = generateOfflineFollowUp(question, context, step);
        setAnalysis(previous => `${previous}\n\n---\n\n### 追問：${question}\n\n${response}`);
      } else {
        const response = await fetch(getApiUrl('/api/poker/mindset'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario: context, currentStep: step, message: question }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || `HTTP ${response.status}`);
        setAnalysis(previous => `${previous}\n\n---\n\n### 線上教練：${question}\n\n${payload.analysis}`);
      }
      setQuestion('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '教練暫時無法回答。');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}>
      <aside className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><Brain className="h-5 w-5" /></span><div><div className="font-semibold">牌局 AI 教練</div><div className="text-xs text-slate-500">已帶入本題、你的行動與標準解析</div></div></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex gap-2 border-b border-slate-800 p-3 text-xs">
          <button type="button" onClick={() => setMode('offline')} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${mode === 'offline' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-500'}`}><WifiOff className="h-4 w-4" />離線教練</button>
          <button type="button" onClick={() => setMode('online')} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${mode === 'online' ? 'bg-blue-500/15 text-blue-300' : 'text-slate-500'}`}><Wifi className="h-4 w-4" />Gemini API</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5"><div className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{analysis}</div>{error && <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/8 p-3 text-sm text-red-300">{error} GitHub Pages 沒有後端時請切回離線教練。</div>}</div>
        <footer className="border-t border-slate-800 p-4"><div className="flex gap-2"><textarea value={question} onChange={event => setQuestion(event.target.value)} rows={2} placeholder="例如：哪些 turn 會讓答案反轉？" className="min-h-12 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500" /><button type="button" onClick={ask} disabled={loading || !question.trim()} className="grid w-12 place-items-center rounded-xl bg-emerald-500 text-emerald-950 disabled:opacity-40">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</button></div></footer>
      </aside>
    </div>
  );
}
