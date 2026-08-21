import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOST = '127.0.0.1';
const PREVIEW_PORT = 4173;
const DEBUG_PORT = 9222;
const BASE_URL = `http://${HOST}:${PREVIEW_PORT}/poker-coach-pro/`;
const VITE_BIN = join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
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

async function waitForChrome(child, stderr, attempts = 160) {
  const url = `http://${HOST}:${DEBUG_PORT}/json/version`;
  for (let index = 0; index < attempts; index += 1) {
    if (child.exitCode !== null) throw new Error(`Chrome exited before CDP was ready (exit=${child.exitCode}). ${stderr().trim()}`);
    try { const response = await fetch(url); if (response.ok) return response; } catch {}
    await sleep(125);
  }
  throw new Error(`Timed out waiting for ${url}. Chrome exit=${child.exitCode}. ${stderr().trim()}`);
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

async function waitFor(send, expression, description, attempts = 120) {
  for (let index = 0; index < attempts; index += 1) {
    if (await evaluate(send, expression)) return;
    await sleep(125);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function navigateRoute(send, hash, expectedText) {
  await evaluate(send, `location.hash = ${JSON.stringify(hash)}; true`);
  await waitFor(send, `!document.querySelector('[data-testid="route-loading"]') && document.body.textContent.includes(${JSON.stringify(expectedText)})`, `${hash || 'root'} lazy route: ${expectedText}`);
}

async function terminate(child) {
  if (!child || child.exitCode !== null) return;
  const waitForExit = timeoutMs => new Promise(resolve => {
    if (child.exitCode !== null) return resolve();
    const timer = setTimeout(resolve, timeoutMs);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
  child.kill('SIGTERM');
  await waitForExit(1500);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await waitForExit(1500);
  }
}

const userData = mkdtempSync(join(tmpdir(), 'poker-coach-e2e-'));
let preview;
let chrome;
let cdp;
let chromeStderr = '';
try {
  preview = spawn(process.execPath, [VITE_BIN, 'preview', '--host', HOST, '--port', String(PREVIEW_PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
  await waitHttp(BASE_URL);

  const browser = browserCommand();
  console.log(`Browser E2E using ${browser}`);
  chrome = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--remote-debugging-address=${HOST}`, `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userData}`, '--disable-background-networking', '--disable-default-apps',
    '--no-first-run', '--no-default-browser-check', BASE_URL,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  chrome.stderr?.on('data', chunk => { chromeStderr += String(chunk); });
  await waitForChrome(chrome, () => chromeStderr);

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
  await waitFor(cdp.send, `document.body.textContent.includes('今天')`, 'Today shell');

  // P9-C: exercise a real controlled React input and persistence, not just route rendering.
  await navigateRoute(cdp.send, '#hand-history', 'Real-game truth join');
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

  // P9/P10/P11: every heavyweight route must load its split chunk successfully in production.
  await navigateRoute(cdp.send, '#truth-ops', 'Truth Operations');
  await navigateRoute(cdp.send, '#strategy-surface', 'Full Strategy Surface');
  await navigateRoute(cdp.send, '#effectiveness', 'Learning Effectiveness');
  await navigateRoute(cdp.send, '#tournament-context', 'Tournament truth join');
  await navigateRoute(cdp.send, '#fgs-workbench', 'Finite Game Simulation');
  await navigateRoute(cdp.send, '#experiment', 'Randomized N-of-1');
  await evaluate(cdp.send, `document.querySelector('[data-testid="experiment-create"]').click(); true`);
  await waitFor(cdp.send, `Boolean(localStorage.getItem('poker_learning_experiment_v1'))`, 'N-of-1 experiment persistence');
  await navigateRoute(cdp.send, '', '今天');

  console.log('Browser E2E PASS: Today → HH persistence → Truth Ops → Solver Surface → Effectiveness → Tournament Join → FGS → randomized N-of-1 → Today, all through production lazy chunks.');
} finally {
  try { cdp?.socket?.close(); } catch {}
  await terminate(chrome);
  await terminate(preview);
  try { rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch {}
}
