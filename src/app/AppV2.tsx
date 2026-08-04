import { ChangeEvent, lazy, ReactNode, Suspense, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, BarChart3, BookOpen, Brain, CalendarClock, CheckCircle2, ChevronRight,
  Clock3, Download, Flame, Layers3, Play, RotateCcw, Sparkles, Star, Target, Upload, X,
} from 'lucide-react';
import { scenarios } from '../data';
import { HistoryItem, Scenario } from '../types';
import { summarizeBy } from '../utils/analytics';
import { exportTrainingData, importTrainingData, loadHistory, saveHistory } from '../utils/history';
import { AppPage, AppShell } from './AppShell';
import { buildDailyTrainingPlan, getDueScenarioIds, TrainingReason } from '../features/training/sessionPlanner';
import { TrainingSession } from '../features/training/TrainingSession';
import { StrategyExplorer } from '../features/strategy/StrategyExplorer';

const LegacyApp = lazy(() => import('../App'));

interface ActiveSession {
  title: string;
  scenarios: Scenario[];
}

const REASON_LABELS: Record<TrainingReason, string> = {
  'due-review': '到期複習',
  'weak-area': '弱點強化',
  'recent-mistake': '最近答錯',
  new: '新題',
  mixed: '綜合混合',
};

export default function AppV2() {
  const [page, setPage] = useState<AppPage>('today');
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [starredIds, setStarredIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('poker_starred_ids') || '[]'); } catch { return []; }
  });
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const dailyPlan = useMemo(() => buildDailyTrainingPlan(scenarios, history, 12), [history]);
  const dueIds = useMemo(() => getDueScenarioIds(history), [history]);
  const dueScenarios = useMemo(() => dueIds.map(id => scenarios.find(scenario => scenario.id === id)).filter((scenario): scenario is Scenario => Boolean(scenario)), [dueIds]);
  const weakStats = useMemo(() => summarizeBy(history, item => item.category?.[0]).filter(item => item.total >= 2).slice(0, 6), [history]);
  const overallAccuracy = getAccuracy(history);
  const weekItems = history.filter(item => item.timestamp >= Date.now() - 7 * 86400000 && item.trainingType !== 'custom');
  const weekAccuracy = getAccuracy(weekItems);
  const streak = getTrainingStreak(history);

  const changePage = (next: AppPage) => {
    setActiveSession(null);
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startSession = (title: string, selected: Scenario[]) => {
    const unique = [...new Map(selected.map(scenario => [scenario.id, scenario])).values()];
    if (unique.length === 0) {
      setNotice('目前沒有符合條件的題目。');
      return;
    }
    setNotice(null);
    setActiveSession({ title, scenarios: unique });
    setPage('train');
    window.scrollTo({ top: 0 });
  };

  const recordHistory = (item: HistoryItem) => {
    setHistory(previous => {
      const updated = [...previous, item];
      saveHistory(updated);
      return updated;
    });
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const imported = await importTrainingData(file);
      setHistory(imported.history);
      setStarredIds(imported.starredIds);
      setNotice(`已匯入 ${imported.history.length} 筆訓練紀錄。`);
    } catch {
      setNotice('匯入失敗：檔案格式不正確。');
    }
  };

  if (legacyOpen) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="sticky top-0 z-[100] flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4 py-3 text-slate-100 backdrop-blur">
          <div><div className="text-sm font-semibold">進階工具／舊版完整功能</div><div className="text-xs text-slate-500">原功能保留，方便逐步遷移與比對</div></div>
          <button type="button" onClick={() => setLegacyOpen(false)} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs hover:bg-slate-800"><X className="h-4 w-4" />返回系統介面</button>
        </div>
        <Suspense fallback={<div className="grid min-h-[60vh] place-items-center text-slate-500">載入進階工具…</div>}><LegacyApp /></Suspense>
      </div>
    );
  }

  return (
    <AppShell page={page} onPageChange={changePage} onOpenLegacy={() => setLegacyOpen(true)}>
      {notice && <div className="mb-5 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-200"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}><X className="h-4 w-4" /></button></div>}

      {activeSession ? (
        <TrainingSession
          title={activeSession.title}
          scenarios={activeSession.scenarios}
          history={history}
          onRecord={recordHistory}
          onExit={() => setActiveSession(null)}
          onComplete={() => { setActiveSession(null); setPage('today'); }}
        />
      ) : (
        <>
          {page === 'today' && <TodayPage dailyPlan={dailyPlan} dueCount={dueScenarios.length} weakStats={weakStats} weekAccuracy={weekAccuracy} weekCount={weekItems.length} streak={streak} onStart={() => startSession('今日綜合訓練', dailyPlan.items.map(item => item.scenario))} onReview={() => startSession('到期複習', dueScenarios)} onNavigate={changePage} />}
          {page === 'train' && <TrainPage history={history} onStart={startSession} />}
          {page === 'review' && <ReviewPage dueScenarios={dueScenarios} weakStats={weakStats} starredIds={starredIds} onStart={startSession} />}
          {page === 'learn' && <LearnPage />}
          {page === 'analysis' && <AnalysisPage history={history} overallAccuracy={overallAccuracy} weekAccuracy={weekAccuracy} weakStats={weakStats} onOpenLegacy={() => setLegacyOpen(true)} onExport={() => exportTrainingData(history, starredIds)} onImport={() => importRef.current?.click()} />}
        </>
      )}

      <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => { handleImport(event.target.files?.[0]); event.currentTarget.value = ''; }} />
    </AppShell>
  );
}

