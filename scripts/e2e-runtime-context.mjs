import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { HOST, PREVIEW_PORT, DEBUG_PORT, BASE_URL, VITE_BIN, sleep, waitHttp, browserCommand, waitForChrome, connectCdp, evaluate, waitFor, terminate } from './browser-runtime-helpers.mjs';

// Exercise actual React submissions and Web Locks without downloading the solver corpus.
const tempRoot = realpathSync(tmpdir());
const userData = mkdtempSync(join(tempRoot, 'poker-runtime-e2e-'));
let preview, chrome, cdp;
// Page.reload acknowledges the request before the old DOM is discarded.
// A document-local marker prevents a ready selector in that old DOM from satisfying the wait.
async function reloadAndWait(send, expression, description) {
  await evaluate(send, 'window.runtimeReloadPending = true; true');
  await send('Page.reload');
  await waitFor(send, `window.runtimeReloadPending !== true && document.readyState === 'complete' && (${expression})`, description);
}
try {
  preview = spawn(process.execPath, [VITE_BIN, '--host', HOST, '--port', String(PREVIEW_PORT), '--strictPort', '--base', '/poker-coach-pro/'], { stdio: 'ignore', windowsHide: true });
  await waitHttp(BASE_URL);
  chrome = spawn(browserCommand(), ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-address=' + HOST, '--remote-debugging-port=' + DEBUG_PORT, '--user-data-dir=' + userData, '--no-first-run', '--no-default-browser-check', BASE_URL], { stdio: 'ignore', windowsHide: true });
  await waitForChrome(chrome, () => '');
  const pages = await (await fetch(`http://${HOST}:${DEBUG_PORT}/json/list`)).json();
  cdp = await connectCdp(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  const send = cdp.send;
  await send('Runtime.enable');
  await send('Page.enable');
  await waitFor(send, 'Boolean(document.querySelector("[data-testid=volume-first-home]"))', 'home');
  await evaluate(send, `(${(async () => {
    const { createElement } = (await import('/poker-coach-pro/node_modules/.vite/deps/react.js')).default;
    const { createRoot } = (await import('/poker-coach-pro/node_modules/.vite/deps/react-dom_client.js')).default;
    const { SolverDecisionSession } = await import('/poker-coach-pro/src/features/training/SolverDecisionSession.tsx');
    const { persistHistoryItem } = await import('/poker-coach-pro/src/utils/history.ts');
    localStorage.setItem('poker_training_history_v6', JSON.stringify([{ attemptId: 'prior', scenarioId: 'stale-previous', stepId: 'stale', trainingType: 'scenario', street: 'River', position: 'BB', category: [], score: 0, judgment: 'test', timestamp: 1 }]));
    document.querySelector('#root').style.display = 'none';
    const host = document.createElement('div');
    document.body.appendChild(host);
    createRoot(host).render(createElement(SolverDecisionSession, {
      rows: [{ id: 'postflop-123', split: 'postflop', holding: 'AsQd', heroPosition: 'BTN', potSize: 17, availableMoves: ['Fold', 'Call'], correctDecision: 'Call', preflopAction: 'BTN/2.5bb/BB/call', aggressorPosition: 'BB', postflopAction: 'OOP_BET_6', boardFlop: 'Qh8d2c', boardTurn: 'Ks', boardRiver: '3h', evaluationAt: 'Turn' }],
      history: [], reviewOnly: true, onRecord: persistHistoryItem, onExit: () => {}, onComplete: () => {},
    }));
  }).toString()})()`);
  await waitFor(send, 'Boolean(document.querySelector("[data-testid=solver-action]"))', 'solver fixture');
  await evaluate(send, `window.runtimeLockAcquired = false; navigator.locks.request('poker_training_history_v6:exclusive-write', {mode:'exclusive'}, () => new Promise(resolve => { window.runtimeLockAcquired = true; window.releaseRuntimeLock = resolve; })); true`);
  await waitFor(send, 'window.runtimeLockAcquired', 'held history lock');
  await evaluate(send, 'document.querySelector("[data-testid=solver-action]").click(); true');
  await waitFor(send, 'document.querySelector("[data-testid=advanced-analysis-tools]")?.dataset.analysisContextReady === "true"', 'analysis bridge');
  const readContext = () => evaluate(send, `JSON.parse(new URLSearchParams(document.querySelector('[data-analysis-route="#current-analysis"]').getAttribute('href').split('?')[1]).get('ctx'))`);
  const context = await readContext();
  assert.equal(await evaluate(send, `JSON.parse(localStorage.getItem('poker_training_history_v6')).length`), 1);
  assert.equal(context.scenarioId, 'daily-solver:postflop_10k_test:postflop-123');
  assert.equal(context.datasetRowId, 'postflop-123');
  assert.equal(context.source, 'pokerbench');
  assert.equal(context.street, 'Turn');
  assert.equal(context.position, 'BTN');
  assert.equal(context.selectedAction, 'Fold');
  assert.equal(context.bestAction, 'Call');
  assert.deepEqual(context.heroCards, ['As', 'Qd']);
  assert.deepEqual(context.boardCards, ['Qh', '8d', '2c', 'Ks']);
  await evaluate(send, 'window.releaseRuntimeLock(); true');
  await waitFor(send, `JSON.parse(localStorage.getItem('poker_training_history_v6')).length === 2`, 'solver commit');
  assert.deepEqual(await readContext(), context);
  const review = await evaluate(send, `JSON.parse(localStorage.getItem('poker_training_history_v6')).at(-1)`);
  assert.equal(review.isReview, true);
  assert.equal(review.isUnseen, false);
  assert.equal(review.isTransferTest, false);
  assert.match(review.notes, /Previously exposed reserved-row review/);
  console.log('Verified solver context while history writes are locked; exposed review stays review-only.');

  await reloadAndWait(send, 'Boolean(document.querySelector("[data-testid=volume-first-home]"))', 'reloaded home');
  await evaluate(send, `localStorage.removeItem('poker_training_history_v6'); location.hash = '#range-reading'; true`);
  await waitFor(send, 'document.body.textContent.includes("18BB CO 直接推進")', 'range question');
  const clickText = async text => {
    const clicked = await evaluate(send, `(() => { const button = Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(text)}); if (!button || button.disabled) return false; button.click(); return true; })()`);
    assert.equal(clicked, true, 'enabled button: ' + text);
    await sleep(50);
  };
  const answerRange = async () => {
    await evaluate(send, `Array.from(document.querySelectorAll('button')).find(button => button.textContent.startsWith('AA')).click(); true`);
    await clickText('鎖定加權範圍');
    await waitFor(send, 'Boolean(document.querySelector("#pot-odds-estimate"))', 'range decision');
    await evaluate(send, `(() => { Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('%')).click(); const input = document.querySelector('#pot-odds-estimate'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '40'); input.dispatchEvent(new Event('input', {bubbles:true})); return true; })()`);
    await clickText('Fold');
    await clickText('非常確定');
    await clickText('提交並寫入學習紀錄');
  };
  await answerRange();
  await clickText('下一題');
  await answerRange();
  await evaluate(send, `location.hash = '#decision-boundary'; true`);
  await waitFor(send, 'document.body.textContent.includes("提交三個反事實決策")', 'counterfactual question');
  const answerCounterfactual = async () => {
    await evaluate(send, `Array.from(document.querySelectorAll('button')).filter(button => button.textContent.trim() === 'Fold').forEach(button => button.click()); true`);
    await clickText('非常確定');
    await clickText('提交三個反事實決策');
  };
  await answerCounterfactual();
  await clickText('下一個邊界');
  await answerCounterfactual();
  await waitFor(send, `JSON.parse(localStorage.getItem('poker_training_history_v6') || '[]').length === 14`, 'all drill commits');
  await reloadAndWait(send, 'document.body.textContent.includes("提交三個反事實決策")', 'reloaded drill route');
  const accounting = await evaluate(send, `(${(async () => {
    const { loadHistory } = await import('/poker-coach-pro/src/utils/history.ts');
    const { historyForTrainingTrack } = await import('/poker-coach-pro/src/domain/trainingTrack.ts');
    const history = loadHistory();
    return { count: history.length, schema: [...new Set(history.map(item => item.schemaVersion))], cash: historyForTrainingTrack(history, 'cash').length, tournament: historyForTrainingTrack(history, 'tournament').length, formats: history.map(item => item.gameFormat) };
  }).toString()})()`);
  assert.deepEqual(accounting, { count: 14, schema: [6], cash: 7, tournament: 7, formats: ['MTT', 'MTT', 'MTT', 'MTT', 'Cash', 'Cash', 'Cash', 'Cash', 'MTT', 'MTT', 'MTT', 'Cash', 'Cash', 'Cash'] });
  console.log('Verified Range and Counterfactual reload: 14 records, 7 Cash and 7 MTT by question format.');
  await evaluate(send, `localStorage.setItem('poker_training_history_v6',JSON.stringify(JSON.parse(localStorage.getItem('poker_training_history_v6')).map(item=>({...item,timestamp:Date.now()-2*86400000,nextReviewAt:Date.now()-1}))));location.hash='';true`);
  await waitFor(send, 'Boolean(document.querySelector("[data-testid=volume-first-home]"))', 'due drill homepage');
  for (const [track, format] of [['cash', 'Cash'], ['tournament', 'MTT']]) {
    await waitFor(send, `Boolean(document.querySelector('[data-testid="track-${track}"]'))`, format + ' track control');
    await evaluate(send, `document.querySelector('[data-testid="track-${track}"]').click();true`);
    await waitFor(send, `document.querySelector('[data-testid="track-${track}"]')?.getAttribute('aria-pressed')==='true'`, format + ' selected track');
    await waitFor(send, 'document.querySelectorAll("[data-testid=start-due-drill-review]").length===2', format + ' due drill entries');
    for (const kind of ['range', 'counterfactual']) {
      const before = await evaluate(send, `JSON.parse(localStorage.getItem('poker_training_history_v6')).length`);
      await evaluate(send, `Array.from(document.querySelectorAll('[data-testid="start-due-drill-review"]')).find(b=>b.dataset.reviewId.startsWith('${kind}-')).click();true`);
      await waitFor(send, `document.body.textContent.includes('原題複習')&&Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()===${JSON.stringify(kind === 'range' ? '鎖定加權範圍' : '提交三個反事實決策')})`, format + ' exact drill replay');
      if (kind === 'range') await answerRange(); else await answerCounterfactual();
      await waitFor(send, `JSON.parse(localStorage.getItem('poker_training_history_v6')).length>${before}`, 'review persistence');
      const reviewed = await evaluate(send, `JSON.parse(localStorage.getItem('poker_training_history_v6')).slice(${before})`);
      assert.equal(reviewed.length, kind === 'range' ? 4 : 3);
      assert.ok(reviewed.every(item => item.gameFormat === format && item.isReview && item.isDelayedReview && !item.isUnseen && !item.isTransferTest && item.nextReviewAt > Date.now()));
      await clickText(kind === 'range' ? '下一題' : '下一個邊界');
      await waitFor(send, '!document.querySelector("[data-testid=active-drill-review]")', 'return to due queue');
    }
    assert.equal(await evaluate(send, 'document.querySelectorAll("[data-testid=start-due-drill-review]").length'), 0);
    await reloadAndWait(send, 'Boolean(document.querySelector("[data-testid=volume-first-home]"))', 'reviewed homepage reload');
    assert.equal(await evaluate(send, 'document.querySelectorAll("[data-testid=start-due-drill-review]").length'), 0);
  }
  console.log('Verified Cash and MTT due drill queues: original Range/Counterfactual replay, review-only evidence, rescheduling and reload.');
} finally {
  try { cdp?.socket.close(); } catch {}
  await terminate(chrome);
  await terminate(preview);
  const target = resolve(userData);
  if (dirname(target) !== tempRoot || !basename(target).startsWith('poker-runtime-e2e-')) throw new Error('Unsafe browser profile cleanup path');
  rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
