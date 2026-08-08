import { ChangeEvent, ReactNode, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, BarChart3, BookOpen, Brain, CalendarClock, CheckCircle2, Clock3, Download,
  Flame, Layers3, Play, RotateCcw, Sparkles, Star, Target, Upload, X,
} from 'lucide-react';
import { scenarios } from '../data';
import { HistoryItem, PlayerProfile, Scenario } from '../types';
import { AppPage, AppShell } from './AppShell';
import { buildDailyTrainingPlan, getDueScenarioIds, TrainingReason } from '../features/training/sessionPlanner';
import { TrainingSession } from '../features/training/TrainingSession';
import { StrategyExplorer } from '../features/strategy/StrategyExplorer';
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
  'due-review': '到期複習', 'weak-area': '弱點強化', 'recent-mistake': '近期錯誤', new: '新題', benchmark: '未見基準題', mixed: '綜合混合',
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
    if (!unique.length) { setNotice('目前沒有符合條件且已到期的題目。系統不會為了刷題而提前破壞複習間隔。'); return; }
    setNotice(null); setActiveSession({ title, scenarios: unique }); setPage('train'); window.scrollTo({ top: 0 });
  };
  const recordHistory = (item: HistoryItem) => setHistory(previous => { const updated = [...previous, item]; saveHistory(updated); return updated; });
  const completeOnboarding = (next: PlayerProfile) => { const saved = savePlayerProfile(next); setProfile(saved); setOnboardingOpen(false); setNotice('玩家模型已更新，今日訓練已重新規劃。'); };
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
        {page === 'today' && <TodayPage dailyPlan={dailyPlan} dueCount={dueScenarios.length} weaknesses={weaknesses} metrics={metrics} weekItems={weekItems} profile={profile} onStart={() => startSession('今日個人化訓練', dailyPlan.items.map(item => item.scenario))} onReview={() => startSession('到期提取複習', dueScenarios)} onNavigate={changePage} />}
        {page === 'train' && <TrainPage profile={profile} history={history} relevant={relevantScenarios} onStart={startSession} />}
        {page === 'review' && <ReviewPage dueScenarios={dueScenarios} weaknesses={weaknesses} mastery={mastery} starredIds={starredIds} onStart={startSession} />}
        {page === 'learn' && <LearnPage />}
        {page === 'analysis' && <AnalysisPage history={history} metrics={metrics} weaknesses={weaknesses} mastery={mastery} onExport={() => exportTrainingData(history, starredIds, profile)} onImport={() => importRef.current?.click()} />}
      </>}
      <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => { handleImport(event.target.files?.[0]); event.currentTarget.value = ''; }} />
      <SettingsDrawer open={settingsOpen} profile={profile} history={history} starredIds={starredIds} onClose={() => setSettingsOpen(false)} onEditProfile={() => { setSettingsOpen(false); setOnboardingOpen(true); }} onRestore={restoreBackup} />
      {onboardingOpen && <Onboarding initial={profile} onComplete={completeOnboarding} />}
    </AppShell>
  );
}

