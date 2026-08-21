import { ReactNode, useMemo, useState } from 'react';
import { BarChart3, Brain, CalendarClock, CheckCircle2, Clock3, Infinity as InfinityIcon, Play, Sparkles, Target } from 'lucide-react';
import { scenarios } from '../data';
import { HistoryItem, PlayerProfile } from '../types';
import { AppPage, AppShell } from './AppShell';
import { InfiniteTrainingTable } from '../features/training/InfiniteTrainingTable';
import { Onboarding } from '../features/onboarding/Onboarding';
import { SettingsDrawer } from '../features/settings/SettingsDrawer';
import { loadPlayerProfile, savePlayerProfile } from '../domain/playerProfile';
import { calculateMastery, getLearningMetrics, getWeaknessInsights, isHistoryCorrect, WeaknessInsight } from '../learning-engine';
import { loadHistory, saveHistory, TrainingBackup } from '../utils/history';

const TRAINING_TYPES = new Set(['scenario', 'counterfactual', 'solver-corpus', 'transfer']);

export default function AppV2() {
  const [page, setPage] = useState<AppPage>('today');
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [profile, setProfile] = useState<PlayerProfile>(loadPlayerProfile);
  const [starredIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('poker_starred_ids') || '[]'); } catch { return []; } });
  const [sessionOpen, setSessionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const weaknesses = useMemo(() => getWeaknessInsights(history).slice(0, 8), [history]);
  const metrics = useMemo(() => getLearningMetrics(history), [history]);
  const mastery = useMemo(() => calculateMastery(history), [history]);
  const dueCount = useMemo(() => history.filter(item => TRAINING_TYPES.has(item.trainingType || '') && typeof item.nextReviewAt === 'number' && item.nextReviewAt <= Date.now()).length, [history]);
  const todayStart = startOfLocalDay(Date.now());
  const todayItems = history.filter(item => item.timestamp >= todayStart && TRAINING_TYPES.has(item.trainingType || ''));
  const weekItems = history.filter(item => item.timestamp >= Date.now() - 7 * 86400000 && TRAINING_TYPES.has(item.trainingType || ''));

  const changePage = (next: AppPage) => { setSessionOpen(false); setPage(next); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const startInfinite = () => { setSessionOpen(true); setPage('train'); window.scrollTo({ top: 0 }); };
  const recordHistory = (item: HistoryItem) => setHistory(previous => { const updated = [...previous, item]; saveHistory(updated); return updated; });
  const completeOnboarding = (next: PlayerProfile) => { setProfile(savePlayerProfile(next)); setOnboardingOpen(false); };
  const restoreBackup = (backup: TrainingBackup) => {
    saveHistory(backup.history); setHistory(backup.history);
    localStorage.setItem('poker_starred_ids', JSON.stringify(backup.starredIds || []));
    if (backup.playerProfile) setProfile(savePlayerProfile(backup.playerProfile));
  };

  return <AppShell page={page} onPageChange={changePage} onOpenSettings={() => setSettingsOpen(true)}>
    {sessionOpen ? <InfiniteTrainingTable scenarioBank={scenarios} history={history} onRecord={recordHistory} onExit={() => { setSessionOpen(false); setPage('today'); }} /> : <>
      {page === 'today' && <TodayPage dailyGoal={profile.dailyQuestions} todayItems={todayItems} dueCount={dueCount} weaknesses={weaknesses} metrics={metrics} weekItems={weekItems} onStart={startInfinite} onNavigate={changePage} />}
      {page === 'train' && <TrainPage onStart={startInfinite} />}
      {page === 'analysis' && <ProgressPage history={history} metrics={metrics} weaknesses={weaknesses} mastery={mastery} dueCount={dueCount} onStart={startInfinite} />}
    </>}
    <SettingsDrawer open={settingsOpen} profile={profile} history={history} starredIds={starredIds} onClose={() => setSettingsOpen(false)} onEditProfile={() => { setSettingsOpen(false); setOnboardingOpen(true); }} onRestore={restoreBackup} />
    {onboardingOpen && <Onboarding initial={profile} onComplete={completeOnboarding} />}
  </AppShell>;
}

function TodayPage({ dailyGoal, todayItems, dueCount, weaknesses, metrics, weekItems, onStart, onNavigate }: {
  dailyGoal: number; todayItems: HistoryItem[]; dueCount: number; weaknesses: WeaknessInsight[]; metrics: ReturnType<typeof getLearningMetrics>; weekItems: HistoryItem[]; onStart: () => void; onNavigate: (page: AppPage) => void;
}) {
  const todayDecisions = todayItems.length;
  const progress = Math.min(100, dailyGoal ? Math.round(todayDecisions / dailyGoal * 100) : 0);
  const topWeakness = weaknesses[0];
  return <div className="space-y-6">
    <section className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(15,23,42,0.5)_55%)] p-6 md:p-9" data-testid="volume-first-home">
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_340px]"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400"><InfinityIcon className="h-4 w-4" />Infinite Hand Generator</div><h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-white md:text-4xl">{todayDecisions ? '繼續下一手' : '開始今天第一手'}</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">這裡就是你的牌桌。216 個驗證情境、528 個策略等價變式，再加 PokerBench solver corpus 會自動混牌、去重、避開近期重複並依你的漏點調整。真實牌局與 HH 匯入已退出產品。</p><button data-testid="start-auto-table" type="button" onClick={onStart} className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-emerald-950"><Play className="h-4 w-4 fill-current" />{todayDecisions ? '繼續打' : '開始打牌'}</button></div>
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-5"><div className="flex items-center justify-between text-xs text-slate-500"><span>今日決策</span><span className="font-mono">{todayDecisions}/{dailyGoal}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div><div className="mt-5 text-xs text-slate-500">目前優先修正</div><div className="mt-2 text-base font-semibold text-slate-100">{topWeakness?.key || '先建立你的決策樣本'}</div><p className="mt-2 text-xs leading-5 text-slate-500">每個 decision 都會自動寫入 History。最佳解只取自已驗證題庫、策略等價 truth 或 PokerBench solver label。</p></div></div>
    </section>
    <section className="grid gap-4 md:grid-cols-4"><MetricCard icon={<Target className="h-5 w-5" />} label="本週正確率" value={`${accuracy(weekItems)}%`} detail={`${weekItems.length} 個決策`} /><MetricCard icon={<CalendarClock className="h-5 w-5" />} label="待複習" value={`${dueCount}`} detail="會自動混入" /><MetricCard icon={<Clock3 className="h-5 w-5" />} label="延遲留存" value={`${metrics.delayedRetention}%`} detail="隔一段時間仍會" /><MetricCard icon={<Brain className="h-5 w-5" />} label="已掌握" value={`${metrics.masteredNodes}`} detail="換情境仍能做對" /></section>
    <Panel title="目前最大漏點" subtitle="generator 已自動提高相關情境權重" action="看進度" onAction={() => onNavigate('analysis')}>{topWeakness ? <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-amber-500/10 font-mono font-bold text-amber-300">{topWeakness.mastery}%</div><div><div className="font-semibold text-slate-100">{topWeakness.key}</div><div className="mt-1 text-sm text-slate-500">{topWeakness.total} 次觀測；後續會自動增加相同 decision family 與鄰近 solver spot。</div></div></div> : <EmptyState text="先打一些牌，generator 會自己找出最值得修的地方。" />}</Panel>
  </div>;
}

