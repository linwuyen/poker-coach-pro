import { ReactNode, useMemo, useState } from 'react';
import { BarChart3, Brain, CalendarClock, CheckCircle2, Clock3, Play, RotateCcw, Sparkles, Target, X } from 'lucide-react';
import { scenarios } from '../data';
import { HistoryItem, PlayerProfile, Scenario } from '../types';
import { AppPage, AppShell } from './AppShell';
import { buildDailyTrainingPlan, getDueScenarioIds } from '../features/training/sessionPlanner';
import { TrainingSession } from '../features/training/TrainingSession';
import { DailyCurriculumSession } from '../features/training/DailyCurriculumSession';
import { dailyCurriculumQuota } from '../learning-engine/dailySolverPlan';
import { Onboarding } from '../features/onboarding/Onboarding';
import { SettingsDrawer } from '../features/settings/SettingsDrawer';
import { filterRelevantScenarios, loadPlayerProfile, savePlayerProfile } from '../domain/playerProfile';
import { calculateMastery, getLearningMetrics, getWeaknessInsights, isHistoryCorrect, WeaknessInsight } from '../learning-engine';
import { loadHistory, saveHistory, TrainingBackup } from '../utils/history';

interface ActiveSession { title: string; scenarios: Scenario[]; continuous?: boolean; }

export default function AppV2() {
  const [page, setPage] = useState<AppPage>('today');
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [profile, setProfile] = useState<PlayerProfile>(loadPlayerProfile);
  const [starredIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('poker_starred_ids') || '[]'); } catch { return []; } });
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [dailySessionOpen, setDailySessionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(!profile.onboardingComplete);
  const [notice, setNotice] = useState<string | null>(null);

  const dailyQuota = useMemo(() => dailyCurriculumQuota(profile.dailyQuestions), [profile.dailyQuestions]);
  const dailyPlan = useMemo(() => buildDailyTrainingPlan(scenarios, history, dailyQuota.curated, Date.now(), profile), [dailyQuota.curated, history, profile]);
  const relevantScenarios = useMemo(() => filterRelevantScenarios(scenarios, profile), [profile]);
  const dueIds = useMemo(() => getDueScenarioIds(history), [history]);
  const dueScenarios = useMemo(() => dueIds.map(id => scenarios.find(scenario => scenario.id === id)).filter((scenario): scenario is Scenario => Boolean(scenario)), [dueIds]);
  const weaknesses = useMemo(() => getWeaknessInsights(history).slice(0, 8), [history]);
  const metrics = useMemo(() => getLearningMetrics(history), [history]);
  const mastery = useMemo(() => calculateMastery(history), [history]);
  const todayStart = startOfLocalDay(Date.now());
  const todayItems = history.filter(item => item.timestamp >= todayStart && item.trainingType !== 'custom');
  const weekItems = history.filter(item => item.timestamp >= Date.now() - 7 * 86400000 && item.trainingType !== 'custom');

  const changePage = (next: AppPage) => { setActiveSession(null); setDailySessionOpen(false); setPage(next); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const startSession = (title: string, selected: Scenario[], continuous = false) => {
    const unique = [...new Map(selected.map(scenario => [scenario.id, scenario])).values()];
    if (!unique.length) { setNotice('目前沒有可用題目。系統不會為了湊局數提前破壞複習間隔。'); return; }
    setNotice(null); setDailySessionOpen(false); setActiveSession({ title, scenarios: unique, continuous }); setPage('train'); window.scrollTo({ top: 0 });
  };
  const startVolume = () => startSession('自動訓練桌', relevantScenarios, true);
  const recordHistory = (item: HistoryItem) => setHistory(previous => { const updated = [...previous, item]; saveHistory(updated); return updated; });
  const completeOnboarding = (next: PlayerProfile) => { const saved = savePlayerProfile(next); setProfile(saved); setOnboardingOpen(false); setNotice('玩家偏好已更新。後續題目會自動重新排序。'); };
  const restoreBackup = (backup: TrainingBackup) => {
    saveHistory(backup.history); setHistory(backup.history);
    localStorage.setItem('poker_starred_ids', JSON.stringify(backup.starredIds || []));
    if (backup.playerProfile) setProfile(savePlayerProfile(backup.playerProfile));
  };

  return (
    <AppShell page={page} onPageChange={changePage} onOpenSettings={() => setSettingsOpen(true)}>
      {notice && <div className="mb-5 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-200"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}><X className="h-4 w-4" /></button></div>}
      {dailySessionOpen ? <DailyCurriculumSession scenarios={scenarios} history={history} profile={profile} onRecord={recordHistory} onExit={() => setDailySessionOpen(false)} onComplete={() => { setDailySessionOpen(false); startVolume(); }} /> : activeSession ? <TrainingSession title={activeSession.title} scenarios={activeSession.scenarios} history={history} continuous={activeSession.continuous} onRecord={recordHistory} onExit={() => setActiveSession(null)} onComplete={() => { setActiveSession(null); setPage('today'); }} /> : <>
        {page === 'today' && <TodayPage dailyPlan={dailyPlan} dailyGoal={dailyQuota.total} todayItems={todayItems} dueCount={dueScenarios.length} weaknesses={weaknesses} metrics={metrics} weekItems={weekItems} onStart={() => { setNotice(null); setActiveSession(null); setDailySessionOpen(true); window.scrollTo({ top: 0 }); }} onNavigate={changePage} />}
        {page === 'train' && <TrainPage relevant={relevantScenarios} onStart={startVolume} />}
        {page === 'analysis' && <ProgressPage history={history} metrics={metrics} weaknesses={weaknesses} mastery={mastery} dueCount={dueScenarios.length} onStart={startVolume} />}
      </>}
      <SettingsDrawer open={settingsOpen} profile={profile} history={history} starredIds={starredIds} onClose={() => setSettingsOpen(false)} onEditProfile={() => { setSettingsOpen(false); setOnboardingOpen(true); }} onRestore={restoreBackup} />
      {onboardingOpen && <Onboarding initial={profile} onComplete={completeOnboarding} />}
    </AppShell>
  );
}