function TodayPage({ dailyPlan, dueCount, weakStats, weekAccuracy, weekCount, streak, onStart, onReview, onNavigate }: {
  dailyPlan: ReturnType<typeof buildDailyTrainingPlan>;
  dueCount: number;
  weakStats: ReturnType<typeof summarizeBy>;
  weekAccuracy: number;
  weekCount: number;
  streak: number;
  onStart: () => void;
  onReview: () => void;
  onNavigate: (page: AppPage) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(15,23,42,0.5)_55%)] p-6 md:p-9">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400"><Sparkles className="h-4 w-4" />今日最佳行動</div>
            <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-white md:text-4xl">完成 12 題個人化訓練</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">依到期複習、薄弱主題、最近錯題與新題自動組合。你不需要再手動決定今天該練什麼。</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={onStart} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-emerald-950 shadow-lg shadow-emerald-950/30 hover:bg-emerald-400"><Play className="h-4 w-4 fill-current" />開始今日訓練</button>
              <button type="button" onClick={() => onNavigate('train')} className="rounded-xl border border-slate-700 bg-slate-950/35 px-5 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-900">選擇專項</button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-5">
            <div className="flex items-center justify-between"><span className="text-sm font-semibold">今日組成</span><span className="text-xs text-slate-500">約 10 分鐘</span></div>
            <div className="mt-4 space-y-3">
              {(Object.entries(dailyPlan.counts) as Array<[TrainingReason, number]>).filter(([, count]) => count > 0).map(([reason, count]) => (
                <div key={reason} className="flex items-center justify-between text-sm"><span className="text-slate-400">{REASON_LABELS[reason]}</span><span className="font-mono font-semibold text-slate-100">{count} 題</span></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<Target className="h-5 w-5" />} label="本週正確率" value={`${weekAccuracy}%`} detail={`${weekCount} 個決策`} />
        <MetricCard icon={<CalendarClock className="h-5 w-5" />} label="待複習" value={`${dueCount}`} detail="已到期或最近答錯" action={dueCount > 0 ? '立即複習' : undefined} onAction={onReview} />
        <MetricCard icon={<Flame className="h-5 w-5" />} label="連續訓練" value={`${streak} 天`} detail="保持短而穩定的節奏" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel title="目前弱點" subtitle="優先改善最低正確率的主題" action="查看全部" onAction={() => onNavigate('review')}>
          <div className="space-y-3">
            {weakStats.length ? weakStats.slice(0, 4).map(item => (
              <div key={item.key} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-mono text-sm font-bold ${item.accuracy < 60 ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-300'}`}>{item.accuracy}%</div>
                <div className="min-w-0 flex-1"><div className="font-semibold text-slate-200">{item.key}</div><div className="mt-1 text-xs text-slate-500">累積 {item.total} 次決策</div></div>
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </div>
            )) : <EmptyState text="完成幾次訓練後，系統會自動找出你的薄弱主題。" />}
          </div>
        </Panel>

        <Panel title="系統狀態" subtitle="從功能集合轉為學習閉環">
          <div className="space-y-4">
            <SystemStep done title="每日規劃" text="自動組合複習、弱點、新題" />
            <SystemStep done title="專注作答" text="單一決策畫面，移除無關側欄" />
            <SystemStep done title="間隔複習" text="依表現調整下一次出題時間" />
            <SystemStep done title="Strategy Engine v2" text="情境、版本、頻率、來源可追溯" />
          </div>
        </Panel>
      </section>
    </div>
  );
}

function TrainPage({ history, onStart }: { history: HistoryItem[]; onStart: (title: string, scenarios: Scenario[]) => void }) {
  const modes = [
    { title: '今日綜合訓練', description: '由系統根據複習與弱點自動選題', icon: <Sparkles className="h-6 w-6" />, items: buildDailyTrainingPlan(scenarios, history, 12).items.map(item => item.scenario), featured: true },
    { title: '翻前決策', description: '開牌、跟注、3-Bet 與短碼策略', icon: <Layers3 className="h-6 w-6" />, items: scenarios.filter(s => s.steps.some(step => step.street === 'Preflop')).slice(0, 20) },
    { title: '翻後決策', description: 'Flop、Turn、River 的價值與詐唬', icon: <Brain className="h-6 w-6" />, items: scenarios.filter(s => s.steps.some(step => step.street !== 'Preflop')).slice(0, 20) },
    { title: '錦標賽短碼', description: 'ICM、重偷、Push/Fold 與生存價值', icon: <Target className="h-6 w-6" />, items: scenarios.filter(s => s.type === 'Tournament' || s.category?.some(c => /ICM|短碼|錦標賽/.test(c))).slice(0, 20) },
    { title: '數學與 SPR', description: '底池賠率、SPR、組合與下注尺寸', icon: <BarChart3 className="h-6 w-6" />, items: scenarios.filter(s => s.category?.some(c => /SPR|賠率|數學|尺寸/.test(c)) || s.steps.some(step => step.spr !== undefined || step.potOdds)).slice(0, 20) },
    { title: '隨機 20 題', description: '跨主題檢查整體決策穩定度', icon: <RotateCcw className="h-6 w-6" />, items: [...scenarios].sort(() => Math.random() - 0.5).slice(0, 20) },
  ];
  return (
    <div>
      <div className="mb-6 max-w-2xl"><h2 className="text-2xl font-semibold">選擇訓練模式</h2><p className="mt-2 text-sm leading-relaxed text-slate-400">預設使用系統推薦。需要針對特定主題時，再進入專項訓練。</p></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modes.map(mode => <ModeCard key={mode.title} {...mode} onClick={() => onStart(mode.title, mode.items)} />)}
      </div>
    </div>
  );
}

