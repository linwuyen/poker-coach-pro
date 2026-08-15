import { ChangeEvent, ReactNode, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, BarChart3, Brain, CalendarClock, CheckCircle2, Clock3, Download,
  EyeOff, Layers3, Network, Play, RotateCcw, Sparkles, Target, Upload, X,
} from 'lucide-react';
import { scenarios } from '../data';
import { HistoryItem, PlayerProfile, Scenario } from '../types';
import { AppPage, AppShell } from './AppShell';
import { buildDailyTrainingPlan, getDueScenarioIds, TrainingReason } from '../features/training/sessionPlanner';
import { TrainingSession } from '../features/training/TrainingSession';
import { Onboarding } from '../features/onboarding/Onboarding';
import { SettingsDrawer } from '../features/settings/SettingsDrawer';
import { HandLab } from '../features/analysis/HandLab';
import { filterRelevantScenarios, loadPlayerProfile, savePlayerProfile } from '../domain/playerProfile';
import {
  calculateMastery, getLearningMetrics, getWeaknessInsights, isHistoryCorrect, WeaknessInsight,
} from '../learning-engine';
import {
  exportTrainingData, importTrainingData, loadHistory, saveHistory, TrainingBackup,
} from '../utils/history';

interface ActiveSession { title: string; scenarios: Scenario[]; }
const REASON_LABELS: Record<TrainingReason, string> = {
  'due-review': '到期複習', 'weak-area': '弱點強化', 'recent-mistake': '近期錯誤', new: '新題', benchmark: '泛化探索', mixed: '綜合混合',
};

export default function AppV2() {
  const [page, setPage] = useState<AppPage>('today');
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [profile, setProfile] = useState<PlayerProfile>(loadPlayerProfile);
  const [starredIds, setStarredIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('poker_starred_ids') || '[]'); } catch { return []; } });
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(!profile.onboardingComplete);
  const [notice, setNotice] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const dailyPlan = useMemo(() => buildDailyTrainingPlan(scenarios, history, profile.dailyQuestions, Date.now(), profile), [history, profile]);
  const relevantScenarios = useMemo(() => filterRelevantScenarios(scenarios, profile), [profile]);
  const dueIds = useMemo(() => getDueScenarioIds(history), [history]);
  const dueScenarios = useMemo(() => dueIds.map(id => scenarios.find(scenario => scenario.id === id)).filter((scenario): scenario is Scenario => Boolean(scenario)), [dueIds]);
  const weaknesses = useMemo(() => getWeaknessInsights(history).slice(0, 8), [history]);
  const metrics = useMemo(() => getLearningMetrics(history), [history]);
  const mastery = useMemo(() => calculateMastery(history), [history]);
  const weekItems = history.filter(item => item.timestamp >= Date.now() - 7 * 86400000 && item.trainingType !== 'custom');

  const changePage = (next: AppPage) => { setActiveSession(null); setPage(next); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const startSession = (title: string, selected: Scenario[]) => {
    const unique = [...new Map(selected.map(scenario => [scenario.id, scenario])).values()];
    if (!unique.length) { setNotice('目前沒有符合條件的題目。若是複習，系統不會為了刷題而提前破壞間隔。'); return; }
    setNotice(null); setActiveSession({ title, scenarios: unique }); setPage('train'); window.scrollTo({ top: 0 });
  };
  const recordHistory = (item: HistoryItem) => setHistory(previous => { const updated = [...previous, item]; saveHistory(updated); return updated; });
  const completeOnboarding = (next: PlayerProfile) => { const saved = savePlayerProfile(next); setProfile(saved); setOnboardingOpen(false); setNotice('玩家模型已更新，今天的訓練已重新排序。'); };
  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const imported = await importTrainingData(file); setHistory(imported.history); setStarredIds(imported.starredIds);
      if (imported.playerProfile) setProfile(savePlayerProfile(imported.playerProfile));
      setNotice(`已匯入 ${imported.history.length} 筆訓練紀錄。`);
    } catch { setNotice('匯入失敗：檔案格式不正確。'); }
  };
  const restoreBackup = (backup: TrainingBackup) => {
    saveHistory(backup.history); setHistory(backup.history);
    localStorage.setItem('poker_starred_ids', JSON.stringify(backup.starredIds || [])); setStarredIds(backup.starredIds || []);
    if (backup.playerProfile) setProfile(savePlayerProfile(backup.playerProfile));
  };

  return (
    <AppShell page={page} onPageChange={changePage} onOpenSettings={() => setSettingsOpen(true)}>
      {notice && <div className="mb-5 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-200"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}><X className="h-4 w-4" /></button></div>}
      {activeSession ? <TrainingSession title={activeSession.title} scenarios={activeSession.scenarios} history={history} onRecord={recordHistory} onExit={() => setActiveSession(null)} onComplete={() => { setActiveSession(null); setPage('today'); }} /> : <>
        {page === 'today' && <TodayPage dailyPlan={dailyPlan} dueCount={dueScenarios.length} weaknesses={weaknesses} metrics={metrics} weekItems={weekItems} onStart={() => startSession('今日自動教練', dailyPlan.items.map(item => item.scenario))} onReview={() => startSession('到期提取複習', dueScenarios)} onNavigate={changePage} />}
        {page === 'train' && <TrainPage profile={profile} history={history} relevant={relevantScenarios} onStart={startSession} />}
        {page === 'analysis' && <ProgressPage history={history} metrics={metrics} weaknesses={weaknesses} mastery={mastery} dueScenarios={dueScenarios} onStart={startSession} onRecord={recordHistory} onExport={() => exportTrainingData(history, starredIds, profile)} onImport={() => importRef.current?.click()} />}
      </>}
      <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => { handleImport(event.target.files?.[0]); event.currentTarget.value = ''; }} />
      <SettingsDrawer open={settingsOpen} profile={profile} history={history} starredIds={starredIds} onClose={() => setSettingsOpen(false)} onEditProfile={() => { setSettingsOpen(false); setOnboardingOpen(true); }} onRestore={restoreBackup} />
      {onboardingOpen && <Onboarding initial={profile} onComplete={completeOnboarding} />}
    </AppShell>
  );
}

