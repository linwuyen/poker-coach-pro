import { HistoryItem } from '../types';

export const HISTORY_KEY = 'poker_training_history_v3';
const LEGACY_HISTORY_KEY = 'poker_training_history_v2';

const normalize = (item: HistoryItem, index: number): HistoryItem => ({
  ...item,
  schemaVersion: 3,
  attemptId: item.attemptId || `legacy-${item.timestamp || Date.now()}-${index}`,
  trainingType: item.trainingType || 'scenario',
  category: Array.isArray(item.category) ? item.category : [],
  score: Number.isFinite(item.score) ? item.score : 0,
  timestamp: Number.isFinite(item.timestamp) ? item.timestamp : Date.now(),
});

export function loadHistory(): HistoryItem[] {
  try {
    const current = localStorage.getItem(HISTORY_KEY);
    if (current) return (JSON.parse(current) as HistoryItem[]).map(normalize);

    const legacy = localStorage.getItem(LEGACY_HISTORY_KEY);
    if (!legacy) return [];
    const migrated = (JSON.parse(legacy) as HistoryItem[]).map(normalize);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return [];
  }
}

export function saveHistory(items: HistoryItem[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(LEGACY_HISTORY_KEY);
}

export function createAttemptId(): string {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getReviewSchedule(score: number, previous?: HistoryItem): Pick<HistoryItem, 'nextReviewAt' | 'reviewIntervalDays'> {
  const now = Date.now();
  if (score < 8) return { nextReviewAt: now + 5 * 60 * 1000, reviewIntervalDays: 0 };
  const previousDays = previous?.reviewIntervalDays || 0;
  const days = previousDays === 0 ? 1 : previousDays === 1 ? 3 : Math.min(30, previousDays * 2);
  return { nextReviewAt: now + days * 86400000, reviewIntervalDays: days };
}

export function exportTrainingData(history: HistoryItem[], starredIds: string[]): void {
  const blob = new Blob([JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), history, starredIds }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `poker-coach-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importTrainingData(file: File): Promise<{ history: HistoryItem[]; starredIds: string[] }> {
  const parsed = JSON.parse(await file.text());
  if (!parsed || !Array.isArray(parsed.history)) throw new Error('Invalid Poker Coach backup file.');
  const history = parsed.history.map(normalize);
  const starredIds = Array.isArray(parsed.starredIds) ? parsed.starredIds.filter((id: unknown) => typeof id === 'string') : [];
  saveHistory(history);
  localStorage.setItem('poker_starred_ids', JSON.stringify(starredIds));
  return { history, starredIds };
}