function ReviewPage({ dueScenarios, weakStats, starredIds, onStart }: { dueScenarios: Scenario[]; weakStats: ReturnType<typeof summarizeBy>; starredIds: string[]; onStart: (title: string, scenarios: Scenario[]) => void }) {
  const wrong = scenarios.filter(scenario => dueScenarios.some(item => item.id === scenario.id));
  const starred = scenarios.filter(scenario => starredIds.includes(scenario.id));
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReviewBucket icon={<CalendarClock className="h-5 w-5" />} title="今日到期" count={dueScenarios.length} description="依間隔複習排程" onClick={() => onStart('今日到期複習', dueScenarios)} />
        <ReviewBucket icon={<RotateCcw className="h-5 w-5" />} title="答錯題" count={wrong.length} description="尚未穩定答對" onClick={() => onStart('錯題重練', wrong)} />
        <ReviewBucket icon={<Star className="h-5 w-5" />} title="收藏題" count={starred.length} description="你主動標記的情境" onClick={() => onStart('收藏題複習', starred)} />
        <ReviewBucket icon={<Target className="h-5 w-5" />} title="薄弱主題" count={weakStats.filter(item => item.accuracy < 80).length} description="正確率低於 80%" onClick={() => weakStats[0] && onStart(`${weakStats[0].key} 強化`, scenarios.filter(s => s.category?.includes(weakStats[0].key)))} />
      </section>

      <Panel title="薄弱主題排序" subtitle="以正確率優先，再考慮樣本數">
        <div className="grid gap-3 md:grid-cols-2">
          {weakStats.length ? weakStats.map(item => {
            const items = scenarios.filter(scenario => scenario.category?.includes(item.key));
            return (
              <button key={item.key} type="button" onClick={() => onStart(`${item.key} 強化`, items)} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/30 p-4 text-left transition hover:border-slate-700 hover:bg-slate-900">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-900 font-mono text-sm font-bold text-amber-300">{item.accuracy}%</div>
                <div className="min-w-0 flex-1"><div className="font-semibold text-slate-200">{item.key}</div><div className="mt-1 text-xs text-slate-500">{item.total} 次紀錄 · 題庫 {items.length} 題</div></div>
                <ArrowRight className="h-4 w-4 text-slate-600" />
              </button>
            );
          }) : <EmptyState text="還沒有足夠的歷史資料可診斷弱點。" />}
        </div>
      </Panel>
    </div>
  );
}

