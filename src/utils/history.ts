import { ConfidenceLevel, HistoryItem, PlayerProfile } from '../types';
import { getHistoryMasteryKey, isHistoryCorrect } from '../learning-engine';

export const HISTORY_KEY = 'poker_training_history_v4';
const LEGACY_HISTORY_KEYS = ['poker_training_history_v3', 'poker_training_history_v2'];

const normalize = (item: HistoryItem, index: number): HistoryItem => {
  const timestamp = Number.isFinite(item.timestamp) ? item.timestamp : Date.now();
  const score = Number.isFinite(item.score) ? item.score : 0;
  const correct = item.correct ?? (score >= 8);
  const normalized: HistoryItem = {
    ...item,
    schemaVersion: 4,
    attemptId: item.attemptId || `legacy-${timestamp}-${index}`,
    trainingType: item.trainingType || 'scenario',
    category: Array.isArray(item.category) ? item.category : [],
    score,
    timestamp,
    correct,
    nextReviewAt: item.nextReviewAt ?? (!correct ? Date.now() : undefined),
  };
  normalized.masteryKey = getHistoryMasteryKey(normalized);
  return normalized;
};

export function loadHistory(): HistoryItem[] {
  try {
    const current = localStorage.getItem(HISTORY_KEY);
    if (current) return (JSON.parse(current) as HistoryItem[]).map(normalize);
    for (const key of LEGACY_HISTORY_KEYS) {
      const legacy = localStorage.getItem(key);
      if (!legacy) continue;
      const migrated = (JSON.parse(legacy) as HistoryItem[]).map(normalize);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return [];
  } catch { return []; }
}

export function saveHistory(items: HistoryItem[]): void { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.map(normalize))); }
export function clearHistory(): void { localStorage.removeItem(HISTORY_KEY); LEGACY_HISTORY_KEYS.forEach(key => localStorage.removeItem(key)); }
export function createAttemptId(): string { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export function getReviewSchedule(
  score: number,
  confidenceOrPrevious?: ConfidenceLevel | HistoryItem,
  maybePrevious?: HistoryItem,
  now = Date.now(),
): Pick<HistoryItem, 'nextReviewAt' | 'reviewIntervalDays'> {
  const confidence = typeof confidenceOrPrevious === 'number' ? confidenceOrPrevious : undefined;
  const previous = typeof confidenceOrPrevious === 'object' ? confidenceOrPrevious : maybePrevious;
  if (score < 8) {
    const delayMs = previous && !isHistoryCorrect(previous) ? 60 * 60 * 1000 : 10 * 60 * 1000;
    return { nextReviewAt: now + delayMs, reviewIntervalDays: delayMs / 86400000 };
  }
  if (confidence && confidence <= 2) return { nextReviewAt: now + 86400000, reviewIntervalDays: 1 };
  const previousDays = previous?.reviewIntervalDays || 0;
  const baseDays = previousDays < 1 ? 1 : previousDays < 3 ? 3 : previousDays < 7 ? 7 : Math.min(60, Math.round(previousDays * 1.8));
  const multiplier = confidence === 4 ? 1.35 : 1;
  const days = Math.max(1, Math.min(60, Math.round(baseDays * multiplier)));
  return { nextReviewAt: now + days * 86400000, reviewIntervalDays: days };
}

export interface TrainingBackup { version: 4; exportedAt: string; history: HistoryItem[]; starredIds: string[]; playerProfile?: PlayerProfile; }
export function makeTrainingBackup(history: HistoryItem[], starredIds: string[], playerProfile?: PlayerProfile): TrainingBackup { return { version: 4, exportedAt: new Date().toISOString(), history: history.map(normalize), starredIds, playerProfile }; }
export function exportTrainingData(history: HistoryItem[], starredIds: string[], playerProfile?: PlayerProfile): void {
  const blob = new Blob([JSON.stringify(makeTrainingBackup(history, starredIds, playerProfile), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `poker-coach-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
}
export async function importTrainingData(file: File): Promise<{ history: HistoryItem[]; starredIds: string[]; playerProfile?: PlayerProfile }> {
  const parsed = JSON.parse(await file.text()) as Partial<TrainingBackup>;
  if (!parsed || !Array.isArray(parsed.history)) throw new Error('Invalid Poker Coach backup file.');
  const history = parsed.history.map(normalize);
  const starredIds = Array.isArray(parsed.starredIds) ? parsed.starredIds.filter((id: unknown) => typeof id === 'string') : [];
  saveHistory(history); localStorage.setItem('poker_starred_ids', JSON.stringify(starredIds));
  return { history, starredIds, playerProfile: parsed.playerProfile };
}