function TodayPage({ dailyPlan, dailyGoal, todayItems, dueCount, weaknesses, metrics, weekItems, onStart, onNavigate }: {
  dailyPlan: ReturnType<typeof buildDailyTrainingPlan>; dailyGoal: number; todayItems: HistoryItem[]; dueCount: number; weaknesses: WeaknessInsight[]; metrics: ReturnType<typeof getLearningMetrics>; weekItems: HistoryItem[]; onStart: () => void; onNavigate: (page: AppPage) => void;
}) {
  const todayDecisions = todayItems.filter(item => ['scenario', 'counterfactual', 'solver-corpus', 'transfer'].includes(item.trainingType || '')).length;
  const progress = Math.min(100, dailyGoal ? Math.round(todayDecisions / dailyGoal * 100) : 0);
  const topWeakness = weaknesses[0];
  const nextBest = dailyPlan.items[0]?.scenario;
  return <div className="space-y-6">
    <section className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(15,23,42,0.5)_55%)] p-6 md:p-9" data-testid="volume-first-home"><div className="grid items-center gap-8 lg:grid-cols-[1fr_320px]"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400"><Sparkles className="h-4 w-4" />只管打牌</div><h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-white md:text-4xl">{todayDecisions ? '繼續訓練' : '開始今天第一手'}</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">你只做 Fold / Call / Raise 等決策。錯題、到期複習、相似變化題、陌生題與漏點排序全部由系統在背景安排；沒有可靠 truth 的題目不會硬評分。</p><button data-testid="start-auto-table" type="button" onClick={onStart} className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-emerald-950"><Play className="h-4 w-4 fill-current" />{todayDecisions ? '繼續打' : '開始打牌'}</button></div><div className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-5"><div className="flex items-center justify-between text-xs text-slate-500"><span>今日決策</span><span className="font-mono">{todayDecisions}/{dailyGoal}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div><div className="mt-5 text-xs text-slate-500">系統目前會稍微多出</div><div className="mt-2 text-base font-semibold text-slate-100">{topWeakness?.key || nextBest?.title || '建立你的第一批實戰資料'}</div><p className="mt-2 text-xs leading-5 text-slate-500">不用選模式。系統會依出現頻率、近期錯誤、複習時機與可驗證 evidence 自動調整。</p></div></div></section>
    <section className="grid gap-4 md:grid-cols-4"><MetricCard icon={<Target className="h-5 w-5" />} label="本週正確率" value={`${accuracy(weekItems)}%`} detail={`${weekItems.length} 個決策`} /><MetricCard icon={<CalendarClock className="h-5 w-5" />} label="待複習" value={`${dueCount}`} detail="會自動混入後續牌局" /><MetricCard icon={<Clock3 className="h-5 w-5" />} label="延遲留存" value={`${metrics.delayedRetention}%`} detail="隔一段時間仍會" /><MetricCard icon={<Brain className="h-5 w-5" />} label="已掌握" value={`${metrics.masteredNodes}`} detail="能在變化情境使用" /></section>
    <Panel title="目前最大漏點" subtitle="系統已把它納入後續出題權重" action="看進度" onAction={() => onNavigate('analysis')}>{topWeakness ? <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-amber-500/10 font-mono font-bold text-amber-300">{topWeakness.mastery}%</div><div><div className="font-semibold text-slate-100">{topWeakness.key}</div><div className="mt-1 text-sm text-slate-500">{topWeakness.total} 次觀測。你不用另外開工具，接下來的訓練會自動增加相關 spot。</div></div></div> : <EmptyState text="先打一些牌；系統會自己找出最值得修的 leak。" />}</Panel>
  </div>;
}