function TodayPage({ dailyPlan, dueCount, weaknesses, metrics, weekItems, profile, onStart, onReview, onNavigate }: {
  dailyPlan: ReturnType<typeof buildDailyTrainingPlan>; dueCount: number; weaknesses: WeaknessInsight[]; metrics: ReturnType<typeof getLearningMetrics>;
  weekItems: HistoryItem[]; profile: PlayerProfile; onStart: () => void; onReview: () => void; onNavigate: (page: AppPage) => void;
}) {
  const weekAccuracy = accuracy(weekItems);
  const bestImprovement = [...weaknesses].sort((a, b) => b.recentTrend - a.recentTrend)[0];
  return <div className="space-y-6">
    <section className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(15,23,42,0.5)_55%)] p-6 md:p-9"><div className="grid items-center gap-8 lg:grid-cols-[1fr_340px]"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400"><Sparkles className="h-4 w-4" />今天最值得做的事</div><h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-white md:text-4xl">完成 {dailyPlan.items.length} 題個人化提取練習</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">依你的 {profile.formats.join('/')}、{profile.stackBands.join('/')} 籌碼、到期節點、掌握度與未見題自動組合。答錯後不會立即重出。</p><div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={onStart} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-emerald-950"><Play className="h-4 w-4 fill-current" />開始今日訓練</button><button type="button" onClick={() => onNavigate('train')} className="rounded-xl border border-slate-700 bg-slate-950/35 px-5 py-3.5 text-sm font-semibold">選擇專項</button></div></div><div className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-5"><div className="flex items-center justify-between"><span className="text-sm font-semibold">今日組成</span><span className="text-xs text-slate-500">約 {Math.max(6, dailyPlan.items.length)} 分鐘</span></div><div className="mt-4 space-y-3">{(Object.entries(dailyPlan.counts) as Array<[TrainingReason, number]>).filter(([, count]) => count > 0).map(([reason, count]) => <div key={reason} className="flex justify-between text-sm"><span className="text-slate-400">{REASON_LABELS[reason]}</span><span className="font-mono font-semibold">{count} 題</span></div>)}</div></div></div></section>
    <section className="grid gap-4 md:grid-cols-4"><MetricCard icon={<Target className="h-5 w-5" />} label="本週正確率" value={`${weekAccuracy}%`} detail={`${weekItems.length} 個決策`} /><MetricCard icon={<CalendarClock className="h-5 w-5" />} label="真正到期" value={`${dueCount}`} detail="已到 nextReviewAt" action={dueCount ? '開始' : undefined} onAction={onReview} /><MetricCard icon={<Brain className="h-5 w-5" />} label="延遲留存" value={`${metrics.delayedRetention}%`} detail="隔開時間仍答對" /><MetricCard icon={<Layers3 className="h-5 w-5" />} label="已掌握節點" value={`${metrics.masteredNodes}`} detail="需含延遲複習" /></section>
    <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><Panel title="真正的薄弱點" subtitle="納入樣本量、難度、時間與延遲表現" action="進入複習" onAction={() => onNavigate('review')}><div className="space-y-3">{weaknesses.length ? weaknesses.slice(0, 4).map(item => <div key={item.key} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl font-mono text-sm font-bold ${item.mastery < 60 ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-300'}`}>{item.mastery}%</div><div className="min-w-0 flex-1"><div className="font-semibold text-slate-200">{item.key}</div><div className="mt-1 text-xs text-slate-500">{item.total} 次 · 樣本信心 {item.sampleConfidence}% · 趨勢 {signed(item.recentTrend)}%</div></div><ArrowRight className="h-4 w-4 text-slate-600" /></div>) : <EmptyState text="完成幾次訓練後，系統會建立掌握度模型。" />}</div></Panel><Panel title="本週進展" subtitle="使用者資訊取代開發進度"><Insight label="最大進步" value={bestImprovement ? `${bestImprovement.key} ${signed(bestImprovement.recentTrend)}%` : '尚無足夠資料'} /><Insight label="未見題正確率" value={`${metrics.unseenAccuracy}%`} /><Insight label="信心校準" value={`${metrics.confidenceCalibration}%`} /><Insight label="平均 EV 損失" value={`${metrics.averageEvLossBB.toFixed(3)}BB`} /></Panel></section>
  </div>;
}

function TrainPage({ profile, history, relevant, onStart }: { profile: PlayerProfile; history: HistoryItem[]; relevant: Scenario[]; onStart: (title: string, scenarios: Scenario[]) => void }) {
  const daily = buildDailyTrainingPlan(scenarios, history, profile.dailyQuestions, Date.now(), profile).items.map(item => item.scenario);
  const modes = [
    { title: '今日個人化', description: 'Mastery、到期、弱點與未見題', icon: <Sparkles className="h-6 w-6" />, items: daily, featured: true },
    { title: '翻前決策', description: '開池、跟注、3-Bet、4-Bet 與短碼', icon: <Layers3 className="h-6 w-6" />, items: relevant.filter(s => s.steps.some(step => step.street === 'Preflop')).slice(0, 20) },
    { title: '翻後決策', description: 'Flop、Turn、River 的價值與詐唬', icon: <Brain className="h-6 w-6" />, items: relevant.filter(s => s.steps.some(step => step.street !== 'Preflop')).slice(0, 20) },
    { title: '短碼與 ICM', description: 'Push/Fold、重偷與生存價值', icon: <Target className="h-6 w-6" />, items: relevant.filter(s => s.type === 'Tournament' && (s.userBB <= 25 || s.category?.some(c => /ICM|短碼/.test(c)))).slice(0, 20) },
    { title: '數學與 SPR', description: '底池賠率、SPR、組合與尺寸', icon: <BarChart3 className="h-6 w-6" />, items: relevant.filter(s => s.category?.some(c => /SPR|賠率|數學|尺寸|組合/.test(c)) || s.steps.some(step => step.spr !== undefined || step.potOdds)).slice(0, 20) },
    { title: '未見題探索', description: '一般訓練池的未見題；真正 Holdout 請使用 Hidden Benchmark', icon: <CheckCircle2 className="h-6 w-6" />, items: relevant.filter(s => !history.some(item => item.scenarioId === s.id)).slice(0, 12) },
  ];
  return <div><div className="mb-6 max-w-2xl"><h2 className="text-2xl font-semibold">選擇訓練模式</h2><p className="mt-2 text-sm text-slate-400">預設使用系統推薦。專項訓練仍會記錄信心、掌握度與延遲留存。</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{modes.map(mode => <ModeCard key={mode.title} {...mode} onClick={() => onStart(mode.title, mode.items)} />)}</div></div>;
}

function ReviewPage({ dueScenarios, weaknesses, mastery, starredIds, onStart }: { dueScenarios: Scenario[]; weaknesses: WeaknessInsight[]; mastery: ReturnType<typeof calculateMastery>; starredIds: string[]; onStart: (title: string, scenarios: Scenario[]) => void }) {
  const starred = scenarios.filter(scenario => starredIds.includes(scenario.id));
  const reviewNodes = mastery.filter(item => item.status === 'review').length;
  return <div className="space-y-6"><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><ReviewBucket icon={<CalendarClock className="h-5 w-5" />} title="今日到期" count={dueScenarios.length} description="只出已到排程時間的題" onClick={() => onStart('今日到期複習', dueScenarios)} /><ReviewBucket icon={<Clock3 className="h-5 w-5" />} title="待提取節點" count={reviewNodes} description="以 scenario + step 追蹤" onClick={() => onStart('節點提取練習', dueScenarios)} /><ReviewBucket icon={<Star className="h-5 w-5" />} title="收藏題" count={starred.length} description="你主動標記的情境" onClick={() => onStart('收藏題複習', starred)} /><ReviewBucket icon={<Target className="h-5 w-5" />} title="薄弱主題" count={weaknesses.filter(item => item.mastery < 80).length} description="Bayesian 修正後掌握度" onClick={() => weaknesses[0] && onStart(`${weaknesses[0].key} 強化`, scenarios.filter(s => s.category?.includes(weaknesses[0].key)))} /></section><Panel title="薄弱主題排序" subtitle="掌握度優先，再考慮樣本信心與趨勢"><div className="grid gap-3 md:grid-cols-2">{weaknesses.length ? weaknesses.map(item => { const items = scenarios.filter(scenario => scenario.category?.includes(item.key)); return <button key={item.key} type="button" onClick={() => onStart(`${item.key} 強化`, items)} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/30 p-4 text-left hover:border-slate-700"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-900 font-mono text-sm font-bold text-amber-300">{item.mastery}%</div><div className="min-w-0 flex-1"><div className="font-semibold text-slate-200">{item.key}</div><div className="mt-1 text-xs text-slate-500">{item.total} 次 · 樣本信心 {item.sampleConfidence}% · 趨勢 {signed(item.recentTrend)}%</div></div><ArrowRight className="h-4 w-4 text-slate-600" /></button>; }) : <EmptyState text="還沒有足夠歷史資料。" />}</div></Panel></div>;
}

function LearnPage() { return <div className="space-y-6"><button type="button" onClick={() => { window.location.hash = 'solver-corpus'; }} className="pc-hero-glow pc-card-lift w-full rounded-2xl border border-blue-500/25 bg-blue-500/8 p-5 text-left"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Verified Solver Corpus</div><div className="mt-2 text-xl font-semibold text-white">PokerBench · 11,000 solver-computed decision rows</div><div className="mt-2 text-sm leading-6 text-slate-400">直接訓練 Preflop / Postflop optimal decision 與下注尺寸；來源固定 revision、Apache-2.0，缺少 per-action EV 時不製造假 EV。</div></button><StrategyExplorer /><section className="grid gap-4 md:grid-cols-3"><LearningCard title="底池賠率" description="跟注成本、最低勝率與 EV loss。" status="Exact / 題庫" /><LearningCard title="SPR 決策" description="依底池與有效籌碼理解承諾程度。" status="Mastery 節點" /><LearningCard title="Blocker 組合" description="由組合削減連結到策略頻率與反轉條件。" status="Strategy v2.2" /></section></div>; }

function AnalysisPage({ history, metrics, weaknesses, mastery, onExport, onImport }: { history: HistoryItem[]; metrics: ReturnType<typeof getLearningMetrics>; weaknesses: WeaknessInsight[]; mastery: ReturnType<typeof calculateMastery>; onExport: () => void; onImport: () => void }) {
  const recent = [...history].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  return <div className="space-y-6"><section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6"><MetricCard icon={<Target className="h-5 w-5" />} label="未見題" value={`${metrics.unseenAccuracy}%`} detail="真實初見表現" /><MetricCard icon={<Clock3 className="h-5 w-5" />} label="延遲留存" value={`${metrics.delayedRetention}%`} detail="四小時以上" /><MetricCard icon={<Brain className="h-5 w-5" />} label="信心校準" value={`${metrics.confidenceCalibration}%`} detail="把握與結果一致" /><MetricCard icon={<BarChart3 className="h-5 w-5" />} label="Transfer" value={`${metrics.transferScore}%`} detail="換情境仍會" /><MetricCard icon={<Layers3 className="h-5 w-5" />} label="Mastered" value={`${metrics.masteredNodes}`} detail={`${mastery.length} 個節點`} /><MetricCard icon={<Flame className="h-5 w-5" />} label="EV loss" value={`${metrics.averageEvLossBB.toFixed(3)}`} detail="平均 BB／決策" /></section><section className="grid gap-6 lg:grid-cols-2"><Panel title="依主題掌握度" subtitle="不是單純正確率"><BarList items={weaknesses.map(item => ({ key: item.key, total: item.total, accuracy: item.mastery }))} /></Panel><Panel title="Mastery 狀態" subtitle="逐 scenario + step"><div className="grid grid-cols-2 gap-3"><StatTile label="已掌握" value={mastery.filter(item => item.status === 'mastered').length} /><StatTile label="學習中" value={mastery.filter(item => item.status === 'learning').length} /><StatTile label="待複習" value={mastery.filter(item => item.status === 'review').length} /><StatTile label="新節點" value={mastery.filter(item => item.status === 'new').length} /></div></Panel></section><HandLab /><Panel title="最近決策" subtitle="顯示信心、是否延遲與 Mastery key"><div className="divide-y divide-slate-800">{recent.length ? recent.map(item => <div key={item.attemptId || `${item.scenarioId}-${item.timestamp}`} className="flex items-center gap-4 py-3"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${isHistoryCorrect(item) ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>{isHistoryCorrect(item) ? <CheckCircle2 className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate-200">{item.questionLabel || item.scenarioId}</div><div className="mt-0.5 text-xs text-slate-500">{item.masteryKey || item.stepId || 'root'} · 信心 {item.confidence || '-'} · {item.isDelayedReview ? '延遲提取' : item.isUnseen ? '初見' : '近期'}</div></div><div className="font-mono text-sm">{item.score * 10}</div></div>) : <EmptyState text="尚無訓練紀錄。" />}</div></Panel><section className="grid gap-4 md:grid-cols-2"><UtilityCard icon={<Download className="h-5 w-5" />} title="匯出完整備份" description="History v4、收藏與玩家模型" onClick={onExport} /><UtilityCard icon={<Upload className="h-5 w-5" />} title="匯入備份" description="支援舊版本自動遷移" onClick={onImport} /></section></div>;
}

