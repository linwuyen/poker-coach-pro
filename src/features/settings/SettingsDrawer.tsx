import { useState } from 'react';
import { Cloud, Download, Loader2, Save, Settings2, Upload, X } from 'lucide-react';
import { HistoryItem, PlayerProfile } from '../../types';
import { makeTrainingBackup, TrainingBackup } from '../../utils/history';
import { loadCloudSyncSettings, pullCloudBackup, pushCloudBackup, saveCloudSyncSettings } from '../../services/cloudSync';

interface SettingsDrawerProps {
  open: boolean;
  profile: PlayerProfile;
  history: HistoryItem[];
  starredIds: string[];
  onClose: () => void;
  onEditProfile: () => void;
  onRestore: (backup: TrainingBackup) => void;
}

export function SettingsDrawer({ open, profile, history, starredIds, onClose, onEditProfile, onRestore }: SettingsDrawerProps) {
  const [sync, setSync] = useState(loadCloudSyncSettings);
  const [endpoint, setEndpoint] = useState(sync.endpoint);
  const [passphrase, setPassphrase] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  if (!open) return null;

  const saveEndpoint = () => {
    const next = { ...sync, endpoint, enabled: Boolean(endpoint) };
    saveCloudSyncSettings(next);
    setSync(next);
    setStatus('同步端點已儲存；加密密碼與 Token 不會保存。');
  };
  const push = async () => {
    setLoading(true); setStatus('');
    try { const next = await pushCloudBackup({ ...sync, endpoint }, makeTrainingBackup(history, starredIds, profile), passphrase, token || undefined); setSync(next); setStatus('加密備份已上傳。'); }
    catch (reason) { setStatus(reason instanceof Error ? reason.message : '上傳失敗。'); }
    finally { setLoading(false); }
  };
  const pull = async () => {
    setLoading(true); setStatus('');
    try { const backup = await pullCloudBackup({ ...sync, endpoint }, passphrase, token || undefined); onRestore(backup); setStatus('雲端備份已解密並恢復。'); }
    catch (reason) { setStatus(reason instanceof Error ? reason.message : '下載失敗。'); }
    finally { setLoading(false); }
  };

  return <div className="fixed inset-0 z-[115] bg-black/60 backdrop-blur-sm" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}>
    <aside className="ml-auto h-full w-full max-w-lg overflow-y-auto border-l border-slate-800 bg-slate-950 p-5 text-slate-100 shadow-2xl">
      <header className="flex items-center justify-between"><div className="flex items-center gap-3"><Settings2 className="h-5 w-5 text-emerald-400" /><div><div className="font-semibold">玩家與資料設定</div><div className="text-xs text-slate-500">個人化、備份與選配同步</div></div></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800"><X className="h-5 w-5" /></button></header>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="font-semibold">玩家模型</div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400"><Value label="賽制" value={profile.formats.join(' / ')} /><Value label="桌型" value={profile.tableSizes.join(' / ')} /><Value label="籌碼" value={profile.stackBands.join(' / ')} /><Value label="每日" value={`${profile.dailyQuestions} 題`} /></div><button type="button" onClick={onEditProfile} className="mt-4 w-full rounded-xl border border-emerald-500/30 px-4 py-3 text-sm font-semibold text-emerald-300">重新設定玩家模型</button></section>

      <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="flex items-center gap-2 font-semibold"><Cloud className="h-4 w-4 text-blue-400" />加密雲端同步</div><p className="mt-2 text-xs leading-relaxed text-slate-500">使用你自己的 HTTPS PUT/GET 端點。資料在瀏覽器以 AES-GCM 加密後才上傳；密碼及 Bearer Token 不會寫入 localStorage。</p>
        <label className="mt-4 block text-xs text-slate-500">同步檔案 URL<input value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="https://example.com/poker-backup.json" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200" /></label>
        <label className="mt-3 block text-xs text-slate-500">加密密碼<input type="password" value={passphrase} onChange={event => setPassphrase(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></label>
        <label className="mt-3 block text-xs text-slate-500">Bearer Token（選填）<input type="password" value={token} onChange={event => setToken(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></label>
        <div className="mt-4 grid grid-cols-3 gap-2"><button type="button" onClick={saveEndpoint} className="flex items-center justify-center gap-1 rounded-lg border border-slate-700 px-2 py-2.5 text-xs"><Save className="h-4 w-4" />儲存端點</button><button type="button" onClick={push} disabled={loading} className="flex items-center justify-center gap-1 rounded-lg bg-blue-500/15 px-2 py-2.5 text-xs text-blue-300"><Upload className="h-4 w-4" />上傳</button><button type="button" onClick={pull} disabled={loading} className="flex items-center justify-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-2.5 text-xs text-emerald-300"><Download className="h-4 w-4" />下載</button></div>
        {loading && <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />同步處理中</div>}{status && <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs leading-relaxed text-slate-300">{status}</div>}
        {sync.lastSyncedAt && <div className="mt-2 text-[11px] text-slate-600">最後同步：{new Date(sync.lastSyncedAt).toLocaleString('zh-TW')}</div>}
      </section>
    </aside>
  </div>;
}

function Value({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-950/50 p-3"><div className="text-slate-600">{label}</div><div className="mt-1 font-medium text-slate-300">{value}</div></div>; }
