import { ConfidenceLevel, HistoryItem, PlayerProfile } from '../types';
import { getHistoryMasteryKey, isHistoryCorrect } from '../learning-engine';

export const HISTORY_KEY = 'poker_training_history_v6';
const HISTORY_WRITE_LOCK = `${HISTORY_KEY}:exclusive-write`;
const LEGACY_HISTORY_KEYS = ['poker_training_history_v5', 'poker_training_history_v4', 'poker_training_history_v3', 'poker_training_history_v2'];

type HistoryLockManager = {
  request<T>(name: string, options: { mode: 'exclusive' }, callback: () => T | Promise<T>): Promise<T>;
};

const normalize = (item: HistoryItem, index: number): HistoryItem => {
  const timestamp = Number.isFinite(item.timestamp) ? item.timestamp : Date.now();
  const score = Number.isFinite(item.score) ? item.score : 0;
  const correct = item.correct ?? (score >= 8);
  const normalized: HistoryItem = {
    ...item,
    schemaVersion: 6,
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

function historyLocks(): HistoryLockManager | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { locks?: HistoryLockManager }).locks;
}

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

function mutateHistory(mutator: (latest: HistoryItem[]) => HistoryItem[]): HistoryItem[] {
  const latest = loadHistory();
  const next = mutator(latest);
  saveHistory(next);
  return next;
}

/**
 * Serialize a full history read-modify-write across same-origin tabs.
 * Hidden evaluation commits must use this primitive so exposure revalidation and
 * persistence observe one exclusive snapshot. If Web Locks is unavailable, callers
 * fail closed rather than silently weakening evaluation isolation.
 */
export async function updateHistoryExclusive(mutator: (latest: HistoryItem[]) => HistoryItem[]): Promise<HistoryItem[]> {
  const locks = historyLocks();
  if (!locks?.request) throw new Error('Exclusive history locking is unavailable in this browser.');
  return locks.request(HISTORY_WRITE_LOCK, { mode: 'exclusive' }, () => mutateHistory(mutator));
}

/**
 * Ordinary training/admin history writes coordinate on the same cross-tab lock when
 * available, so they cannot overwrite an in-flight Hidden Exam transaction. Legacy
 * browsers may fall back to the synchronous local write; Hidden Exam itself never
 * uses this fallback and therefore remains fail-closed without Web Locks.
 */
export async function updateHistoryCoordinated(mutator: (latest: HistoryItem[]) => HistoryItem[]): Promise<HistoryItem[]> {
  const locks = historyLocks();
  if (!locks?.request) return mutateHistory(mutator);
  return locks.request(HISTORY_WRITE_LOCK, { mode: 'exclusive' }, () => mutateHistory(mutator));
}

export function upsertHistoryItem(items: HistoryItem[], item: HistoryItem): HistoryItem[] {
  const index = item.attemptId ? items.findIndex(existing => existing.attemptId === item.attemptId) : -1;
  return index >= 0 ? items.map((existing, itemIndex) => itemIndex === index ? item : existing) : [...items, item];
}

export async function persistHistoryItem(item: HistoryItem): Promise<HistoryItem[]> {
  return updateHistoryCoordinated(latest => upsertHistoryItem(latest, item));
}

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

export interface TrainingBackup { version: 6; exportedAt: string; history: HistoryItem[]; starredIds: string[]; playerProfile?: PlayerProfile; }
export function makeTrainingBackup(history: HistoryItem[], starredIds: string[], playerProfile?: PlayerProfile): TrainingBackup { return { version: 6, exportedAt: new Date().toISOString(), history: history.map(normalize), starredIds, playerProfile }; }
export function exportTrainingData(history: HistoryItem[], starredIds: string[], playerProfile?: PlayerProfile): void {
  const blob = new Blob([JSON.stringify(makeTrainingBackup(history, starredIds, playerProfile), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `poker-coach-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
}
export async function importTrainingData(file: File): Promise<{ history: HistoryItem[]; starredIds: string[]; playerProfile?: PlayerProfile }> {
  const parsed = JSON.parse(await file.text()) as { version?: number; history?: HistoryItem[]; starredIds?: unknown[]; playerProfile?: PlayerProfile };
  if (!parsed || !Array.isArray(parsed.history)) throw new Error('Invalid Poker Coach backup file.');
  const history = parsed.history.map(normalize);
  const starredIds = Array.isArray(parsed.starredIds) ? parsed.starredIds.filter((id: unknown): id is string => typeof id === 'string') : [];
  await updateHistoryCoordinated(() => history);
  localStorage.setItem('poker_starred_ids', JSON.stringify(starredIds));
  return { history, starredIds, playerProfile: parsed.playerProfile };
}