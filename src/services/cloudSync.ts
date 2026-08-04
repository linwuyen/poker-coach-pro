import { TrainingBackup } from '../utils/history';

export interface CloudSyncSettings {
  enabled: boolean;
  endpoint: string;
  lastSyncedAt?: number;
}

export interface EncryptedBackupEnvelope {
  version: 1;
  algorithm: 'AES-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export const CLOUD_SYNC_KEY = 'poker_cloud_sync_v1';

export function loadCloudSyncSettings(): CloudSyncSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(CLOUD_SYNC_KEY) || 'null') as CloudSyncSettings | null;
    return parsed || { enabled: false, endpoint: '' };
  } catch {
    return { enabled: false, endpoint: '' };
  }
}

export function saveCloudSyncSettings(settings: CloudSyncSettings): void {
  localStorage.setItem(CLOUD_SYNC_KEY, JSON.stringify(settings));
}

export function validateSyncEndpoint(endpoint: string): URL {
  const url = new URL(endpoint);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !local) throw new Error('雲端同步端點必須使用 HTTPS。');
  return url;
}

export async function pushCloudBackup(
  settings: CloudSyncSettings,
  backup: TrainingBackup,
  passphrase: string,
  bearerToken?: string,
): Promise<CloudSyncSettings> {
  const url = validateSyncEndpoint(settings.endpoint);
  if (passphrase.length < 8) throw new Error('同步加密密碼至少需要 8 個字元。');
  const encrypted = await encryptBackup(backup, passphrase);
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    },
    body: JSON.stringify(encrypted),
  });
  if (!response.ok) throw new Error(`雲端同步失敗：HTTP ${response.status}`);
  const updated = { ...settings, enabled: true, lastSyncedAt: Date.now() };
  saveCloudSyncSettings(updated);
  return updated;
}

export async function pullCloudBackup(
  settings: CloudSyncSettings,
  passphrase: string,
  bearerToken?: string,
): Promise<TrainingBackup> {
  const url = validateSyncEndpoint(settings.endpoint);
  const response = await fetch(url, {
    headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined,
  });
  if (!response.ok) throw new Error(`下載備份失敗：HTTP ${response.status}`);
  return decryptBackup(await response.json() as EncryptedBackupEnvelope, passphrase);
}

export async function encryptBackup(backup: TrainingBackup, passphrase: string): Promise<EncryptedBackupEnvelope> {
  const iterations = 210000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations, ['encrypt']);
  const plaintext = new TextEncoder().encode(JSON.stringify(backup));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    version: 1,
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptBackup(envelope: EncryptedBackupEnvelope, passphrase: string): Promise<TrainingBackup> {
  if (envelope.version !== 1 || envelope.algorithm !== 'AES-GCM') throw new Error('不支援的同步備份格式。');
  const salt = fromBase64(envelope.salt);
  const iv = fromBase64(envelope.iv);
  const key = await deriveKey(passphrase, salt, envelope.iterations, ['decrypt']);
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fromBase64(envelope.ciphertext));
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as TrainingBackup;
    if (!parsed || !Array.isArray(parsed.history)) throw new Error('備份內容格式錯誤。');
    return parsed;
  } catch {
    throw new Error('無法解密備份：密碼錯誤或檔案已損壞。');
  }
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number, usages: KeyUsage[]): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
}

function toBase64(value: Uint8Array): string {
  let binary = '';
  value.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
