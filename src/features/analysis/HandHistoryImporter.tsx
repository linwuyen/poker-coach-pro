import { ChangeEvent, useRef, useState } from 'react';
import { ArrowLeft, FileUp, ShieldCheck, Upload, WandSparkles } from 'lucide-react';
import { importHandHistoryText, parseHandHistoryText } from '../../real-game/handHistory';
import { buildVerifiedLeakEvidence } from '../../real-game/leakPipeline';
import { STRATEGY_PROFILES_V2, StrategyProfile, mergeImmutableProfiles } from '../../strategy-engine-v2';
import { loadHistory, saveHistory } from '../../utils/history';

const IMPORTED_HAND_IDS_KEY = 'poker_imported_hand_ids_v1';
const CUSTOM_PROFILES_KEY = 'poker_strategy_profiles_v2';

function loadImportedIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(IMPORTED_HAND_IDS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch { return []; }
}

function saveImportedIds(ids: string[]): void {
  localStorage.setItem(IMPORTED_HAND_IDS_KEY, JSON.stringify([...new Set(ids)].slice(-100000)));
}

function loadCustomProfiles(): StrategyProfile[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_PROFILES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function HandHistoryImporter({ onExit }: { onExit: () => void }) {
  const [text, setText] = useState('');
  const [heroName, setHeroName] = useState('');
  const [rakePercent, setRakePercent] = useState('');
  const [rakeCapBB, setRakeCapBB] = useState('');
  const [message, setMessage] = useState('');
  const [gradingSummary, setGradingSummary] = useState('');
  const [preview, setPreview] = useState<ReturnType<typeof parseHandHistoryText>>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const inspect = (nextText = text) => {
    try {
      const parsed = parseHandHistoryText(nextText, heroName || undefined);
      setPreview(parsed);
      const heroes = [...new Set(parsed.map(hand => hand.heroName).filter(Boolean))];
      setMessage(parsed.length ? `解析到 ${parsed.length} 手牌 · Hero ${heroes.join(', ') || '尚未辨識'}` : '沒有找到支援的 hand history。');
    } catch (error) {
      setPreview([]);
      setMessage(error instanceof Error ? error.message : '解析失敗');
    }
  };

  const importNow = () => {
    try {
      const importedAt = Date.now();
      const importedIds = loadImportedIds();
      const result = importHandHistoryText(text, {
        heroName: heroName || undefined,
        alreadyImportedIds: importedIds,
        batchId: `hh-${importedAt}`,
        importedAt,
      });
      if (!result.hands.length && result.skippedHandIds.length) {
        setMessage(`沒有新增手牌；${result.skippedHandIds.length} 手牌已匯入過。`);
        return;
      }
      const withoutHero = result.hands.filter(hand => !hand.heroName).length;
      if (withoutHero === result.hands.length && result.hands.length) {
        setMessage('已解析手牌，但找不到 Hero。請輸入 Hero 名稱後再匯入。');
        return;
      }
      const profiles = mergeImmutableProfiles(STRATEGY_PROFILES_V2, loadCustomProfiles());
      const graded = buildVerifiedLeakEvidence(result.hands, profiles, {
        importedAt,
        rakePercent: optionalNumber(rakePercent),
        rakeCapBB: optionalNumber(rakeCapBB),
      });
      const current = loadHistory();
      saveHistory([...current, ...result.history, ...graded.history]);
      saveImportedIds([...importedIds, ...result.parsedHandIds]);
      setPreview(result.hands);
      const totalLoss = graded.findings.reduce((sum, finding) => sum + finding.totalEvLossBB, 0);
      setGradingSummary(graded.gradedDecisions
        ? `Verified grading：${graded.gradedDecisions}/${graded.heroDecisions} 個 Hero preflop decisions 有 exact solver+EV；觀測 regret 合計 ${totalLoss.toFixed(3)}BB。`
        : `Verified grading：0/${graded.heroDecisions}。沒有唯一 exact verified surface + chosen-action EV 的 decision 保持 exposure-only。Postflop HH 目前也不會用 preflop profile 硬套。`);
      setMessage(`已匯入 ${result.hands.length} 手牌 → ${result.contexts} 個實戰 context evidence${result.skippedHandIds.length ? `；跳過 ${result.skippedHandIds.length} 個重複 hand ID` : ''}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '匯入失敗');
    }
  };

  const loadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    const contents = await Promise.all(files.map(file => file.text()));
    const merged = contents.join('\n\n');
    setText(merged);
    inspect(merged);
    event.currentTarget.value = '';
  };

  const heroDetected = preview.filter(hand => hand.heroName).length;
  const sources = [...new Set(preview.map(hand => hand.source))];
  const cash = preview.filter(hand => hand.format === 'Cash').length;
  const mtt = preview.filter(hand => hand.format === 'MTT').length;

  return <div data-testid="hand-history-lab" className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
    <div className="mx-auto max-w-6xl">
      <button type="button" onClick={onExit} className="pc-interactive flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300"><ArrowLeft className="h-4 w-4" />返回主訓練機</button>
      <section className="pc-hero-glow mt-6 rounded-3xl border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.13),rgba(15,23,42,0.78))] p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300"><FileUp className="h-4 w-4" />P9-C · Real-game truth join</div>
        <h1 className="mt-3 text-3xl font-bold">Hand History → exposure → exact verified truth → regret → Daily</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">每手仍先寫 exposure evidence。只有 preflop context 唯一且完整對上 immutable `verified-solver` surface，而且該 chosen action 真有 per-action EV，才會多寫 verified regret evidence。缺資料就停在 Unknown。</p>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">貼上或載入 .txt Hand History</h2><button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300"><Upload className="h-4 w-4" />選擇檔案</button></div>
          <input ref={fileRef} type="file" accept=".txt,text/plain" multiple className="hidden" onChange={loadFiles} />
          <label className="mt-4 block text-xs text-slate-500">Hero 名稱（通常可從 Dealt to 自動辨識；匿名/匯出格式不同時可覆寫）<input data-testid="hh-hero" value={heroName} onChange={event => setHeroName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100" placeholder="Hero" /></label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-500">Cash rake %（只在你知道實際值時填）<input data-testid="hh-rake" type="number" min="0" step="0.1" value={rakePercent} onChange={event => setRakePercent(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm" placeholder="例如 5" /></label>
            <label className="text-xs text-slate-500">Cash rake cap BB<input data-testid="hh-rake-cap" type="number" min="0" step="0.1" value={rakeCapBB} onChange={event => setRakeCapBB(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm" placeholder="例如 2" /></label>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-600">留白不會猜值；如果 solver surface 有 rake/cap 維度，缺少這兩個觀測 context 就不允許 exact grading。</p>
          <textarea data-testid="hh-text" value={text} onChange={event => setText(event.target.value)} className="mt-4 min-h-80 w-full rounded-xl border border-slate-700 bg-slate-950/60 p-4 font-mono text-xs leading-5 text-slate-200 outline-none focus:border-emerald-500" placeholder="PokerStars Hand #... 或 Poker Hand #..." />
          <div className="mt-4 flex flex-wrap gap-2"><button data-testid="hh-preview" type="button" onClick={() => inspect()} className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold"><WandSparkles className="h-4 w-4" />先解析</button><button data-testid="hh-import" type="button" onClick={importNow} disabled={!text.trim()} className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-emerald-950 disabled:opacity-40">解析並匯入 History</button></div>
          {message && <div data-testid="hh-message" className="mt-4 rounded-xl border border-emerald-500/15 bg-emerald-500/6 px-4 py-3 text-sm text-emerald-100">{message}</div>}
          {gradingSummary && <div data-testid="hh-grading-summary" className="mt-3 rounded-xl border border-blue-500/15 bg-blue-500/6 px-4 py-3 text-sm leading-6 text-blue-100">{gradingSummary}</div>}
        </div>

        <aside className="space-y-4">
          <Metric label="解析手牌" value={String(preview.length)} />
          <Metric label="Hero 已辨識" value={`${heroDetected}/${preview.length}`} />
          <Metric label="Cash / MTT" value={`${cash} / ${mtt}`} />
          <Metric label="來源" value={sources.join(' / ') || '-'} />
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/6 p-4 text-xs leading-6 text-cyan-100/80"><ShieldCheck className="mb-2 h-5 w-5 text-cyan-300" /><b>資料邊界</b><br />Raw HH 只證明 exposure/observed action。自動 regret 必須 exact-match verified surface；目前自動 join 僅支援 Strategy Engine v2 可完整表達的 preflop nodes。Postflop board/action tree 未完整建模前保持 Unsupported。</div>
        </aside>
      </section>

      {preview.length > 0 && <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><h2 className="font-semibold">解析預覽</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-slate-500"><tr><th className="pb-2">Hand</th><th>Source</th><th>Format</th><th>Hero</th><th>Position</th><th>Stack</th><th>Actions</th><th>Net BB*</th></tr></thead><tbody className="divide-y divide-slate-800">{preview.slice(0, 30).map(hand => <tr key={hand.id}><td className="py-3 font-mono">{hand.id}</td><td>{hand.source}</td><td>{hand.format}</td><td>{hand.heroName || '-'}</td><td>{hand.heroPosition || '-'}</td><td>{hand.heroStackBB?.toFixed(1) || '-'}</td><td>{hand.actions.filter(action => action.player === hand.heroName && action.type !== 'post').length}</td><td>{hand.netWonBB?.toFixed(2) ?? '-'}</td></tr>)}</tbody></table></div><p className="mt-3 text-[11px] text-slate-600">* Net BB 僅由 hand history 的 contribution / collected / returned 重建，用來稽核匯入，不直接當作 decision EV regret。</p></section>}
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 break-words font-mono text-lg font-bold">{value}</div></div>;
}
