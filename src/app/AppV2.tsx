import { ReactNode, useMemo, useState } from 'react';
import { BarChart3, Brain, CalendarClock, CheckCircle2, Clock3, Gauge, Infinity as InfinityIcon, Play, Target, TimerReset } from 'lucide-react';
import { scenarios } from '../data';
import { HistoryItem, PlayerProfile, Scenario } from '../types';
import { AppPage, AppShell } from './AppShell';
import { SituationCoverageMatrix } from '../features/analysis/SituationCoverageMatrix';
import { TrainingSession } from '../features/training/TrainingSession';
import { CurriculumPanel } from '../features/training/CurriculumPanel';
import { InfiniteTrainingTable } from '../features/training/InfiniteTrainingTable';
import { Onboarding } from '../features/onboarding/Onboarding';
import { SettingsDrawer } from '../features/settings/SettingsDrawer';
import { loadPlayerProfile, savePlayerProfile } from '../domain/playerProfile';
import { calculateMastery, currentDueReviews, getLearningMetrics, getWeaknessInsights, isHistoryCorrect, WeaknessInsight } from '../learning-engine';
import { historyForTrainingTrack, loadTrainingTrack, saveTrainingTrack, TrainingTrack, trainingTrackLabel, trainingTrackCoverageCatalog } from '../domain/trainingTrack';
import { exactMathEvaluationScenarios } from '../teaching/evaluationMathScenarios';
import { tournamentEvaluationScenarios } from '../teaching/tournamentMathScenarios';
import { adaptiveCalibrationReport, buildKnowledgeStates, SkillKnowledgeState, verifiedEvNorthStar, VerifiedEvNorthStar } from '../learning-engine/closedLoop';
import { loadHistory, persistHistoryItem, TrainingBackup, updateHistoryCoordinated, upsertHistoryItem } from '../utils/history';

const TRAINING_TYPES = new Set(['scenario', 'range', 'counterfactual', 'solver-corpus', 'transfer']);