function TrainPage({ relevant, onStart }: { relevant: Scenario[]; onStart: () => void }) {
  return <div className="space-y-6"><section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/6 p-7 md:p-10" data-testid="volume-training-page"><div className="max-w-3xl"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">無限訓練桌</div><h2 className="mt-3 text-3xl font-bold">不要選工具，直接打下一手</h2><p className="mt-3 text-sm leading-7 text-slate-300">系統會從符合你玩家設定的 {relevant.length} 個情境中持續出題，並根據你的錯誤、到期複習與學習價值動態重排。正確決策快速通過；真正的 leak 才停下來說明。</p><button data-testid="start-volume-session" type="button" onClick={onStart} className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-500 px-7 py-4 text-base font-bold text-emerald-950"><Play className="h-5 w-5 fill-current" />開始訓練桌</button></div></section><section className="grid gap-4 md:grid-cols-3"><SimplePromise title="自動出題" text="常見 spot、弱點、複習與 transfer 自動混合。" /><SimplePromise title="自動判定" text="能 exact grade 才算錯；資料不足直接 Unknown。" /><SimplePromise title="自動修正" text="錯誤會改變後續題目權重，不需要手動挑反事實或 Solver 工具。" /></section></div>;
}

function ProgressPage({ history, metrics, weaknesses, mastery, dueCount, onStart }: { history: HistoryItem[]; metrics: ReturnType<typeof getLearningMetrics>; weaknesses: WeaknessInsight[]; mastery: ReturnType<typeof calculateMastery>; dueCount: number; onStart: () => void }) {
  const recent = [...history].sort((a, b) => b.timestamp - a.timestamp).slice(0, 12);
  const topWeakness = weaknesses[0];
  return <div className="space-y-6" data-testid="player-progress"><section className="grid gap-4 md:grid-cols-4"><MetricCard icon={<CalendarClock className="h-5 w-5" />} label="待複習" value={`${dueCount}`} detail="系統會自動插入" /><MetricCard icon={<Clock3 className="h-5 w-5" />} label="延遲留存" value={`${metrics.delayedRetention}%`} detail="過一段時間仍會" /><MetricCard icon={<Brain className="h-5 w-5" />} label="Transfer" value={`${metrics.transferScore}%`} detail="換情境仍會" /><MetricCard icon={<BarChart3 className="h-5 w-5" />} label="已掌握" value={`${mastery.filter(item => item.status === 'mastered').length}`} detail="穩定能力節點" /></section>
    <Panel title="下一個最值得修的地方" subtitle="你不用設定訓練法，系統會直接把它排進牌局">{topWeakness ? <div className="rounded-2xl border border-amber-500/20 bg-amber-500/6 p-5"><div className="text-xs text-amber-300">目前最大 leak</div><div className="mt-2 text-2xl font-bold">{topWeakness.key}</div><div className="mt-2 text-sm text-slate-400">掌握 {topWeakness.mastery}% · {topWeakness.total} 次觀測 · 樣本信心 {topWeakness.sampleConfidence}%</div><p className="mt-4 text-sm leading-6 text-slate-300">後續訓練已自動提高這類 spot、相近 decision boundary 與到期複習的權重。</p></div> : <EmptyState text="資料還不夠。繼續打牌即可，系統會自動形成 leak 排序。" />}<button type="button" onClick={onStart} className="mt-4 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-emerald-950">繼續訓練</button></Panel>
    <section className="grid gap-6 lg:grid-cols-2"><Panel title="依主題掌握度" subtitle="只顯示結果，不要求手動診斷"><BarList items={weaknesses.map(item => ({ key: item.key, total: item.total, accuracy: item.mastery }))} /></Panel><Panel title="最近決策" subtitle="正常牌局、複習與自動 transfer 都在同一條時間線"><div className="divide-y divide-slate-800">{recent.length ? recent.map(item => <div key={item.attemptId || `${item.scenarioId}-${item.timestamp}`} className="flex items-center gap-4 py-3"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${isHistoryCorrect(item) ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>{isHistoryCorrect(item) ? <CheckCircle2 className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate-200">{item.questionLabel || item.scenarioId}</div><div className="mt-0.5 text-xs text-slate-500">{item.street || 'Decision'} · {item.isDelayedReview ? '自動複習' : item.isTransferTest ? '自動變化題' : '一般決策'}</div></div><div className="font-mono text-sm">{item.score * 10}</div></div>) : <EmptyState text="尚無訓練紀錄。" />}</div></Panel></section>
  </div>;
}

function SimplePromise({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="font-semibold text-slate-100">{title}</div><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>; }
function MetricCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="flex items-center gap-2 text-sm text-slate-400">{icon}{label}</div><div className="mt-3 font-mono text-3xl font-bold tracking-tight text-white">{value}</div><div className="mt-1 text-xs text-slate-500">{detail}</div></div>; }
function Panel({ title, subtitle, children, action, onAction }: { title: string; subtitle?: string; children: ReactNode; action?: string; onAction?: () => void }) { return <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><h3 className="font-semibold">{title}</h3>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div>{action && <button type="button" onClick={onAction} className="text-xs font-semibold text-emerald-400">{action}</button>}</div>{children}</section>; }
function BarList({ items }: { items: Array<{ key: string; total: number; accuracy: number }> }) { return <div className="space-y-4">{items.length ? items.slice(0, 8).map(item => <div key={item.key}><div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-400">{item.key}</span><span className="font-mono">{item.accuracy}% · {item.total}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${item.accuracy >= 80 ? 'bg-emerald-500' : item.accuracy >= 60 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${item.accuracy}%` }} /></div></div>) : <EmptyState text="尚無足夠資料。" />}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-slate-800 px-5 py-8 text-center text-sm text-slate-500">{text}</div>; }
function accuracy(items: HistoryItem[]): number { return items.length ? Math.round(items.filter(isHistoryCorrect).length / items.length * 100) : 0; }
function startOfLocalDay(now: number): number { const date = new Date(now); date.setHours(0, 0, 0, 0); return date.getTime(); }