function TrainPage({ onStart }: { onStart: () => void }) {
  return <div className="space-y-6"><section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/6 p-7 md:p-10" data-testid="volume-training-page"><div className="max-w-4xl"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Truth-constrained infinite table</div><h2 className="mt-3 text-3xl font-bold">各種情境，直接做最佳決策</h2><p className="mt-3 text-sm leading-7 text-slate-300">來源不是隨機亂造答案，而是三個有 ground truth 的池：216 scenarios、528 safe variants、PokerBench solver training corpus。系統會先 truth gate、再 exact presentation 去重、再做近期避碰與 leak-weighted sampling。</p><button data-testid="start-volume-session" type="button" onClick={onStart} className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-500 px-7 py-4 text-base font-bold text-emerald-950"><Play className="h-5 w-5 fill-current" />開始無限牌局</button></div></section>
    <section className="grid gap-4 md:grid-cols-3"><SimplePromise title="高變異" text="位置、stack、street、board、holding、action line、sizing 由 truth pool 自然覆蓋。" /><SimplePromise title="不重複" text="exact duplicate 先去掉；近期題目與 decision family 另外做 cooldown。" /><SimplePromise title="最佳解有來源" text="Curated contract / strategy-equivalent truth / PokerBench solver label，沒有就不出題。" /></section>
  </div>;
}

