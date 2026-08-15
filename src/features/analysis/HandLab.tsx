import { ChangeEvent, useRef, useState } from 'react';
import { Brain, Download, Loader2, Sparkles, Target, Upload } from 'lucide-react';
import { parseCards } from '../../utils/cards';
import { generateOfflineAnalysis } from '../../utils/offlineAnalysis';
import { getApiUrl } from '../../utils/api';
import { HistoryItem, Scenario, ScenarioStep } from '../../types';
import { createAttemptId, loadHistory, saveHistory } from '../../utils/history';
import { inferSkillIds } from '../../learning-engine/skillGraph';
import { inferSituationIdsFromScenario, scenarioContextFamilyId } from '../../learning-engine/contextIdentity';
import { importPostSessionJson, postSessionTemplate } from '../../real-game/sessionImport';

export function HandLab({ onRecord }: { onRecord?: (item: HistoryItem) => void }) {
  const [format, setFormat] = useState<Scenario['type']>('Tournament');
  const [holeCards, setHoleCards] = useState('As Kh');
  const [board, setBoard] = useState('Qs Jh 4c');
  const [position, setPosition] = useState('BTN');
  const [stack, setStack] = useState('40');
  const [pot, setPot] = useState('8');
  const [sessionId, setSessionId] = useState(`session-${new Date().toISOString().slice(0, 10)}`);
  const [sessionHands, setSessionHands] = useState('100');
  const [spotCount, setSpotCount] = useState('1');
  const [utilityLoss, setUtilityLoss] = useState('');
  const [action, setAction] = useState('CO 開池 2.2BB，BTN 跟注；Flop CO 過牌。Hero 該怎麼做？');
  const [mode, setMode] = useState<'offline' | 'online'>('offline');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [queued, setQueued] = useState(false);
  const [importNotice, setImportNotice] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

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
      id: `real-hand-${Date.now()}`, title: '真實牌局分析', category: ['真實牌局'], difficulty: '中階', type: format,
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
    const now = Date.now();
    const formatLabel = format === 'Tournament' ? 'MTT' : 'Cash';
    const categories = ['真實牌局', formatLabel, built.step.street, ...(action.match(/ICM|泡沫|短碼|SPR|賠率|Blocker|詐唬|價值|3-bet|4-bet/gi) || [])];
    const hands = Number(sessionHands);
    const count = Number(spotCount);
    const observedFrequency = Number.isFinite(hands) && hands > 0 && Number.isFinite(count) && count > 0 ? count / hands * 100 : undefined;
    const familyId = scenarioContextFamilyId(built.scenario);
    const typedUtility = Number(utilityLoss);
    const hasUtility = Number.isFinite(typedUtility) && typedUtility > 0;
    const item: HistoryItem = {
      schemaVersion: 5,
      attemptId: createAttemptId(),
      trainingType: 'real-hand',
      scenarioId: built.scenario.id,
      stepId: 'real-hand-leak',
      masteryKey: `real:${familyId}`,
      skillIds: inferSkillIds(categories, built.step.street),
      situationIds: inferSituationIdsFromScenario(built.scenario),
      transferGroupId: `real-hand-${formatLabel.toLowerCase()}-${built.step.street.toLowerCase()}`,
      category: categories,
      score: 3,
      judgment: '真實牌局漏點',
      timestamp: now,
      street: built.step.street,
      position,
      correct: false,
      truthTier: 'heuristic-estimate',
      spotFrequencyPer100Hands: observedFrequency,
      isUnseen: true,
      nextReviewAt: now + 6 * 60 * 60 * 1000,
      reviewIntervalDays: 0.25,
      questionLabel: `${formatLabel} · ${holeCards} · ${board || 'Preflop'} · ${position}`,
      notes: `${action}\n\n分析摘要：${result.slice(0, 1200)}${observedFrequency !== undefined ? `\n\n實戰觀測：${count}/${hands} hands = ${observedFrequency.toFixed(2)} spots/100 hands。` : ''}`,
      gameFormat: formatLabel,
      sessionId: sessionId.trim() || undefined,
      handsObserved: observedFrequency !== undefined ? hands : undefined,
      spotExposureCount: observedFrequency !== undefined ? count : undefined,
      contextFamilyId: familyId,
      evidenceFamilyId: `${formatLabel}:${familyId}`,
      utilityLoss: hasUtility ? typedUtility : undefined,
      utilityUnit: hasUtility ? (formatLabel === 'Cash' ? 'bb' : 'dollar-ev') : undefined,
      utilityModel: hasUtility ? (formatLabel === 'Cash' ? 'cash-chip-ev' : 'icm') : undefined,
    };
    if (onRecord) onRecord(item);
    else {
      const history = loadHistory();
      saveHistory([...history, item]);
    }
    setQueued(true);
  };

  const importSession = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const items = importPostSessionJson(await file.text());
      if (onRecord) items.forEach(onRecord);
      else saveHistory([...loadHistory(), ...items]);
      setImportNotice(`已匯入 ${items.length} 個 post-session context evidence。`);
    } catch (reason) {
      setImportNotice(reason instanceof Error ? reason.message : 'Session import 失敗。');
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([JSON.stringify(postSessionTemplate(), null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'poker-coach-post-session-v1.json';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-violet-400" />實戰回饋</div><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">把已經打完的牌或 session 匯入個人模型。v8 會用 context family 綁定 exposure frequency 與 utility regret，不再把同 skill 的不同 spot 硬乘在一起。</p></div><div className="flex rounded-lg border border-slate-800 p-1 text-xs"><button type="button" onClick={() => setMode('offline')} className={`rounded-md px-3 py-1.5 ${mode === 'offline' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>離線</button><button type="button" onClick={() => setMode('online')} className={`rounded-md px-3 py-1.5 ${mode === 'online' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Gemini</button></div></div>

    <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/7 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-semibold text-blue-100">Post-session importer</div><div className="mt-1 text-xs leading-5 text-blue-200/70">適合牌局結束後匯入 hand-history parser / tracker 產生的 normalized JSON。這裡不做進行中真金白銀牌局的即時 RTA 或自動讀桌。</div></div><div className="flex gap-2"><button type="button" onClick={downloadTemplate} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs"><Download className="h-4 w-4" />下載格式</button><button type="button" onClick={() => importRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-blue-500/30 px-3 py-2 text-xs text-blue-200"><Upload className="h-4 w-4" />匯入 Session</button><input ref={importRef} type="file" accept="application/json" className="hidden" onChange={importSession} /></div></div>{importNotice && <div className="mt-3 text-xs text-blue-100">{importNotice}</div>}</div>

    <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-9"><label className="text-xs text-slate-500">賽制<select value={format} onChange={event => setFormat(event.target.value as Scenario['type'])} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"><option value="Tournament">MTT</option><option value="Cash Game">Cash</option></select></label><Field label="手牌" value={holeCards} onChange={setHoleCards} placeholder="As Kh" /><Field label="公共牌" value={board} onChange={setBoard} placeholder="Qs Jh 4c" /><Field label="位置" value={position} onChange={setPosition} /><Field label="有效籌碼 BB" value={stack} onChange={setStack} /><Field label="底池 BB" value={pot} onChange={setPot} /><Field label="Session ID" value={sessionId} onChange={setSessionId} /><Field label="Session 手牌數" value={sessionHands} onChange={setSessionHands} /><Field label="同類 spot 次數" value={spotCount} onChange={setSpotCount} /></div>
    <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]"><label className="block text-xs text-slate-500">行動線與問題<textarea value={action} onChange={event => setAction(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500" /></label><Field label={format === 'Cash Game' ? '已知 regret（BB，可空白）' : '已知 regret（$EV，可空白）'} value={utilityLoss} onChange={setUtilityLoss} placeholder="僅輸入可信來源" /></div>
    <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={analyze} disabled={loading} className="flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}開始分析</button>{result && <button type="button" onClick={markAsLeak} disabled={queued} className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 px-5 py-3 text-sm font-semibold text-amber-200 disabled:opacity-60"><Target className="h-4 w-4" />{queued ? '已加入個人訓練模型' : '這手我打錯：加入訓練'}</button>}</div>
    {queued && <p className="mt-3 text-xs text-amber-300">已寫入 History v5；session、context family、賽制、exposure 與 utility 單位已結構化。手動輸入的 regret 仍屬 heuristic evidence，不會冒充 verified EV。</p>}
    {result && <div className="mt-5 max-h-[520px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/45 p-4 text-sm leading-7 text-slate-300">{result}</div>}
  </section>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="text-xs text-slate-500">{label}<input value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500" /></label>;
}