export default function AppV2() {
  const [page, setPage] = useState<AppPage>('today');
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [profile, setProfile] = useState<PlayerProfile>(loadPlayerProfile);
  const [track, setTrack] = useState<TrainingTrack>(() => loadTrainingTrack(profile));
  const [starredIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('poker_starred_ids') || '[]'); } catch { return []; } });
  const [sessionOpen, setSessionOpen] = useState(false);
  const [lesson, setLesson] = useState<Scenario | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const trackHistory = useMemo(() => historyForTrainingTrack(history, track), [history, track]);
  const coverageCatalog = useMemo(() => trainingTrackCoverageCatalog(scenarios, [...exactMathEvaluationScenarios, ...tournamentEvaluationScenarios], track, profile), [track, profile]);
  const weaknesses = useMemo(() => getWeaknessInsights(trackHistory).slice(0, 8), [trackHistory]);
  const metrics = useMemo(() => getLearningMetrics(trackHistory), [trackHistory]);
  const mastery = useMemo(() => calculateMastery(trackHistory), [trackHistory]);
  const northStar = useMemo(() => verifiedEvNorthStar(trackHistory), [trackHistory]);
  const knowledge = useMemo(() => buildKnowledgeStates(trackHistory), [trackHistory]);
  const calibration = useMemo(() => adaptiveCalibrationReport(trackHistory), [trackHistory]);
  const dueCount = useMemo(() => currentDueReviews(trackHistory).length, [trackHistory]);
  const todayStart = startOfLocalDay(Date.now());
  const todayItems = trackHistory.filter(item => item.timestamp >= todayStart && TRAINING_TYPES.has(item.trainingType || ''));
  const weekItems = trackHistory.filter(item => item.timestamp >= Date.now() - 7 * 86400000 && TRAINING_TYPES.has(item.trainingType || ''));

  const changePage = (next: AppPage) => { setSessionOpen(false); setLesson(null); setPage(next); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const startInfinite = () => { setLesson(null); setSessionOpen(true); setPage('train'); window.scrollTo({ top: 0 }); };
  const startExam = () => { window.location.hash = '#exam-mode'; };
  const recordHistory = (item: HistoryItem) => {
    setHistory(previous => upsertHistoryItem(previous, item));
    void persistHistoryItem(item)
      .then(committed => setHistory(committed))
      .catch(() => setHistory(loadHistory()));
  };
  const completeOnboarding = (next: PlayerProfile) => { setProfile(savePlayerProfile(next)); if (!next.formats.includes(track)) setTrack(saveTrainingTrack(loadTrainingTrack(next))); setSessionOpen(false); setLesson(null); setOnboardingOpen(false); };
  const restoreBackup = (backup: TrainingBackup) => {
    setLesson(null);
    setSessionOpen(false);
    setHistory(backup.history);
    void updateHistoryCoordinated(() => backup.history)
      .then(committed => setHistory(committed))
      .catch(() => setHistory(loadHistory()));
    localStorage.setItem('poker_starred_ids', JSON.stringify(backup.starredIds || []));
    if (backup.playerProfile) { setProfile(savePlayerProfile(backup.playerProfile)); setTrack(saveTrainingTrack(loadTrainingTrack(backup.playerProfile))); }
  };

  return <AppShell page={page} onPageChange={changePage} onOpenSettings={() => setSettingsOpen(true)}>
    <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4" aria-label="訓練賽制"><div><div className="text-xs text-slate-400">目前訓練與進度</div><div className="mt-1 font-semibold">{trainingTrackLabel(track)}</div></div><div className="flex flex-wrap gap-2">{(['cash', 'tournament'] as const).map(value => <button key={value} data-testid={`track-${value}`} type="button" aria-pressed={track === value} disabled={!profile.formats.includes(value)} onClick={() => { setTrack(saveTrainingTrack(value)); setSessionOpen(false); setLesson(null); }} className={`rounded-xl border px-4 py-2 text-sm disabled:opacity-35 ${track === value ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200' : 'border-slate-700 text-slate-300'}`}>{trainingTrackLabel(value)}</button>)}<button onClick={() => setOnboardingOpen(true)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400">調整偏好</button></div><p className="w-full text-xs text-slate-500">{profile.tableSizes.join(' / ')} · {profile.stackBands.join(' / ')} BB · {profile.focusAreas.join(' / ')}。未啟用的賽制可在偏好中開啟；兩種賽制分開記錄進度。PokerBench 剩餘有效籌碼未知，只在全部籌碼區間都選取時納入。</p></section>
    {lesson ? <TrainingSession key={lesson.id} scenarios={[lesson]} history={trackHistory} title={lesson.title} onRecord={recordHistory} onExit={() => setLesson(null)} onComplete={() => setLesson(null)} /> : sessionOpen ? <InfiniteTrainingTable key={`${track}:${profile.updatedAt}`} track={track} profile={profile} scenarioBank={scenarios} history={trackHistory} onRecord={recordHistory} onExit={() => { setSessionOpen(false); setLesson(null); setPage('today'); }} /> : <>
      {page === 'today' && <TodayPage track={track} history={trackHistory} dailyGoal={profile.dailyQuestions} todayItems={todayItems} dueCount={dueCount} weaknesses={weaknesses} metrics={metrics} weekItems={weekItems} northStar={northStar} onStart={startInfinite} onNavigate={changePage} />}
      {page === 'train' && <TrainPage track={track} onStart={startInfinite} onExam={startExam} />}
      {(page === 'today' || page === 'train') && <div className="mt-6"><CurriculumPanel track={track} profile={profile} history={trackHistory} onStart={setLesson} onPreferences={() => setOnboardingOpen(true)} /></div>}
      {page === 'analysis' && <ProgressPage track={track} scenarioBank={coverageCatalog} history={trackHistory} metrics={metrics} weaknesses={weaknesses} mastery={mastery} dueCount={dueCount} northStar={northStar} knowledge={knowledge} calibration={calibration} onStart={startInfinite} onExam={startExam} />}
    </>}
    <SettingsDrawer open={settingsOpen} profile={profile} history={history} starredIds={starredIds} onClose={() => setSettingsOpen(false)} onEditProfile={() => { setSettingsOpen(false); setOnboardingOpen(true); }} onRestore={restoreBackup} />
    {onboardingOpen && <Onboarding initial={profile} onComplete={completeOnboarding} />}
  </AppShell>;
}