function LearnPage() {
  return (
    <div className="space-y-6">
      <StrategyExplorer />
      <section className="grid gap-4 md:grid-cols-3">
        <LearningCard title="底池賠率" description="把跟注成本轉換為最低所需勝率。" status="規劃中" />
        <LearningCard title="SPR 決策" description="依底池與有效籌碼理解承諾程度。" status="題庫已支援" />
        <LearningCard title="Blocker 組合" description="從牌型名稱進一步理解組合削減。" status="Engine v2" />
      </section>
    </div>
  );
}

function AnalysisPage({ history, overallAccuracy, weekAccuracy, weakStats, onOpenLegacy, onExport, onImport }: {
  history: HistoryItem[];
  overallAccuracy: number;
  weekAccuracy: number;
  weakStats: ReturnType<typeof summarizeBy>;
  onOpenLegacy: () => void;
  onExport: () => void;
  onImport: () => void;
}) {
  const byStreet = summarizeBy(history, item => item.street);
  const recent = [...history].sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<Target className="h-5 w-5" />} label="總正確率" value={`${overallAccuracy}%`} detail={`${history.length} 筆歷史紀錄`} />
        <MetricCard icon={<BarChart3 className="h-5 w-5" />} label="本週正確率" value={`${weekAccuracy}%`} detail="最近 7 天" />
        <MetricCard icon={<Clock3 className="h-5 w-5" />} label="平均思考" value={`${averageDuration(history)} 秒`} detail="有記錄時間的決策" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="依街道" subtitle="找出決策流程中的瓶頸">
          <BarList items={byStreet} />
        </Panel>
        <Panel title="依主題" subtitle="最低正確率排在最前">
          <BarList items={weakStats} />
        </Panel>
      </section>

      <Panel title="最近紀錄" subtitle="只保留有助於下一步行動的資訊">
        <div className="divide-y divide-slate-800">
          {recent.length ? recent.map(item => (
            <div key={item.attemptId || `${item.scenarioId}-${item.timestamp}`} className="flex items-center gap-4 py-3">
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${item.score >= 8 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>{item.score >= 8 ? <CheckCircle2 className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}</div>
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate-200">{item.questionLabel || `情境 ${item.scenarioId}`}</div><div className="mt-0.5 text-xs text-slate-500">{item.street || 'Preflop'} · {item.position || '-'} · {new Date(item.timestamp).toLocaleDateString('zh-TW')}</div></div>
              <div className="font-mono text-sm font-semibold text-slate-300">{item.score * 10}</div>
            </div>
          )) : <EmptyState text="尚無訓練紀錄。" />}
        </div>
      </Panel>

      <section className="grid gap-4 md:grid-cols-3">
        <UtilityCard icon={<Download className="h-5 w-5" />} title="匯出備份" description="下載歷史與收藏 JSON" onClick={onExport} />
        <UtilityCard icon={<Upload className="h-5 w-5" />} title="匯入備份" description="從其他裝置恢復資料" onClick={onImport} />
        <UtilityCard icon={<Brain className="h-5 w-5" />} title="進階工具" description="自訂牌局與 AI 教練仍保留" onClick={onOpenLegacy} />
      </section>
    </div>
  );
}

function MetricCard({ icon, label, value, detail, action, onAction }: { icon: ReactNode; label: string; value: string; detail: string; action?: string; onAction?: () => void }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="flex items-center gap-2 text-sm text-slate-400">{icon}{label}</div><div className="mt-3 font-mono text-3xl font-bold tracking-tight text-white">{value}</div><div className="mt-1 flex items-center justify-between text-xs text-slate-500"><span>{detail}</span>{action && <button type="button" onClick={onAction} className="font-semibold text-emerald-400 hover:text-emerald-300">{action}</button>}</div></div>;
}

