import { useState } from 'react';
import { Brain, Loader2, Sparkles } from 'lucide-react';
import { parseCards } from '../../utils/cards';
import { generateOfflineAnalysis } from '../../utils/offlineAnalysis';
import { getApiUrl } from '../../utils/api';
import { Scenario, ScenarioStep } from '../../types';

export function HandLab() {
  const [holeCards, setHoleCards] = useState('As Kh');
  const [board, setBoard] = useState('Qs Jh 4c');
  const [position, setPosition] = useState('BTN');
  const [stack, setStack] = useState('40');
  const [pot, setPot] = useState('8');
  const [action, setAction] = useState('CO 開池 2.2BB，BTN 跟注；Flop CO 過牌。Hero 該怎麼做？');
  const [mode, setMode] = useState<'offline' | 'online'>('offline');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    const heroCards = parseCards(holeCards);
    const communityCards = parseCards(board);
    if (heroCards.length !== 2) { setResult('請輸入兩張有效手牌，例如 As Kh。'); return; }
    const street = communityCards.length >= 5 ? 'River' : communityCards.length === 4 ? 'Turn' : communityCards.length === 3 ? 'Flop' : 'Preflop';
    const step: ScenarioStep = {
      id: 'custom-analysis', street, communityCards, description: action, potSize: Number(pot) || 0,
      options: [], feedbacks: {}, assumptions: ['使用者自訂牌局，未提供完整行動線時分析只能作為近似。'], strategySource: 'Custom Hand Lab',
    };
    const scenario: Scenario = {
      id: 'custom-hand', title: '自訂牌局分析', category: ['自訂牌局'], difficulty: '中階', type: 'Tournament',
      blinds: '自訂', ante: false, userStack: `${stack}BB`, userBB: Number(stack) || 40, position, holeCards: heroCards,
      preAction: action, effectiveStack: `${stack}BB`, steps: [step],
    };
    setLoading(true);
    try {
      if (mode === 'offline') setResult(generateOfflineAnalysis(scenario, step).analysis);
      else {
        const response = await fetch(getApiUrl('/api/poker/mindset'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario, currentStep: step }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || `HTTP ${response.status}`);
        setResult(payload.analysis || '沒有分析內容。');
      }
    } catch (reason) {
      setResult(`${reason instanceof Error ? reason.message : '分析失敗'}\n\nGitHub Pages 沒有 AI 後端時請使用離線模式。`);
    } finally { setLoading(false); }
  };

  return <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-violet-400" />自訂牌局實驗室</div><p className="mt-1 text-xs text-slate-500">已從舊版進階工具遷移到正式分析流程。</p></div><div className="flex rounded-lg border border-slate-800 p-1 text-xs"><button type="button" onClick={() => setMode('offline')} className={`rounded-md px-3 py-1.5 ${mode === 'offline' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>離線</button><button type="button" onClick={() => setMode('online')} className={`rounded-md px-3 py-1.5 ${mode === 'online' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Gemini</button></div></div>
    <div className="mt-5 grid gap-3 md:grid-cols-5"><Field label="手牌" value={holeCards} onChange={setHoleCards} placeholder="As Kh" /><Field label="公共牌" value={board} onChange={setBoard} placeholder="Qs Jh 4c" /><Field label="位置" value={position} onChange={setPosition} /><Field label="有效籌碼 BB" value={stack} onChange={setStack} /><Field label="底池 BB" value={pot} onChange={setPot} /></div>
    <label className="mt-3 block text-xs text-slate-500">行動線與問題<textarea value={action} onChange={event => setAction(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500" /></label>
    <button type="button" onClick={analyze} disabled={loading} className="mt-4 flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}開始分析</button>
    {result && <div className="mt-5 max-h-[520px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/45 p-4 text-sm leading-7 text-slate-300">{result}</div>}
  </section>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="text-xs text-slate-500">{label}<input value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500" /></label>;
}
