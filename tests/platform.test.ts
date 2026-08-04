import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateSyncEndpoint } from '../src/services/cloudSync';

test('cloud sync requires HTTPS except localhost', () => {
  assert.equal(validateSyncEndpoint('https://example.com/backup.json').protocol, 'https:');
  assert.equal(validateSyncEndpoint('http://localhost:3000/backup.json').hostname, 'localhost');
  assert.throws(() => validateSyncEndpoint('http://example.com/backup.json'), /HTTPS/);
});

test('PWA manifest and service worker are project-base aware', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf-8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.icons[0].src, './poker-chip.svg');
  const serviceWorker = readFileSync('public/sw.js', 'utf-8');
  assert.match(serviceWorker, /self\.registration\.scope/);
  assert.doesNotMatch(serviceWorker, /const APP_SHELL = \['\/'/);
});
