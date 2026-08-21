import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOST = '127.0.0.1';
const PREVIEW_PORT = 4173;
const DEBUG_PORT = 9222;
const BASE_URL = `http://${HOST}:${PREVIEW_PORT}/poker-coach-pro/`;
const SAMPLE_HAND = `PokerStars Hand #999000111222: Hold'em No Limit ($0.50/$1.00 USD) - 2026/08/20 18:50:25 ET\nTable 'E2E' 3-max Seat #3 is the button\nSeat 1: VillainA ($100 in chips)\nSeat 2: VillainB ($100 in chips)\nSeat 3: Hero ($100 in chips)\nVillainA: posts small blind $0.50\nVillainB: posts big blind $1\n*** HOLE CARDS ***\nDealt to Hero [Ah Kd]\nHero: raises $1.50 to $2.50\nVillainA: folds\nVillainB: folds\nHero collected $2.50 from pot\n*** SUMMARY ***`;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitHttp(url, attempts = 80) {
  for (let index = 0; index < attempts; index += 1) {
    try { const response = await fetch(url); if (response.ok) return response; } catch {}
    await sleep(125);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function commandExists(command) {
  return spawnSync('bash', ['-lc', `command -v ${command}`], { stdio: 'ignore' }).status === 0;
}

function browserCommand() {
  for (const candidate of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) if (commandExists(candidate)) return candidate;
  throw new Error('Chrome/Chromium is required for browser E2E.');
}

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { socket, send };
}

async function evaluate(send, expression, returnByValue = true) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
  return result.result?.value;
}

async function waitFor(send, expression, description, attempts = 80) {
  for (let index = 0; index < attempts; index += 1) {
    if (await evaluate(send, expression)) return;
    await sleep(125);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

const userData = mkdtempSync(join(tmpdir(), 'poker-coach-e2e-'));
let preview;
let chrome;
let cdp;
try {
  preview = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['exec', '--', 'vite', 'preview', '--host', HOST, '--port', String(PREVIEW_PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
  await waitHttp(BASE_URL);
  chrome = spawn(browserCommand(), [
    '--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userData}`, '--disable-background-networking', '--disable-default-apps', BASE_URL,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  await waitHttp(`http://${HOST}:${DEBUG_PORT}/json/version`);
  let pages = [];
  for (let index = 0; index < 40; index += 1) {
    pages = await (await fetch(`http://${HOST}:${DEBUG_PORT}/json/list`)).json();
    if (pages.some(page => page.type === 'page' && page.webSocketDebuggerUrl)) break;
    await sleep(100);
  }
  const page = pages.find(candidate => candidate.type === 'page' && candidate.webSocketDebuggerUrl);
  if (!page) throw new Error('No Chrome page target found.');
  cdp = await connectCdp(page.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await waitFor(cdp.send, `document.readyState === 'complete'`, 'initial page load');

  await evaluate(cdp.send, `location.hash = '#hand-history'; true`);
  await waitFor(cdp.send, `Boolean(document.querySelector('[data-testid="hh-text"]'))`, 'Hand History importer');
  await evaluate(cdp.send, `(() => {
    const textarea = document.querySelector('[data-testid="hh-text"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(textarea, ${JSON.stringify(SAMPLE_HAND)});
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await waitFor(cdp.send, `document.querySelector('[data-testid="hh-text"]').value.includes('999000111222')`, 'controlled HH textarea update');
  await evaluate(cdp.send, `document.querySelector('[data-testid="hh-import"]').click(); true`);
  await waitFor(cdp.send, `document.querySelector('[data-testid="hh-message"]')?.textContent.includes('已匯入 1 手牌')`, 'HH import confirmation');
  const history = await evaluate(cdp.send, `JSON.parse(localStorage.getItem('poker_training_history_v6') || '[]')`);
  if (!Array.isArray(history) || !history.some(item => item.trainingType === 'real-hand' && item.schemaVersion === 6 && item.handsObserved === 1)) {
    throw new Error(`Browser history assertion failed: ${JSON.stringify(history)}`);
  }
  const ids = await evaluate(cdp.send, `JSON.parse(localStorage.getItem('poker_imported_hand_ids_v1') || '[]')`);
  if (!ids.includes('999000111222')) throw new Error(`Imported hand-id assertion failed: ${JSON.stringify(ids)}`);
  console.log('Browser E2E PASS: production build → HH route → controlled input → import → History v6 persistence.');
} finally {
  try { cdp?.socket?.close(); } catch {}
  if (chrome && !chrome.killed) chrome.kill('SIGTERM');
  if (preview && !preview.killed) preview.kill('SIGTERM');
  rmSync(userData, { recursive: true, force: true });
}