function TodayPage({ dailyPlan, dueCount, weaknesses, metrics, weekItems, onStart, onReview, onNavigate }: {
  dailyPlan: ReturnType<typeof buildDailyTrainingPlan>; dueCount: number; weaknesses: WeaknessInsight[]; metrics: ReturnType<typeof getLearningMetrics>;
  weekItems: HistoryItem[]; onStart: () => void; onReview: () => void; onNavigate: (page: AppPage) => void;
}) {
  const weekAccuracy = accuracy(weekItems);
  const nextBest = dailyPlan.items[0];
  const evidenceLabel = nextBest?.evGainEvidence === 'verified' ? '已驗證 EV + 實戰頻率' : nextBest?.evGainEvidence === 'observed' ? '實戰觀測' : 'Priority estimate';
  return <div className="space-y-6">
    <section className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(15,23,42,0.5)_55%)] p-6 md:p-9"><div className="grid items-center gap-8 lg:grid-cols-[1fr_340px]"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400"><Sparkles className="h-4 w-4" />今天只做一件最值得的事</div><h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-white md:text-4xl">{nextBest ? nextBest.scenario.title : '完成今日自動教練'}</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">系統先選題；你作答後，Range、EV、Strategy、Boundary 與漏點診斷會直接吃這手牌的資料，下一手再依新結果重排。</p><div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={onStart} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-emerald-950"><Play className="h-4 w-4 fill-current" />開始今日訓練</button><button type="button" onClick={() => onNavigate('train')} className="rounded-xl border border-slate-700 bg-slate-950/35 px-5 py-3.5 text-sm font-semibold">我要自己選方向</button></div></div><div className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-5"><div className="text-xs text-slate-500">目前排序依據</div><div className="mt-1 text-lg font-semibold text-slate-100">{evidenceLabel}</div>{nextBest?.expectedEvGainPer100Hands !== undefined ? <><div className="mt-4 text-xs text-slate-500">可報告 Expected EV Gain</div><div className="mt-1 font-mono text-xl font-bold text-emerald-300">+{nextBest.expectedEvGainPer100Hands.toFixed(3)} BB/100</div></> : <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs leading-5 text-slate-400">EV gain 尚無足夠實測證據，因此只用 Priority 排序，不製造假精度。{nextBest?.utilityMode === 'tournament-priority' ? ' MTT 也不把 chip-EV 冒充 $EV。' : ''}</div>}<div className="mt-4 space-y-2">{(Object.entries(dailyPlan.counts) as Array<[TrainingReason, number]>).filter(([, count]) => count > 0).map(([reason, count]) => <div key={reason} className="flex justify-between text-xs"><span className="text-slate-500">{REASON_LABELS[reason]}</span><span>{count} 題</span></div>)}</div></div></div></section>
    <section className="grid gap-4 md:grid-cols-4"><MetricCard icon={<Target className="h-5 w-5" />} label="本週正確率" value={`${weekAccuracy}%`} detail={`${weekItems.length} 個決策`} /><MetricCard icon={<CalendarClock className="h-5 w-5" />} label="到期複習" value={`${dueCount}`} detail="真正到 nextReviewAt" action={dueCount ? '直接練' : undefined} onAction={onReview} /><MetricCard icon={<Brain className="h-5 w-5" />} label="延遲留存" value={`${metrics.delayedRetention}%`} detail="隔開時間仍答對" /><MetricCard icon={<Layers3 className="h-5 w-5" />} label="已掌握" value={`${metrics.masteredNodes}`} detail="需含 transfer / delay" /></section>
    <Panel title="目前最值得修的漏點" subtitle="系統會把漏點直接帶進後續訓練，不用先挑工具" action="看完整進度" onAction={() => onNavigate('analysis')}><div className="grid gap-3 md:grid-cols-2">{weaknesses.length ? weaknesses.slice(0, 4).map(item => <div key={item.key} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl font-mono text-sm font-bold ${item.mastery < 60 ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-300'}`}>{item.mastery}%</div><div><div className="font-semibold text-slate-200">{item.key}</div><div className="mt-1 text-xs text-slate-500">{item.total} 次 · 樣本信心 {item.sampleConfidence}% · 趨勢 {signed(item.recentTrend)}%</div></div></div>) : <EmptyState text="完成幾次訓練後，系統會自動建立漏點排序。" />}</div></Panel>
  </div>;
}

function TrainPage({ profile, history, relevant, onStart }: { profile: PlayerProfile; history: HistoryItem[]; relevant: Scenario[]; onStart: (title: string, scenarios: Scenario[]) => void }) {
  const daily = buildDailyTrainingPlan(scenarios, history, profile.dailyQuestions, Date.now(), profile).items.map(item => item.scenario);
  const preflop = relevant.filter(s => s.steps.some(step => step.street === 'Preflop'));
  const postflop = relevant.filter(s => s.steps.some(step => step.street !== 'Preflop'));
  const tournament = relevant.filter(s => s.type === 'Tournament');
  const tracks = [
    { title: '自動教練', description: '系統持續依你的最新結果改下一手，不用選工具', icon: <Sparkles className="h-6 w-6" />, items: daily, featured: true },
    { title: '翻前', description: 'RFI、BB defense、3-Bet、4-Bet 與短碼；答完直接顯示可驗證 strategy', icon: <Layers3 className="h-6 w-6" />, items: preflop.slice(0, 24) },
    { title: '翻後', description: 'Flop / Turn / River；答完原地看 Range、EV、Boundary 與漏點', icon: <Brain className="h-6 w-6" />, items: postflop.slice(0, 24) },
    { title: '錦標賽', description: '短碼、ICM、PKO、Satellite；只顯示可信 $EV / priority 證據', icon: <Target className="h-6 w-6" />, items: tournament.slice(0, 24) },
  ];
  return <div className="space-y-6"><div className="max-w-3xl"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">一條訓練流程</div><h2 className="mt-2 text-2xl font-semibold">只選你要練的方向</h2><p className="mt-2 text-sm leading-6 text-slate-400">進場後只做：看牌 → 決策 → 深挖 → 下一手。模擬牌局已知的資料與你的選擇全部自動帶入分析，不再叫你開 Range / Equity / Solver 後重填一遍。</p></div><div className="grid gap-4 md:grid-cols-2">{tracks.map(track => <ModeCard key={track.title} {...track} onClick={() => onStart(track.title, track.items)} />)}</div><div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-5 text-sm leading-6 text-slate-400"><span className="font-semibold text-slate-200">進階 workbench 沒有刪除。</span> 它們保留給獨立研究、benchmark 與診斷；正常訓練不需要先理解這些工具，也不再從這裡分流。</div></div>;
}

function ProgressPage({ history, metrics, weaknesses, mastery, dueScenarios, onStart, onRecord, onExport, onImport }: {
  history: HistoryItem[]; metrics: ReturnType<typeof getLearningMetrics>; weaknesses: WeaknessInsight[]; mastery: ReturnType<typeof calculateMastery>; dueScenarios: Scenario[];
  onStart: (title: string, scenarios: Scenario[]) => void; onRecord: (item: HistoryItem) => void; onExport: () => void; onImport: () => void;
}) {
  const recent = [...history].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  const topWeakness = weaknesses[0];
  const topWeaknessScenarios = topWeakness ? scenarios.filter(s => s.category?.includes(topWeakness.key)) : [];
  return <div className="space-y-6"><section className="grid gap-4 md:grid-cols-4"><MetricCard icon={<CalendarClock className="h-5 w-5" />} label="到期複習" value={`${dueScenarios.length}`} detail="現在該提取" action={dueScenarios.length ? '開始' : undefined} onAction={() => onStart('到期提取複習', dueScenarios)} /><MetricCard icon={<Clock3 className="h-5 w-5" />} label="延遲留存" value={`${metrics.delayedRetention}%`} detail="四小時以上" /><MetricCard icon={<Brain className="h-5 w-5" />} label="信心校準" value={`${metrics.confidenceCalibration}%`} detail="把握與結果一致" /><MetricCard icon={<BarChart3 className="h-5 w-5" />} label="Transfer" value={`${metrics.transferScore}%`} detail="換情境仍會" /></section><section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"><Panel title="下一個修復動作" subtitle="複習與弱點直接回到同一個訓練迴路"><div className="space-y-3"><ActionRow title="到期提取" detail={`${dueScenarios.length} 題真正到期`} action="開始" onClick={() => onStart('到期提取複習', dueScenarios)} disabled={!dueScenarios.length} /><ActionRow title={topWeakness ? `修 ${topWeakness.key}` : '等待更多資料'} detail={topWeakness ? `掌握 ${topWeakness.mastery}% · 樣本信心 ${topWeakness.sampleConfidence}%` : '完成更多題後自動生成'} action="強化" onClick={() => onStart(`${topWeakness?.key || '弱點'} 強化`, topWeaknessScenarios)} disabled={!topWeaknessScenarios.length} /></div></Panel><Panel title="Mastery 狀態" subtitle="逐能力看真正留存"><div className="grid grid-cols-2 gap-3"><StatTile label="已掌握" value={mastery.filter(item => item.status === 'mastered').length} /><StatTile label="學習中" value={mastery.filter(item => item.status === 'learning').length} /><StatTile label="待複習" value={mastery.filter(item => item.status === 'review').length} /><StatTile label="新節點" value={mastery.filter(item => item.status === 'new').length} /></div></Panel></section><HandLab onRecord={onRecord} /><Panel title="診斷工具" subtitle="只留給全局校準、圖譜與 holdout，不是正常解題入口"><div className="flex flex-wrap gap-2"><ToolLink label="Calibration" hash="calibration" icon={<Brain className="h-4 w-4" />} /><ToolLink label="EV Leak Graph" hash="skill-graph" icon={<Network className="h-4 w-4" />} /><ToolLink label="Solver Holdout" hash="solver-benchmark" icon={<EyeOff className="h-4 w-4" />} /></div></Panel><section className="grid gap-6 lg:grid-cols-2"><Panel title="依主題掌握度" subtitle="不是單純正確率"><BarList items={weaknesses.map(item => ({ key: item.key, total: item.total, accuracy: item.mastery }))} /></Panel><Panel title="最近決策" subtitle="錯誤與真實牌局都在同一條時間線"><div className="divide-y divide-slate-800">{recent.length ? recent.map(item => <div key={item.attemptId || `${item.scenarioId}-${item.timestamp}`} className="flex items-center gap-4 py-3"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${isHistoryCorrect(item) ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>{isHistoryCorrect(item) ? <CheckCircle2 className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate-200">{item.questionLabel || item.scenarioId}</div><div className="mt-0.5 text-xs text-slate-500">{item.trainingType || 'scenario'} · 信心 {item.confidence || '-'} · {item.spotFrequencyPer100Hands ? `${item.spotFrequencyPer100Hands.toFixed(2)} spots/100` : item.isDelayedReview ? '延遲提取' : item.isUnseen ? '初見' : '近期'}</div></div><div className="font-mono text-sm">{item.score * 10}</div></div>) : <EmptyState text="尚無訓練紀錄。" />}</div></Panel></section><section className="grid gap-4 md:grid-cols-2"><UtilityCard icon={<Download className="h-5 w-5" />} title="匯出完整備份" description="History、玩家模型與實戰觀測" onClick={onExport} /><UtilityCard icon={<Upload className="h-5 w-5" />} title="匯入備份" description="支援舊版本自動遷移" onClick={onImport} /></section></div>;
}

function ToolLink({ label, hash, icon }: { label: string; hash: string; icon: ReactNode }) { return <button type="button" onClick={() => { window.location.hash = hash; }} className="pc-interactive flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-emerald-500/40 hover:text-emerald-200">{icon}{label}</button>; }
function MetricCard({ icon, label, value, detail, action, onAction }: { icon: ReactNode; label: string; value: string; detail: string; action?: string; onAction?: () => void }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="flex items-center gap-2 text-sm text-slate-400">{icon}{label}</div><div className="mt-3 font-mono text-3xl font-bold tracking-tight text-white">{value}</div><div className="mt-1 flex items-center justify-between text-xs text-slate-500"><span>{detail}</span>{action && <button type="button" onClick={onAction} className="font-semibold text-emerald-400">{action}</button>}</div></div>; }
function Panel({ title, subtitle, children, action, onAction }: { title: string; subtitle?: string; children: ReactNode; action?: string; onAction?: () => void }) { return <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><h3 className="font-semibold">{title}</h3>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div>{action && <button type="button" onClick={onAction} className="text-xs font-semibold text-emerald-400">{action}</button>}</div>{children}</section>; }
function ModeCard({ title, description, icon, items, featured, onClick }: { title: string; description: string; icon: ReactNode; items: Scenario[]; featured?: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} className={`group rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 ${featured ? 'border-emerald-500/30 bg-emerald-500/8' : 'border-slate-800 bg-slate-900/55'}`}><div className={`grid h-11 w-11 place-items-center rounded-xl ${featured ? 'bg-emerald-500 text-emerald-950' : 'bg-slate-800 text-slate-300'}`}>{icon}</div><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-2 min-h-10 text-sm text-slate-500">{description}</p><div className="mt-5 flex justify-between text-xs"><span className="text-slate-500">{items.length} 題</span><span className="flex items-center gap-1 font-semibold text-emerald-400">開始<ArrowRight className="h-4 w-4" /></span></div></button>; }
function ActionRow({ title, detail, action, onClick, disabled }: { title: string; detail: string; action: string; onClick: () => void; disabled?: boolean }) { return <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="min-w-0 flex-1"><div className="font-semibold text-slate-200">{title}</div><div className="mt-1 text-xs text-slate-500">{detail}</div></div><button type="button" disabled={disabled} onClick={onClick} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-30">{action}</button></div>; }
function UtilityCard({ icon, title, description, onClick }: { icon: ReactNode; title: string; description: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 text-left"><span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-800 text-emerald-400">{icon}</span><span><span className="block font-semibold">{title}</span><span className="mt-1 block text-xs text-slate-500">{description}</span></span></button>; }
function BarList({ items }: { items: Array<{ key: string; total: number; accuracy: number }> }) { return <div className="space-y-4">{items.length ? items.slice(0, 8).map(item => <div key={item.key}><div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-400">{item.key}</span><span className="font-mono">{item.accuracy}% · {item.total}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${item.accuracy >= 80 ? 'bg-emerald-500' : item.accuracy >= 60 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${item.accuracy}%` }} /></div></div>) : <EmptyState text="尚無足夠資料。" />}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-slate-800 px-5 py-8 text-center text-sm text-slate-500">{text}</div>; }
function StatTile({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-2xl font-bold">{value}</div></div>; }
function accuracy(items: HistoryItem[]): number { return items.length ? Math.round(items.filter(isHistoryCorrect).length / items.length * 100) : 0; }
function signed(value: number): string { return value > 0 ? `+${value}` : String(value); }
