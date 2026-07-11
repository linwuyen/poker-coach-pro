export function getApiUrl(path: string): string {
  if (typeof window !== 'undefined') {
    const isTauri = window.location.protocol.startsWith('tauri') || window.location.hostname === 'tauri.localhost';
    if (isTauri) {
      return `http://localhost:3000${path}`;
    }
  }
  return path;
}
