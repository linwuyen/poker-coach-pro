import { useState } from 'react';
import { Brain, Loader2, Sparkles, Target } from 'lucide-react';
import { parseCards } from '../../utils/cards';
import { generateOfflineAnalysis } from '../../utils/offlineAnalysis';
import { getApiUrl } from '../../utils/api';
import { HistoryItem, Scenario, ScenarioStep } from '../../types';
import { createAttemptId, loadHistory, saveHistory } from '../../utils/history';
import { inferSkillIds } from '../../learning-engine/skillGraph';

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
  const [queued, setQueued] = useState(false);

  const buildScenario = () => {
    const heroCards = parseCards(holeCards);
    const communityCards = parseCards(board);
    if (heroCards.length !== 2) return null;
    const street = communityCards.length >= 5 ? 'River' : communityCards.length === 4 ? 'Turn' : communityCards.length === 3 ? 'Flop' : 'Preflop';
    const step: ScenarioStep = {
      id: 'custom-analysis', street, communityCards, description: action, potSize: Number(pot) || 0,
      options: [], feedbacks: {}, assumptions: ['使用者自訂牌局，未提供完整行動線時分析只能作為近似。'], strategySource: 'Custom Hand Lab',
    };
    const scenario: Scenario = {
      id: `real-hand-${Date.now()}`, title: '真實牌局分析', category: ['真實牌局'], difficulty: '中階', type: 'Tournament',
      blinds: '自訂', ante: false, userStack: `${stack}BB`, userBB: Number(stack) || 40, position, holeCards: heroCards,
      preAction: action, effectiveStack: `${stack}BB`, steps: [step],
    };
    return { scenario, step };
  };

  const analyze = async () => {
    const built = buildScenario();
    if (!built) { setResult('請輸入兩張有效手牌，例如 As Kh。'); return; }
    setLoading(true); setQueued(false);
    try {
      if (mode === 'offline') setResult(generateOfflineAnalysis(built.scenario, built.step).analysis);
      else {
        const response = await fetch(getApiUrl('/api/poker/mindset'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: built.scenario, currentStep: built.step }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || `HTTP ${response.status}`);
        setResult(payload.analysis || '沒有分析內容。');
      }
    } catch (reason) {
      setResult(`${reason instanceof Error ? reason.message : '分析失敗'}\n\nGitHub Pages 沒有 AI 後端時請使用離線模式。`);
    } finally { setLoading(false); }
  };

  const markAsLeak = () => {
    const built = buildScenario();
    if (!built || !result) return;
    const history = loadHistory();
    const now = Date.now();
    const categories = ['真實牌局', built.step.street, ...(action.match(/ICM|泡沫|短碼|SPR|賠率|Blocker|詐唬|價值|3-bet|4-bet/gi) || [])];
    const item: HistoryItem = {
      schemaVersion: 4,
      attemptId: createAttemptId(),
      trainingType: 'real-hand',
      scenarioId: built.scenario.id,
      stepId: 'real-hand-leak',
      masteryKey: `${built.scenario.id}::real-hand-leak`,
      skillIds: inferSkillIds(categories, built.step.street),
      transferGroupId: `real-hand-${built.step.street.toLowerCase()}`,
      category: categories,
      score: 3,
      judgment: '真實牌局漏點',
      timestamp: now,
      street: built.step.street,
      position,
      correct: false,
      truthTier: 'heuristic-estimate',
      isUnseen: true,
      nextReviewAt: now + 6 * 60 * 60 * 1000,
      reviewIntervalDays: 0.25,
      questionLabel: `${holeCards} · ${board || 'Preflop'} · ${position}`,
      notes: `${action}\n\n分析摘要：${result.slice(0, 1200)}`,
    };
    saveHistory([...history, item]);
    setQueued(true);
  };

  return <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-violet-400" />自訂牌局實驗室</div><p className="mt-1 text-xs text-slate-500">真實牌局可以標成漏點，Skill Graph 會讓後續每日排程優先挑相同能力的 sibling drills。</p></div><div className="flex rounded-lg border border-slate-800 p-1 text-xs"><button type="button" onClick={() => setMode('offline')} className={`rounded-md px-3 py-1.5 ${mode === 'offline' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>離線</button><button type="button" onClick={() => setMode('online')} className={`rounded-md px-3 py-1.5 ${mode === 'online' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Gemini</button></div></div>
    <div className="mt-5 grid gap-3 md:grid-cols-5"><Field label="手牌" value={holeCards} onChange={setHoleCards} placeholder="As Kh" /><Field label="公共牌" value={board} onChange={setBoard} placeholder="Qs Jh 4c" /><Field label="位置" value={position} onChange={setPosition} /><Field label="有效籌碼 BB" value={stack} onChange={setStack} /><Field label="底池 BB" value={pot} onChange={setPot} /></div>
    <label className="mt-3 block text-xs text-slate-500">行動線與問題<textarea value={action} onChange={event => setAction(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500" /></label>
    <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={analyze} disabled={loading} className="flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}開始分析</button>{result && <button type="button" onClick={markAsLeak} disabled={queued} className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 px-5 py-3 text-sm font-semibold text-amber-200 disabled:opacity-60"><Target className="h-4 w-4" />{queued ? '已加入個人訓練模型' : '這手我打錯：加入訓練'}</button>}</div>
    {queued && <p className="mt-3 text-xs text-amber-300">已寫入 History v4；下次每日規劃會把相關能力提高優先級。</p>}
    {result && <div className="mt-5 max-h-[520px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/45 p-4 text-sm leading-7 text-slate-300">{result}</div>}
  </section>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="text-xs text-slate-500">{label}<input value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500" /></label>;
}
