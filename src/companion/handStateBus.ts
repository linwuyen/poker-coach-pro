import { CompanionHandState } from './types';

export const COMPANION_STORAGE_KEY = 'poker_companion_hand_state_v1';
export const COMPANION_CHANNEL = 'poker-coach-companion-v1';

type Listener = () => void;

let snapshot: CompanionHandState | null = loadPersisted();
const listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

function loadPersisted(): CompanionHandState | null {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(COMPANION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CompanionHandState;
    return parsed?.schemaVersion === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function notify(): void {
  listeners.forEach(listener => listener());
}

function accept(next: CompanionHandState | null, persist = true): void {
  snapshot = next;
  if (hasWindow() && persist) {
    try {
      if (next) window.localStorage.setItem(COMPANION_STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(COMPANION_STORAGE_KEY);
    } catch {
      // localStorage may be unavailable in hardened/private contexts. The
      // in-memory bus still works inside the active window.
    }
  }
  notify();
}

function ensureBrowserBridge(): void {
  if (!hasWindow()) return;
  if (!channel && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(COMPANION_CHANNEL);
    channel.onmessage = event => {
      const next = event.data as CompanionHandState | null;
      if (next === null || next?.schemaVersion === 1) accept(next, true);
    };
  }
}

if (hasWindow()) {
  ensureBrowserBridge();
  window.addEventListener('storage', event => {
    if (event.key !== COMPANION_STORAGE_KEY) return;
    if (!event.newValue) {
      accept(null, false);
      return;
    }
    try {
      const next = JSON.parse(event.newValue) as CompanionHandState;
      if (next?.schemaVersion === 1) accept(next, false);
    } catch {
      // Ignore malformed external writes.
    }
  });
}

export function getCompanionHandState(): CompanionHandState | null {
  return snapshot;
}

export function subscribeCompanionHandState(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishCompanionHandState(state: CompanionHandState): CompanionHandState {
  ensureBrowserBridge();
  const next = { ...state, schemaVersion: 1 as const, updatedAt: Date.now() };
  accept(next, true);
  channel?.postMessage(next);
  return next;
}

export function patchCompanionHandState(patch: Partial<CompanionHandState>): CompanionHandState | null {
  const current = getCompanionHandState();
  if (!current) return null;
  return publishCompanionHandState({ ...current, ...patch, schemaVersion: 1 });
}

export function clearCompanionHandState(): void {
  ensureBrowserBridge();
  accept(null, true);
  channel?.postMessage(null);
}