function TodayPage({ track, history, dailyGoal, todayItems, dueCount, weaknesses, metrics, weekItems, northStar, onStart, onNavigate }: {
  track: TrainingTrack; history: HistoryItem[]; dailyGoal: number; todayItems: HistoryItem[]; dueCount: number; weaknesses: WeaknessInsight[]; metrics: ReturnType<typeof getLearningMetrics>; weekItems: HistoryItem[]; northStar: VerifiedEvNorthStar; onStart: () => void; onNavigate: (page: AppPage) => void;
}) {
  const todayDecisions = todayItems.length;
  const progress = Math.min(100, dailyGoal ? Math.round(todayDecisions / dailyGoal * 100) : 0);
  const topWeakness = weaknesses[0];
  const evValue = northStar.recentAverageEvLossBB === undefined ? '待證據' : `${northStar.recentAverageEvLossBB.toFixed(3)} BB`;
  return <div className="space-y-6">
    <section className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(15,23,42,0.5)_55%)] p-6 md:p-9" data-testid="volume-first-home">
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_340px]"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400"><InfinityIcon className="h-4 w-4" />Closed-loop Infinite Trainer</div><h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-white md:text-4xl">{todayDecisions ? '繼續下一個學習決策' : '開始今天第一手'}</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">依目前賽制與偏好練習，結合弱點、待複習與情境覆蓋選下一題。用未見情境和延遲回想檢查學習；動作標籤、作者教材與精確算術分開解讀。</p><button data-testid="start-auto-table" type="button" onClick={onStart} className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-emerald-950"><Play className="h-4 w-4 fill-current" />{todayDecisions ? '繼續打' : '開始打牌'}</button></div>
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-5"><div className="flex items-center justify-between text-xs text-slate-500"><span>今日決策</span><span className="font-mono">{todayDecisions}/{dailyGoal}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div><div className="mt-5 text-xs text-slate-500">目前優先修正</div><div className="mt-2 text-base font-semibold text-slate-100">{topWeakness?.key || '先建立你的決策樣本'}</div><p className="mt-2 text-xs leading-5 text-slate-500">教材可能是條件式作者建議、明示假設的精確算術或資料集標籤；缺少的範圍、抽水與 EV 資訊會明示。</p></div></div>
    </section>
    <section className="grid gap-4 md:grid-cols-4"><TrackOutcome track={track} history={history} cashValue={evValue} cashDetail={northStar.recentSamples ? `最近完成測驗 · ${northStar.recentSamples} 個算術 EV 樣本` : "尚無現金桌算術評估；不代表完整實戰能力"} /><MetricCard icon={<CalendarClock className="h-5 w-5" />} label="待複習" value={`${dueCount}`} detail="會自動混入" /><MetricCard icon={<Clock3 className="h-5 w-5" />} label="延遲留存" value={metrics.delayedSamples ? `${metrics.delayedRetention}%` : "—"} detail="隔一段時間仍會" /><MetricCard icon={<Brain className="h-5 w-5" />} label="Transfer" value={metrics.transferSamples ? `${metrics.transferScore}%` : "—"} detail={`${accuracy(weekItems)}% 本週訓練正確率僅作輔助`} /></section>
    <CurriculumGuidance track={track} /><Panel title="目前最大漏點" subtitle="active-learning selector 會提高資訊增益較大的題目權重" action="看進度" onAction={() => onNavigate('analysis')}>{topWeakness ? <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-amber-500/10 font-mono font-bold text-amber-300">{topWeakness.mastery}%</div><div><div className="font-semibold text-slate-100">{topWeakness.key}</div><div className="mt-1 text-sm text-slate-500">{topWeakness.total} 次觀測；下一題不只看錯題率，也看 uncertainty、transfer 與 EV severity。</div></div></div> : <EmptyState text="先打一些牌，系統會建立 Knowledge State。" />}</Panel>
  </div>;
}

