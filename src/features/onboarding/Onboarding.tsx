import { useState } from 'react';
import { CheckCircle2, Target } from 'lucide-react';
import { DEFAULT_PLAYER_PROFILE } from '../../domain/playerProfile';
import { FocusArea, PlayerExperience, PlayerProfile, StackBand } from '../../types';

interface OnboardingProps {
  initial?: PlayerProfile;
  onComplete: (profile: PlayerProfile) => void;
}

const FOCUS: Array<{ id: FocusArea; label: string }> = [
  { id: 'preflop', label: '翻前' }, { id: 'postflop', label: '翻後' }, { id: 'short-stack', label: '短碼／ICM' },
  { id: 'math', label: '數學／SPR' }, { id: 'bluff-catching', label: '抓詐唬' }, { id: 'mixed', label: '綜合' },
];
const STACKS: Array<{ id: StackBand; label: string }> = [
  { id: '10-20', label: '10–20BB' }, { id: '20-40', label: '20–40BB' }, { id: '40-100', label: '40–100BB' }, { id: '100+', label: '100BB+' },
];

export function Onboarding({ initial = DEFAULT_PLAYER_PROFILE, onComplete }: OnboardingProps) {
  const [profile, setProfile] = useState<PlayerProfile>({ ...initial });
  const toggle = <T,>(values: T[], value: T): T[] => values.includes(value) ? values.filter(item => item !== value) : [...values, value];
  const submit = () => onComplete({
    ...profile,
    formats: profile.formats.length ? profile.formats : ['tournament'],
    tableSizes: profile.tableSizes.length ? profile.tableSizes : ['9max'],
    stackBands: profile.stackBands.length ? profile.stackBands : ['20-40'],
    focusAreas: profile.focusAreas.length ? profile.focusAreas : ['mixed'],
    onboardingComplete: true,
    updatedAt: Date.now(),
  });

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/95 p-4 text-slate-100 backdrop-blur">
      <div className="mx-auto my-6 max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl md:p-9">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-emerald-950"><Target className="h-6 w-6" /></div>
          <div><h1 className="text-2xl font-bold">先建立你的玩家模型</h1><p className="mt-2 text-sm leading-relaxed text-slate-400">系統會依賽制、籌碼深度與目標選題，避免讓 Cash 玩家一直練 ICM，或讓短碼玩家只看到 100BB 題目。</p></div>
        </div>

        <Section title="主要賽制">
          <Choice active={profile.formats.includes('cash')} label="Cash Game" onClick={() => setProfile(value => ({ ...value, formats: toggle(value.formats, 'cash') }))} />
          <Choice active={profile.formats.includes('tournament')} label="Tournament" onClick={() => setProfile(value => ({ ...value, formats: toggle(value.formats, 'tournament') }))} />
        </Section>
        <Section title="常玩桌型">
          <Choice active={profile.tableSizes.includes('6max')} label="6-Max" onClick={() => setProfile(value => ({ ...value, tableSizes: toggle(value.tableSizes, '6max') }))} />
          <Choice active={profile.tableSizes.includes('9max')} label="9-Max" onClick={() => setProfile(value => ({ ...value, tableSizes: toggle(value.tableSizes, '9max') }))} />
        </Section>
        <Section title="常見有效籌碼">
          {STACKS.map(item => <Choice key={item.id} active={profile.stackBands.includes(item.id)} label={item.label} onClick={() => setProfile(value => ({ ...value, stackBands: toggle(value.stackBands, item.id) }))} />)}
        </Section>
        <Section title="目前程度">
          {([['beginner', '新手'], ['intermediate', '有基礎'], ['advanced', '進階']] as Array<[PlayerExperience, string]>).map(([id, label]) => <Choice key={id} active={profile.experience === id} label={label} onClick={() => setProfile(value => ({ ...value, experience: id }))} />)}
        </Section>
        <Section title="最想改善">
          {FOCUS.map(item => <Choice key={item.id} active={profile.focusAreas.includes(item.id)} label={item.label} onClick={() => setProfile(value => ({ ...value, focusAreas: toggle(value.focusAreas, item.id) }))} />)}
        </Section>
        <Section title="每日題數">
          {([8, 12, 20] as const).map(count => <Choice key={count} active={profile.dailyQuestions === count} label={`${count} 題`} onClick={() => setProfile(value => ({ ...value, dailyQuestions: count }))} />)}
        </Section>

        <button type="button" onClick={submit} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 font-bold text-emerald-950 hover:bg-emerald-400"><CheckCircle2 className="h-5 w-5" />建立個人化訓練</button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-7"><h2 className="mb-3 text-sm font-semibold text-slate-300">{title}</h2><div className="flex flex-wrap gap-2">{children}</div></section>;
}

function Choice({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${active ? 'border-emerald-500/50 bg-emerald-500/12 text-emerald-300' : 'border-slate-700 bg-slate-950/50 text-slate-400 hover:text-white'}`}>{label}</button>;
}