function MetricCard({ icon, label, value, detail, action, onAction }: { icon: ReactNode; label: string; value: string; detail: string; action?: string; onAction?: () => void }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="flex items-center gap-2 text-sm text-slate-400">{icon}{label}</div><div className="mt-3 font-mono text-3xl font-bold tracking-tight text-white">{value}</div><div className="mt-1 flex items-center justify-between text-xs text-slate-500"><span>{detail}</span>{action && <button type="button" onClick={onAction} className="font-semibold text-emerald-400">{action}</button>}</div></div>; }
function Panel({ title, subtitle, children, action, onAction }: { title: string; subtitle?: string; children: ReactNode; action?: string; onAction?: () => void }) { return <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><h3 className="font-semibold">{title}</h3>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div>{action && <button type="button" onClick={onAction} className="text-xs font-semibold text-emerald-400">{action}</button>}</div>{children}</section>; }
function ModeCard({ title, description, icon, items, featured, onClick }: { title: string; description: string; icon: ReactNode; items: Scenario[]; featured?: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} className={`group rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 ${featured ? 'border-emerald-500/30 bg-emerald-500/8' : 'border-slate-800 bg-slate-900/55'}`}><div className={`grid h-11 w-11 place-items-center rounded-xl ${featured ? 'bg-emerald-500 text-emerald-950' : 'bg-slate-800 text-slate-300'}`}>{icon}</div><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-2 min-h-10 text-sm text-slate-500">{description}</p><div className="mt-5 flex justify-between text-xs"><span className="text-slate-500">{items.length} 題</span><span className="flex items-center gap-1 font-semibold text-emerald-400">開始<ArrowRight className="h-4 w-4" /></span></div></button>; }
function ReviewBucket({ icon, title, count, description, onClick }: { icon: ReactNode; title: string; count: number; description: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 text-left"><div className="flex justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-800">{icon}</span><span className="font-mono text-3xl font-bold">{count}</span></div><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-1 text-xs text-slate-500">{description}</p></button>; }
function LearningCard({ title, description, status }: { title: string; description: string; status: string }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><BookOpen className="h-5 w-5 text-blue-400" /><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm text-slate-500">{description}</p><span className="mt-4 inline-block rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">{status}</span></div>; }
function UtilityCard({ icon, title, description, onClick }: { icon: ReactNode; title: string; description: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 text-left"><span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-800 text-emerald-400">{icon}</span><span><span className="block font-semibold">{title}</span><span className="mt-1 block text-xs text-slate-500">{description}</span></span></button>; }
function BarList({ items }: { items: Array<{ key: string; total: number; accuracy: number }> }) { return <div className="space-y-4">{items.length ? items.slice(0, 8).map(item => <div key={item.key}><div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-400">{item.key}</span><span className="font-mono">{item.accuracy}% · {item.total}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${item.accuracy >= 80 ? 'bg-emerald-500' : item.accuracy >= 60 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${item.accuracy}%` }} /></div></div>) : <EmptyState text="尚無足夠資料。" />}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-slate-800 px-5 py-8 text-center text-sm text-slate-500">{text}</div>; }
function Insight({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-b border-slate-800 py-3 last:border-0"><span className="text-sm text-slate-500">{label}</span><span className="text-sm font-semibold text-slate-200">{value}</span></div>; }
function StatTile({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-2xl font-bold">{value}</div></div>; }
function accuracy(items: HistoryItem[]): number { return items.length ? Math.round(items.filter(isHistoryCorrect).length / items.length * 100) : 0; }
function signed(value: number): string { return value > 0 ? `+${value}` : String(value); }