function TrainPage({ track, onStart, onExam }: { track: TrainingTrack; onStart: () => void; onExam: () => void }) {
  return <div className="space-y-6"><section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/6 p-7 md:p-10" data-testid="volume-training-page"><div className="max-w-4xl"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Truth-constrained active learning</div><h2 className="mt-3 text-3xl font-bold">每一題都要有學習價值，不只是不同</h2><p className="mt-3 text-sm leading-7 text-slate-300">Infinite Generator 現在把 candidate difficulty uncertainty、EV severity、transfer gap、due pressure、spot frequency 與 coverage novelty 一起納入排序。答完仍保留完整解說、Minimal Flip 與針對複習。</p><div className="mt-6 flex flex-wrap gap-3"><button data-testid="start-volume-session" type="button" onClick={onStart} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-7 py-4 text-base font-bold text-emerald-950"><Play className="h-5 w-5 fill-current" />開始無限牌局</button><button data-testid="start-exam-mode" type="button" onClick={onExam} className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 px-7 py-4 text-base font-bold text-amber-200"><TimerReset className="h-5 w-5" />Hidden Exam</button></div></div></section>
    <CurriculumGuidance track={track} /><section className="grid gap-4 md:grid-cols-3"><SimplePromise title="Active Learning" text="優先出能最大幅降低能力模型不確定性的題，而不是單純 miss-weighted 抽題。" /><SimplePromise title="Minimal Flip" text="只用 exact reversal 或 one-variable verified solver sibling 告訴你答案在哪裡翻轉。" /><SimplePromise title="Hidden Exam" text="holdout 題不給即時答案與工具，全部完成後才揭露結果。" /></section>
  </div>;
}

