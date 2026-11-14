import React from 'react';
import type { HistoryItem, PlayerProfile, Scenario } from '../../types';
import { scenarioMatchesTrainingTrack, type TrainingTrack } from '../../domain/trainingTrack';
import { practicalCurriculum } from '../../teaching/practicalCurriculum';
import { tournamentTrainingScenarios } from '../../teaching/tournamentMathScenarios';
import { semanticTeachingScenarios } from '../../teaching/scenarioCatalog';

const courses = [...practicalCurriculum, ...semanticTeachingScenarios, ...tournamentTrainingScenarios];
export function CurriculumPanel({ track, profile, history, onStart, onPreferences }: {
  track:TrainingTrack; profile:PlayerProfile; history:HistoryItem[];
  onStart:(scenario:Scenario)=>void; onPreferences:()=>void;
}) {
  const all = courses.filter(s => (s.type === 'Tournament' ? 'tournament' : 'cash') === track);
  const available = all.filter(s => scenarioMatchesTrainingTrack(s, track, profile));
  const groups = new Map<string,Scenario[]>();
  for (const s of all) {
    const key = s.category?.[0] === '實戰課程' ? s.category[1] : s.category?.[1] || '條件算術';
    groups.set(key, [...(groups.get(key) || []), s]);
  }
  return <section data-testid="curriculum-panel" className="rounded-2xl border border-slate-800 bg-slate-900/45 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">選修課程 · {track === 'cash' ? 'Cash' : 'MTT'}</h3><p className="mt-1 text-xs text-slate-400">目前偏好可練 {available.length} / {all.length} 課。完成表示做過，不代表已掌握。</p></div><button onClick={onPreferences} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">調整課程篩選</button></div>
    {!available.length && <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200">這組桌型、有效籌碼與主題尚無可選課程。請調整偏好；下方保留完整課程清單供查閱。</p>}
    <div className="mt-4 grid gap-3 md:grid-cols-2">{[...groups].map(([name, list]) => <div key={name} className="rounded-xl border border-slate-800 p-3"><h4 className="mb-2 text-sm font-semibold text-emerald-200">{name}</h4><div className="space-y-2">{list.map(s => {
      const enabled = scenarioMatchesTrainingTrack(s, track, profile);
      const practiced = history.some(item => item.scenarioId === s.id && !item.examMode);
      const exact = s.steps[0].options.every(action => s.steps[0].feedbacks[action]?.evidence?.sourceConfidence === 'exact-math');
      return <button key={s.id} data-testid={`course-${s.id}`} disabled={!enabled} onClick={() => onStart(s)} className="block w-full rounded-lg bg-slate-950/50 px-3 py-2 text-left hover:bg-slate-800 disabled:opacity-40"><span className="text-sm">{s.title}</span><span className="mt-1 block text-[11px] text-slate-400">{s.tableSize} · 有效 {s.effectiveStack} · {exact ? '給定條件的效用算術' : '條件式教學'} · {enabled ? practiced ? '已練習，可複習' : '開始練習' : '不符合目前偏好'}</span></button>;
    })}</div></div>)}</div>
    <p className="mt-4 text-xs leading-5 text-slate-500">策略課依題目明示對手與情境評分，未提供完整 solver range 或動作 EV。未見測驗另行評估；同題重做與花色變體不算新能力證據。</p>
  </section>;
}