function ProgressPage({ history, metrics, weaknesses, mastery, dueCount, onStart }: { history: HistoryItem[]; metrics: ReturnType<typeof getLearningMetrics>; weaknesses: WeaknessInsight[]; mastery: ReturnType<typeof calculateMastery>; dueCount: number; onStart: () => void }) {
  const recent = [...history].filter(item => TRAINING_TYPES.has(item.trainingType || '')).sort((a, b) => b.timestamp - a.timestamp).slice(0, 12);
  const topWeakness = weaknesses[0];
  return <div className="space-y-6" data-testid="player-progress"><section className="grid gap-4 md:grid-cols-4"><MetricCard icon={<CalendarClock className="h-5 w-5" />} label="待複習" value={`${dueCount}`} detail="generator 自動插入" /><MetricCard icon={<Clock3 className="h-5 w-5" />} label="延遲留存" value={`${metrics.delayedRetention}%`} detail="過一段時間仍會" /><MetricCard icon={<Brain className="h-5 w-5" />} label="Transfer" value={`${metrics.transferScore}%`} detail="換牌面仍會" /><MetricCard icon={<BarChart3 className="h-5 w-5" />} label="已掌握" value={`${mastery.filter(item => item.status === 'mastered').length}`} detail="穩定能力節點" /></section>
    <Panel title="下一個最值得修的地方" subtitle="不用選訓練法，generator 直接提高它的抽樣機率">{topWeakness ? <div className="rounded-2xl border border-amber-500/20 bg-amber-500/6 p-5"><div className="text-xs text-amber-300">目前最大 leak</div><div className="mt-2 text-2xl font-bold">{topWeakness.key}</div><div className="mt-2 text-sm text-slate-400">掌握 {topWeakness.mastery}% · {topWeakness.total} 次觀測 · 樣本信心 {topWeakness.sampleConfidence}%</div></div> : <EmptyState text="目前還沒有足夠決策資料。" />}</Panel>
    <Panel title="最近決策" subtitle="每一個你在訓練桌做的 action 都會留下紀錄">{recent.length ? <div className="divide-y divide-slate-800">{recent.map((item, index) => <div key={item.attemptId || `${item.timestamp}-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><div className="font-medium text-slate-200">{item.questionLabel || item.scenarioId}</div><div className="mt-1 text-xs text-slate-500">{item.street || '-'} · {item.position || '-'} · {item.selectedAction || '-'}</div></div><span className={`rounded-full px-2.5 py-1 text-xs ${isHistoryCorrect(item) ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>{isHistoryCorrect(item) ? '正確' : '需修正'}</span></div>)}</div> : <EmptyState text="還沒有決策紀錄。" />}</Panel>
    <button type="button" onClick={onStart} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-emerald-950"><Play className="h-4 w-4 fill-current" />繼續下一手</button>
  </div>;
}

function MetricCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4"><div className="flex items-center gap-2 text-slate-500">{icon}<span className="text-xs">{label}</span></div><div className="mt-3 text-2xl font-bold text-slate-100">{value}</div><div className="mt-1 text-xs text-slate-500">{detail}</div></div>; }
function SimplePromise({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-5"><CheckCircle2 className="h-5 w-5 text-emerald-400" /><div className="mt-3 font-semibold">{title}</div><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>; }
function Panel({ title, subtitle, action, onAction, children }: { title: string; subtitle?: string; action?: string; onAction?: () => void; children: ReactNode }) { return <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-100">{title}</h3>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div>{action && onAction && <button type="button" onClick={onAction} className="text-xs font-semibold text-emerald-400">{action}</button>}</div>{children}</section>; }
function EmptyState({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-600">{text}</div>; }
function accuracy(items: HistoryItem[]): number { if (!items.length) return 0; return Math.round(items.filter(isHistoryCorrect).length / items.length * 100); }
function startOfLocalDay(timestamp: number): number { const date = new Date(timestamp); date.setHours(0, 0, 0, 0); return date.getTime(); }