function ProgressPage({ track, scenarioBank, history, metrics, weaknesses, mastery, dueCount, northStar, knowledge, calibration, onStart, onExam }: { track: TrainingTrack; scenarioBank: Scenario[]; history: HistoryItem[]; metrics: ReturnType<typeof getLearningMetrics>; weaknesses: WeaknessInsight[]; mastery: ReturnType<typeof calculateMastery>; dueCount: number; northStar: VerifiedEvNorthStar; knowledge: SkillKnowledgeState[]; calibration: ReturnType<typeof adaptiveCalibrationReport>; onStart: () => void; onExam: () => void }) {
  const recent = [...history].filter(item => TRAINING_TYPES.has(item.trainingType || '') || item.examMode).sort((a, b) => b.timestamp - a.timestamp).slice(0, 12);
  const topKnowledge = knowledge[0];
  const evValue = northStar.recentAverageEvLossBB === undefined ? 'Unavailable' : `${northStar.recentAverageEvLossBB.toFixed(3)} BB`;
  const delta = northStar.deltaBBPerDecision;
  const roi = northStar.learningRoiBBPerHour;
  return <div className="space-y-6" data-testid="player-progress">
    <section className="grid gap-4 md:grid-cols-4"><TrackOutcome track={track} history={history} cashValue={evValue} cashDetail={delta === undefined ? "需要兩次已完成算術評估" : `${delta <= 0 ? "↓" : "↑"} ${Math.abs(delta).toFixed(3)} BB/decision vs 上次算術評估`} />{track === "cash" ? <MetricCard icon={<Target className="h-5 w-5" />} label="算術練習改善 / 時間" value={roi === undefined ? "Unavailable" : `${roi.toFixed(3)} BB/h`} detail="只測已驗證算術題；不代表實戰每小時收益" /> : <IcmCoverage history={history} />}<MetricCard icon={<Clock3 className="h-5 w-5" />} label="延遲留存" value={metrics.delayedSamples ? `${metrics.delayedRetention}%` : "—"} detail="延遲 retrieval" /><MetricCard icon={<Brain className="h-5 w-5" />} label="Transfer" value={metrics.transferSamples ? `${metrics.transferScore}%` : "—"} detail="陌生情境遷移" /></section>

    <Panel title="下一個最值得修的能力" subtitle="Knowledge State 同時看理解、保持、遷移、不確定性與 EV severity">{topKnowledge ? <div className="rounded-2xl border border-amber-500/20 bg-amber-500/6 p-5"><div className="text-xs text-amber-300">最高 Learning Priority</div><div className="mt-2 text-2xl font-bold">{topKnowledge.label}</div><div className="mt-3 grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6"><SmallMetric label="理解" value={`${topKnowledge.understanding}%`} /><SmallMetric label="Retention" value={formatPercent(topKnowledge.retention)} /><SmallMetric label="Transfer" value={formatPercent(topKnowledge.transfer)} /><SmallMetric label="Reasoning" value={formatPercent(topKnowledge.reasoning)} /><SmallMetric label="Uncertainty" value={`${Math.round(topKnowledge.uncertainty)}%`} /><SmallMetric label="Priority" value={`${topKnowledge.priority}%`} /></div></div> : <EmptyState text="目前還沒有足夠決策資料。" />}</Panel>

    <Panel title="Knowledge State / Skill Coverage" subtitle="理解、保持、遷移與 reasoning 分開估計；0 evidence 直接顯示 data gap"><div className="overflow-x-auto" data-testid="knowledge-state-matrix"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-slate-500"><tr><th className="pb-3">Skill</th><th>理解</th><th>Retention</th><th>Transfer</th><th>Reasoning</th><th>Evidence</th><th>Uncertainty</th><th>Priority</th></tr></thead><tbody className="divide-y divide-slate-800">{knowledge.slice(0, 12).map(state => <tr key={state.skillId}><td className="py-3 pr-4"><div className="font-medium text-slate-200">{state.label}</div>{state.dataGap && <span className="mt-1 inline-block rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">DATA GAP</span>}</td><td>{state.understanding}%</td><td>{formatPercent(state.retention)}</td><td>{formatPercent(state.transfer)}</td><td>{formatPercent(state.reasoning)}</td><td>{state.evidenceCount}</td><td>{Math.round(state.uncertainty)}%</td><td className="font-mono text-cyan-300">{state.priority}%</td></tr>)}</tbody></table></div></Panel>

    <SituationCoverageMatrix scenarioBank={scenarioBank} history={history} />

    <Panel title="Adaptive Calibration" subtitle="校準的是系統對『這題你會不會做對』的預測，不是 solver truth"><div data-testid="adaptive-calibration" className="grid gap-3 md:grid-cols-3"><SmallMetric label="Prediction samples" value={String(calibration.samples)} /><SmallMetric label="Brier score" value={calibration.brierScore === undefined ? 'Unavailable' : calibration.brierScore.toFixed(3)} /><SmallMetric label="Calibration error" value={calibration.calibrationError === undefined ? 'Unavailable' : calibration.calibrationError.toFixed(3)} /></div>{calibration.bins.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{calibration.bins.map(bin => <div key={bin.min} className="rounded-xl border border-slate-800 bg-slate-950/35 p-3"><div className="text-[10px] text-slate-500">{Math.round(bin.min * 100)}–{Math.round(bin.max * 100)}% · n={bin.samples}</div><div className="mt-1 font-mono text-xs">pred {Math.round(bin.predicted * 100)}% → actual {Math.round(bin.observed * 100)}%</div></div>)}</div>}</Panel>

    <Panel title="最近決策" subtitle={`待複習 ${dueCount} · 已掌握 ${mastery.filter(item => item.status === 'mastered').length} nodes`}>{recent.length ? <div className="divide-y divide-slate-800">{recent.map((item, index) => <div key={item.attemptId || `${item.timestamp}-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><div className="font-medium text-slate-200">{item.questionLabel || item.scenarioId}</div><div className="mt-1 text-xs text-slate-500">{item.street || '-'} · {item.position || '-'} · {item.selectedAction || '-'}{item.reasoningProbeResult ? ` · reasoning ${item.reasoningProbeResult}` : ''}</div></div><span className={`rounded-full px-2.5 py-1 text-xs ${isHistoryCorrect(item) ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>{isHistoryCorrect(item) ? '正確' : '需修正'}</span></div>)}</div> : <EmptyState text="還沒有決策紀錄。" />}</Panel>
    <div className="flex flex-wrap gap-3"><button type="button" onClick={onStart} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-emerald-950"><Play className="h-4 w-4 fill-current" />繼續下一手</button><button type="button" onClick={onExam} className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 px-6 py-3 font-semibold text-amber-200"><TimerReset className="h-4 w-4" />開始 Hidden Exam</button></div>
  </div>;
}

function TrackOutcome({ track, history, cashValue, cashDetail }: { track: TrainingTrack; history: HistoryItem[]; cashValue: string; cashDetail: string }) {
  const samples = history.filter(item => item.examMode && item.examCompletedAt);
  return track === 'cash'
    ? <MetricCard icon={<Gauge className="h-5 w-5" />} label="現金桌算術 EV 差距" value={cashValue} detail={cashDetail} />
    : <MetricCard icon={<Gauge className="h-5 w-5" />} label="錦標賽情境評估" value={samples.length ? `${accuracy(samples)}%` : '—'} detail={`${samples.length} 個已完成測驗樣本；僅代表題目明示假設下的判斷`} />;
}
function IcmCoverage({ history }: { history: HistoryItem[] }) {
  const samples = history.filter(item => item.examMode && item.examCompletedAt && item.utilityModel === 'icm');
  return <MetricCard icon={<Target className="h-5 w-5" />} label="ICM 評估覆蓋" value={String(samples.length)} detail="獨立列出 ICM 題目數；$EV、籌碼 EV 與 PKO 不混算" />;
}
function CurriculumGuidance({ track }: { track: TrainingTrack }) {
  return <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-5" data-testid="track-curriculum"><h3 className="font-semibold">{track === 'cash' ? '現金桌學習路線' : '錦標賽學習路線'}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{track === 'cash' ? '翻前開池範圍 → 3-Bet / 跟注 → BB 防守 → 翻後 range、下注尺度與河牌價格。先練你常玩的深度，再用未見題評估。' : '依有效籌碼分段 → Chip EV 推跟與價格 → ICM 風險 → 衛星賽生存價值 → PKO 賞金。先辨識目標函數，再選動作。'}</p><p className="mt-2 text-xs leading-5 text-slate-500">{track === 'cash' ? '作者情境是條件式教材；PokerBench 只提供特定基準的最佳動作標籤。算術 EV 題直接提供機率，不能證明讀 range、抽水適應或實戰盈利。' : 'MTT 算術題使用明示 equity、籌碼與獎金假設；不是完整推跟範圍 solver。ICM、衛星賽與 PKO 證據分開解讀，尚未覆蓋的情境不推定已掌握。'}</p></section>;
}
function MetricCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4"><div className="flex items-center gap-2 text-slate-500">{icon}<span className="text-xs">{label}</span></div><div className="mt-3 text-2xl font-bold text-slate-100">{value}</div><div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div></div>; }
function SmallMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3"><div className="text-[10px] text-slate-500">{label}</div><div className="mt-1 font-mono font-semibold text-slate-200">{value}</div></div>; }
function SimplePromise({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-5"><CheckCircle2 className="h-5 w-5 text-emerald-400" /><div className="mt-3 font-semibold">{title}</div><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>; }
function Panel({ title, subtitle, action, onAction, children }: { title: string; subtitle?: string; action?: string; onAction?: () => void; children: ReactNode }) { return <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-100">{title}</h3>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div>{action && onAction && <button type="button" onClick={onAction} className="text-xs font-semibold text-emerald-400">{action}</button>}</div>{children}</section>; }
function EmptyState({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-600">{text}</div>; }
function accuracy(items: HistoryItem[]): number { if (!items.length) return 0; return Math.round(items.filter(isHistoryCorrect).length / items.length * 100); }
function formatPercent(value: number | undefined): string { return value === undefined ? '—' : `${value}%`; }
function startOfLocalDay(timestamp: number): number { const date = new Date(timestamp); date.setHours(0, 0, 0, 0); return date.getTime(); }