function Panel({ title, subtitle, children, action, onAction }: { title: string; subtitle?: string; children: ReactNode; action?: string; onAction?: () => void }) {
  return <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 md:p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><h3 className="font-semibold text-slate-100">{title}</h3>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div>{action && <button type="button" onClick={onAction} className="text-xs font-semibold text-emerald-400">{action}</button>}</div>{children}</section>;
}

function ModeCard({ title, description, icon, items, featured, onClick }: { title: string; description: string; icon: ReactNode; items: Scenario[]; featured?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`group rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-xl ${featured ? 'border-emerald-500/30 bg-emerald-500/8 hover:border-emerald-500/50' : 'border-slate-800 bg-slate-900/55 hover:border-slate-700'}`}><div className={`grid h-11 w-11 place-items-center rounded-xl ${featured ? 'bg-emerald-500 text-emerald-950' : 'bg-slate-800 text-slate-300'}`}>{icon}</div><h3 className="mt-5 font-semibold text-slate-100">{title}</h3><p className="mt-2 min-h-10 text-sm leading-relaxed text-slate-500">{description}</p><div className="mt-5 flex items-center justify-between text-xs"><span className="text-slate-500">{items.length} 題</span><span className="flex items-center gap-1 font-semibold text-emerald-400">開始<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></div></button>;
}

function ReviewBucket({ icon, title, count, description, onClick }: { icon: ReactNode; title: string; count: number; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 text-left transition hover:border-slate-700 hover:bg-slate-900"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-800 text-slate-300">{icon}</span><span className="font-mono text-3xl font-bold text-white">{count}</span></div><h3 className="mt-4 font-semibold text-slate-200">{title}</h3><p className="mt-1 text-xs text-slate-500">{description}</p></button>;
}

function LearningCard({ title, description, status }: { title: string; description: string; status: string }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><BookOpen className="h-5 w-5 text-blue-400" /><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p><span className="mt-4 inline-block rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">{status}</span></div>;
}

function UtilityCard({ icon, title, description, onClick }: { icon: ReactNode; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 text-left hover:border-slate-700 hover:bg-slate-900"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-800 text-emerald-400">{icon}</span><span><span className="block font-semibold text-slate-200">{title}</span><span className="mt-1 block text-xs text-slate-500">{description}</span></span></button>;
}

function SystemStep({ done, title, text }: { done: boolean; title: string; text: string }) {
  return <div className="flex gap-3"><div className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${done ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}><CheckCircle2 className="h-4 w-4" /></div><div><div className="text-sm font-semibold text-slate-200">{title}</div><div className="mt-0.5 text-xs text-slate-500">{text}</div></div></div>;
}

function BarList({ items }: { items: Array<{ key: string; total: number; accuracy: number }> }) {
  return <div className="space-y-4">{items.length ? items.slice(0, 7).map(item => <div key={item.key}><div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-400">{item.key}</span><span className="font-mono text-slate-300">{item.accuracy}% · {item.total}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${item.accuracy >= 80 ? 'bg-emerald-500' : item.accuracy >= 60 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${item.accuracy}%` }} /></div></div>) : <EmptyState text="尚無足夠資料。" />}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-800 px-5 py-8 text-center text-sm text-slate-500">{text}</div>;
}

function getAccuracy(items: HistoryItem[]): number {
  const relevant = items.filter(item => item.trainingType !== 'custom');
  if (!relevant.length) return 0;
  return Math.round(relevant.filter(item => item.score >= 8).length / relevant.length * 100);
}

function averageDuration(items: HistoryItem[]): string {
  const durations = items.map(item => item.durationMs).filter((value): value is number => typeof value === 'number' && value > 0);
  if (!durations.length) return '0.0';
  return (durations.reduce((sum, value) => sum + value, 0) / durations.length / 1000).toFixed(1);
}

function getTrainingStreak(items: HistoryItem[]): number {
  const days = new Set(items.map(item => new Date(item.timestamp).toLocaleDateString('en-CA')));
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toLocaleDateString('en-CA');
    if (!days.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
