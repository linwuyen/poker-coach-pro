import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const HOST = '127.0.0.1';
const PREVIEW_PORT = Number(process.env.POKER_E2E_PORT || 4188);
const DEBUG_PORT = Number(process.env.POKER_E2E_DEBUG_PORT || 9248);
const BASE_URL = process.env.POKER_E2E_BASE_URL || `http://${HOST}:${PREVIEW_PORT}/poker-coach-pro/`;
const VITE_BIN = join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitHttp(url, attempts = 80) { for (let index=0;index<attempts;index+=1){try{const response=await fetch(url);if(response.ok)return response;}catch{}await sleep(125);}throw new Error(`Timed out waiting for ${url}`); }
function commandExists(command){return spawnSync(command,['--version'],{stdio:'ignore',windowsHide:true}).status===0;}
function browserCommand(){
 if(process.env.CHROME_PATH){if(existsSync(process.env.CHROME_PATH))return process.env.CHROME_PATH;throw new Error('CHROME_PATH does not point to an existing browser executable.');}
 if(process.platform==='win32'){
  const roots=[process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA,'C:\\Program Files','C:\\Program Files (x86)'].filter(Boolean);
  for(const root of roots)for(const suffix of ['Google/Chrome/Application/chrome.exe','Microsoft/Edge/Application/msedge.exe']){const candidate=join(root,...suffix.split('/'));if(existsSync(candidate))return candidate;}
 }else{
  for(const candidate of ['google-chrome','google-chrome-stable','chromium','chromium-browser'])if(commandExists(candidate))return candidate;
  const macChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';if(existsSync(macChrome))return macChrome;
 }
 throw new Error('Chrome/Chromium or Edge is required for browser E2E; set CHROME_PATH if it is installed elsewhere.');
}
async function waitForChrome(child,stderr,attempts=160){const url=`http://${HOST}:${DEBUG_PORT}/json/version`;for(let index=0;index<attempts;index+=1){if(child.exitCode!==null)throw new Error(`Chrome exited before CDP was ready (exit=${child.exitCode}). ${stderr().trim()}`);try{const response=await fetch(url);if(response.ok)return response;}catch{}await sleep(125);}throw new Error(`Timed out waiting for ${url}. Chrome exit=${child.exitCode}. ${stderr().trim()}`);}
async function connectCdp(webSocketDebuggerUrl){const socket=new WebSocket(webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});let nextId=1;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(!message.id)return;const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);if(message.error)waiter.reject(new Error(message.error.message));else waiter.resolve(message.result);});const send=(method,params={})=>new Promise((resolve,reject)=>{const id=nextId++;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});return{socket,send};}
async function evaluate(send,expression,returnByValue=true){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime.evaluate failed');return result.result?.value;}
async function waitFor(send,expression,description,attempts=140){for(let index=0;index<attempts;index+=1){if(await evaluate(send,expression))return;await sleep(125);}throw new Error(`Timed out waiting for ${description}`);}
async function navigateRoute(send,hash,expectedText){await evaluate(send,`location.hash = ${JSON.stringify(hash)}; true`);await waitFor(send,`!document.querySelector('[data-testid="route-loading"]') && document.body.textContent.includes(${JSON.stringify(expectedText)})`,`${hash||'root'} lazy route: ${expectedText}`);}
async function readExamProgress(send){const text=await evaluate(send,`document.querySelector('[data-testid="exam-mode"] header span.font-mono')?.textContent || ''`);const [index,total]=String(text).trim().split('/').map(Number);return Number.isFinite(index)&&Number.isFinite(total)?{index,total}:null;}
async function waitExamProgress(send,index,total,attempts=140){for(let attempt=0;attempt<attempts;attempt+=1){const progress=await readExamProgress(send);if(progress?.index===index&&progress?.total===total)return progress;await sleep(125);}throw new Error(`Timed out waiting for Hidden Exam progress ${index}/${total}`);}
async function assertVisibleBoard(send,description){
 const context=await evaluate(send,'('+(()=>{
  const table=document.querySelector('[data-testid="solver-decision-session"], [data-testid="frictionless-training-session"], [data-testid="exam-mode"]');
  if(!table)return null;
  const dimensions=document.querySelector('[data-testid="infinite-dimensions"]')?.textContent||'';
  const metadata=table.querySelector('section > div.text-xs.text-slate-500')?.textContent||'';
  const street=(dimensions.match(/\b(Preflop|Flop|Turn|River)\b/)||metadata.match(/\b(Preflop|Flop|Turn|River)\b/)||table.textContent.match(/\b(Preflop|Flop|Turn|River)\b/))?.[1];
  return{street,boardCount:table.querySelectorAll('[data-card-code]').length-2,text:table.textContent.slice(0,1000)};
 }).toString()+')()');
 if(!context||!context.street)throw new Error('Cannot read decision street for '+description+': '+JSON.stringify(context));
 const expected={Preflop:0,Flop:3,Turn:4,River:5}[context.street];
 if(context.boardCount!==expected)throw new Error(description+' exposes '+context.boardCount+' board cards at '+context.street+' (expected '+expected+').');
 return context;
}
async function completeReasoningProbe(send){
 if(await evaluate(send,`Boolean(document.querySelector('[data-testid="reasoning-probe-skip"]'))`)){
  if(await evaluate(send,`Boolean(document.querySelector('[data-testid="advanced-analysis-tools"]'))`))throw new Error('Analysis tools leaked before the unaided probe.');
  await evaluate(send,`document.querySelector('[data-testid="reasoning-probe-skip"]').click(); true`);
  await waitFor(send,`!document.querySelector('[data-testid="reasoning-probe-skip"]') || Boolean(document.querySelector('[data-testid="advanced-analysis-tools"]'))`,'probe skip reveals explanation');
 }
}
async function completeExam(send,format,beforeHistory){
 const label=format==='MTT'?'錦標賽 MTT':'現金桌 Cash';
 for(let step=0;step<30;step+=1){
  if(await evaluate(send,`Boolean(document.querySelector('[data-testid="exam-report"]'))`))break;
  const progress=await readExamProgress(send);if(!progress)throw new Error('Exam progress disappeared.');
  const header=await evaluate(send,`document.querySelector('[data-testid="exam-mode"] header')?.textContent || ''`);
  if(!header.includes(label))throw new Error('Hidden Exam changed format: '+header);
  await assertVisibleBoard(send,format+' hidden exam '+progress.index);
  if(await evaluate(send,`Boolean(document.querySelector('[data-testid="decision-explanation"], [data-testid="solver-auto-analysis"], [data-testid="advanced-analysis-tools"]'))`))throw new Error('Hidden Exam leaked explanation/tools.');
  await evaluate(send,`document.querySelector('[data-testid="exam-action"]')?.click(); true`);
  await waitFor(send,`Boolean(document.querySelector('[data-testid="exam-report"]')) || document.querySelector('[data-testid="exam-mode"] header span.font-mono')?.textContent?.trim() !== ${JSON.stringify(progress.index+'/'+progress.total)}`,'next hidden exam question/report');
 }
 await waitFor(send,`Boolean(document.querySelector('[data-testid="exam-report"]'))`,format+' completed exam report');
 const records=await evaluate(send,`JSON.parse(localStorage.getItem('poker_training_history_v6')||'[]').slice(${beforeHistory})`);
 if(!records.length||records.some(item=>!item.examMode||!item.examCompletedAt||item.gameFormat!==format))throw new Error(format+' Hidden Exam persisted mixed formats or incomplete evidence: '+JSON.stringify(records));
 console.log('Verified '+format+' Hidden Exam: '+records.length+' completed records, one format.');
}
async function verifyCourseLessons(send,format,ids){
 for(const id of ids){
  await navigateRoute(send,'','Closed-loop Infinite Trainer');
  await waitFor(send,`Boolean(document.querySelector('[data-testid="curriculum-panel"]'))`,'curriculum panel');
  await evaluate(send,`document.querySelector('[data-testid="course-${id}"]').click();true`);
  await waitFor(send,`Boolean(document.querySelector('[data-testid="decision-action"]'))`,id+' lesson');
  await assertVisibleBoard(send,id);
  await evaluate(send,`document.querySelector('[data-testid="decision-action"]').click();true`);
  await waitFor(send,`JSON.parse(localStorage.getItem('poker_training_history_v6')||'[]').some(i=>i.scenarioId===${JSON.stringify(id)}&&i.gameFormat===${JSON.stringify(format)})`,id+' lesson persisted');
  await completeReasoningProbe(send);
  await waitFor(send,`Boolean(document.querySelector('[data-testid="decision-next"]'))&&!document.querySelector('[data-testid="decision-next"]').disabled`,id+' next enabled');
  await evaluate(send,`document.querySelector('[data-testid="decision-next"]').click();true`);
  await waitFor(send,`document.body.textContent.includes('這批決策完成')`,id+' lesson completed');
  await evaluate(send,`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='繼續')?.click();true`);
  await waitFor(send,`Boolean(document.querySelector('[data-testid="curriculum-panel"]'))`,id+' return to curriculum');
 }
 console.log('Verified '+format+' selectable courses: '+ids.length);
}
async function verifyRestrictedTournamentExam(send) {
 await navigateRoute(send,'','Closed-loop Infinite Trainer');
 const previousProfile=await evaluate(send,`localStorage.getItem('poker_player_profile_v1')`);
 await evaluate(send,`localStorage.setItem('poker_player_profile_v1',JSON.stringify({schemaVersion:1,formats:['tournament'],tableSizes:['6max'],stackBands:['40-100'],experience:'intermediate',focusAreas:['mixed'],dailyQuestions:12,onboardingComplete:true,updatedAt:Date.now()})); true`);
 await navigateRoute(send,'#exam-mode','Hidden Exam');
 await waitFor(send,`Boolean(document.querySelector('[data-testid="exam-action"]'))`,'restricted MTT exam');
 const progress=await readExamProgress(send);
 if(progress?.total!==25)throw new Error('Restricted 6max/40-100BB MTT exam did not fill25 questions: '+JSON.stringify(progress));
 const before=await evaluate(send,`JSON.parse(localStorage.getItem('poker_training_history_v6')||'[]').length`);
 await completeExam(send,'MTT',before);
 await evaluate(send,previousProfile===null?`localStorage.removeItem('poker_player_profile_v1');true`:`localStorage.setItem('poker_player_profile_v1',${JSON.stringify(previousProfile)});true`);
 console.log('Verified complete25-question MTT exam with6max/40-100BB preferences.');
}
async function verifyContrastiveContext(send) {
 await navigateRoute(send,'#contrastive-trainer','Contrastive Trainer');
 await waitFor(send,`document.querySelectorAll('[data-testid="contrastive-spot"]').length===2`,'contrastive pair');
 const texts=await evaluate(send,`Array.from(document.querySelectorAll('[data-testid="contrastive-spot"]')).map(el=>el.textContent)`);
 for(const text of texts) if(!/底池：\d/.test(text)||!text.includes('翻前：')||!text.includes('翻後：')||!text.includes('目前剩餘籌碼'))throw new Error('Contrastive decision missing visible context: '+text);
 console.log('Verified both contrastive cards show pot, action histories and stack limits.');
}
async function setLabeledInput(send,label,value){
 await evaluate(send,`(()=>{const el=Array.from(document.querySelectorAll('label')).find(l=>l.textContent.includes(${JSON.stringify(label)}))?.querySelector('input');if(!el)throw new Error('Missing input '+${JSON.stringify(label)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
}
async function verifyNumericInputSafety(send){
 await navigateRoute(send,'#icm-workbench','Tournament $EV Workbench');
 await setLabeledInput(send,'完整剩餘玩家','25 -40 18 12 7');
 await waitFor(send,`document.querySelector('[role="alert"]')?.textContent.includes('第 2 項')`,'invalid ICM roster error');
 if(await evaluate(send,`document.querySelector('select')?.options.length`)!==5)throw new Error('Invalid ICM player silently removed/reindexed');
 if(await evaluate(send,`document.body.textContent.includes('ICM Break-even')`))throw new Error('Invalid ICM input retained a calculated result');
 await setLabeledInput(send,'完整剩餘玩家',' 25 40 18 12 7 ');
 await waitFor(send,`!document.querySelector('[role="alert"]')&&document.body.textContent.includes('ICM Break-even')`,'valid ICM roster recovery');
 if(await evaluate(send,`document.querySelector('select')?.options.length`)!==5)throw new Error('Whitespace invented an ICM player');
 await navigateRoute(send,'#equity-workbench','Exact Equity Engine');
 await setLabeledInput(send,'Monte Carlo iterations','Infinity');
 await evaluate(send,`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='重新計算').click();true`);
 await waitFor(send,`document.querySelector('[role="alert"]')?.textContent.includes('iterations')`,'nonfinite equity iteration error');
 await setLabeledInput(send,'Monte Carlo iterations','1000');
 await evaluate(send,`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='重新計算').click();true`);
 await waitFor(send,`!document.querySelector('[role="alert"]')&&document.body.textContent.includes('Hero Equity')`,'valid equity recovery');
 console.log('Verified invalid ICM roster/Infinity rejection, stable player indices and valid-input recovery.');
}
async function verifySecondTournamentExam(send){
 const before=await evaluate(send,`JSON.parse(localStorage.getItem('poker_training_history_v6')||'[]').length`);
 await navigateRoute(send,'#exam-mode','Hidden Exam');
 await waitFor(send,`Boolean(document.querySelector('[data-testid="exam-action"]'))`,'second MTT exam');
 await completeExam(send,'MTT',before);
 const sessions=await evaluate(send,`(()=>{const all=JSON.parse(localStorage.getItem('poker_training_history_v6')||'[]').filter(i=>i.gameFormat==='MTT'&&i.examCompletedAt);return Object.values(Object.groupBy(all,i=>i.examSessionId));})()`);
 if(sessions.length<2||sessions.slice(-2).some(g=>g.length!==25))throw new Error('MTT did not retain two complete25-question exams');
 const recent=sessions.slice(-2).flat();
 if(new Set(recent.map(i=>i.scenarioId+':'+i.stepId)).size!==50)throw new Error('MTT repeated exposed assessment identities');
 for(const group of sessions.slice(-2))for(const model of ['tournament-chip-ev','icm','satellite','pko'])if(group.filter(i=>i.utilityModel===model).length<6)throw new Error('Unbalanced MTT models: '+model);
 console.log('Verified two fresh MTT exams:50 distinct identities and balanced models');
}
async function assertHonestCorpusDiagnostic(send){
 await navigateRoute(send,'#solver-corpus','PokerBench Solver Curriculum');
 await waitFor(send,`Boolean(document.querySelector('section.pc-enter'))`,'solver corpus question');
 for(let attempt=0;attempt<12;attempt+=1){
  await evaluate(send,'('+(()=>{
   const section=document.querySelector('section.pc-enter');
   const buttons=Array.from(section.querySelectorAll('button'));
   buttons.find(button=>/^(fold|call|check|bet|raise|all.?in)/i.test(button.textContent.trim()))?.click();
   buttons.find(button=>button.textContent.trim()==='位置 / 行動順序')?.click();
   buttons.find(button=>button.textContent.trim()==='非常確定')?.click();
  }).toString()+')()');
  await evaluate(send,`Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='提交 Solver 決策')?.click(); true`);
  await waitFor(send,`document.querySelector('section.pc-enter')?.textContent.includes('你的答案')`,'solver label feedback');
  const item=await evaluate(send,`JSON.parse(localStorage.getItem('poker_training_history_v6')||'[]').at(-1)`);
  if(item?.feedbackQuality==='label-mismatch'){
   const text=await evaluate(send,`document.querySelector('section.pc-enter')?.textContent || ''`);
   if(item.errorType!=='label-mismatch'||!text.includes('資料集標籤不一致（EV未知）'))throw new Error('Label-only disagreement was diagnosed as a strategy/EV error: '+JSON.stringify({errorType:item.errorType,text}));
   return;
  }
  await evaluate(send,`Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='下一題')?.click(); true`);
  await waitFor(send,`!document.querySelector('section.pc-enter')?.textContent.includes('你的答案')`,'next solver label question');
 }
 throw new Error('Did not observe a corpus label mismatch within the diagnostic probe.');
}
async function terminate(child){if(!child||child.exitCode!==null)return;const waitForExit=timeoutMs=>new Promise(resolve=>{if(child.exitCode!==null)return resolve();const timer=setTimeout(resolve,timeoutMs);child.once('exit',()=>{clearTimeout(timer);resolve();});});child.kill('SIGTERM');await waitForExit(1500);if(child.exitCode===null){child.kill('SIGKILL');await waitForExit(1500);}}

const tempRoot=realpathSync(tmpdir());const userData=mkdtempSync(join(tempRoot,'poker-coach-e2e-'));let preview;let chrome;let cdp;let chromeStderr='';
try{
 if(!process.env.POKER_E2E_BASE_URL)preview=spawn(process.execPath,[VITE_BIN,'preview','--host',HOST,'--port',String(PREVIEW_PORT),'--strictPort'],{stdio:['ignore','pipe','pipe'],windowsHide:true});await waitHttp(BASE_URL);
 const browser=browserCommand();console.log(`Browser E2E using ${browser}`);chrome=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--remote-debugging-address=${HOST}`,`--remote-debugging-port=${DEBUG_PORT}`,`--user-data-dir=${userData}`,'--disable-background-networking','--disable-default-apps','--no-first-run','--no-default-browser-check',BASE_URL],{stdio:['ignore','pipe','pipe'],windowsHide:true});chrome.stderr?.on('data',chunk=>{chromeStderr+=String(chunk);});await waitForChrome(chrome,()=>chromeStderr);
 let pages=[];for(let index=0;index<40;index+=1){pages=await(await fetch(`http://${HOST}:${DEBUG_PORT}/json/list`)).json();if(pages.some(page=>page.type==='page'&&page.webSocketDebuggerUrl))break;await sleep(100);}const page=pages.find(candidate=>candidate.type==='page'&&candidate.webSocketDebuggerUrl);if(!page)throw new Error('No Chrome page target found.');cdp=await connectCdp(page.webSocketDebuggerUrl);await cdp.send('Runtime.enable');await cdp.send('Page.enable');await waitFor(cdp.send,`document.readyState === 'complete'`,'initial page load');await waitFor(cdp.send,`Boolean(document.querySelector('[data-testid="volume-first-home"]'))`,'Infinite Generator Today shell');
 const playerShellText=await evaluate(cdp.send,`document.body.textContent`);if(playerShellText.includes('Hand History')||playerShellText.includes('Truth Ops')||playerShellText.includes('Production Intelligence')||playerShellText.includes('Evidence Ops'))throw new Error('Removed/advanced workbench leaked into primary player shell.');if(playerShellText.includes('你有多確定')||playerShellText.includes('先說你有多確定'))throw new Error('Confidence form leaked into primary player shell.');
 await evaluate(cdp.send,`Array.from(document.querySelectorAll('button')).find(button=>button.textContent?.trim().startsWith('訓練'))?.click(); true`);await waitFor(cdp.send,`Boolean(document.querySelector('[data-testid="volume-training-page"]'))`,'Infinite Generator Train page');if(!await evaluate(cdp.send,`Boolean(document.querySelector('[data-testid="start-exam-mode"]'))`))throw new Error('Hidden Exam entry is not visible from Train.');await evaluate(cdp.send,`document.querySelector('[data-testid="start-volume-session"]').click(); true`);await waitFor(cdp.send,`Boolean(document.querySelector('[data-testid="infinite-training-table"]'))`,'Infinite Hand Generator table');await waitFor(cdp.send,`Boolean(document.querySelector('[data-testid="decision-action"]') || document.querySelector('[data-testid="solver-action"]'))`,'truth-backed decision action');if(await evaluate(cdp.send,`document.body.textContent.includes('你有多確定') || document.body.textContent.includes('先說你有多確定')`))throw new Error('Infinite decision still asks for confidence.');
 const source=await evaluate(cdp.send,`document.querySelector('[data-testid="infinite-source"]')?.textContent || ''`);if(!source)throw new Error('Infinite generator source provenance missing.');if(!await evaluate(cdp.send,`Boolean(document.querySelector('[data-testid="active-learning-signal"]'))`))throw new Error('Active-learning priority signal is missing from the infinite table.');const decisionKind=await evaluate(cdp.send,`document.querySelector('[data-testid="solver-action"]') ? 'solver' : 'scenario'`);if(decisionKind==='solver'){const holeCount=await evaluate(cdp.send,`document.querySelector('[data-testid="solver-hole-cards"]')?.children.length || 0`);if(holeCount!==2)throw new Error(`Solver cards were not rendered as two CardUI nodes (count=${holeCount}).`);}
 await assertVisibleBoard(cdp.send,'Cash practice');
 const beforeHistory=await evaluate(cdp.send,`JSON.parse(localStorage.getItem('poker_training_history_v6') || '[]').length`);await evaluate(cdp.send,`(document.querySelector('[data-testid="decision-action"]') || document.querySelector('[data-testid="solver-action"]')).click(); true`);await waitFor(cdp.send,`JSON.parse(localStorage.getItem('poker_training_history_v6') || '[]').length > ${beforeHistory}`,'automatic decision persistence');const item=await evaluate(cdp.send,`JSON.parse(localStorage.getItem('poker_training_history_v6') || '[]').at(-1)`);if(!['scenario','solver-corpus'].includes(item.trainingType)||'confidence' in item)throw new Error(`Infinite history contract failed: ${JSON.stringify(item)}`);if(item.gameFormat!=='Cash')throw new Error('Cash practice recorded another format: '+JSON.stringify(item));if(typeof item.predictedSuccessProbability!=='number'||typeof item.learningPriorityScore!=='number')throw new Error(`Closed-loop learning telemetry missing: ${JSON.stringify(item)}`);
 const explanationSelector='[data-testid="decision-explanation"], [data-testid="solver-auto-analysis"]';await waitFor(cdp.send,`Boolean(document.querySelector(${JSON.stringify(explanationSelector)}))`,'post-decision explanation');await completeReasoningProbe(cdp.send);if(!await evaluate(cdp.send,`Boolean(document.querySelector('[data-testid="advanced-analysis-tools"]'))`))throw new Error('Advanced analysis tools are not discoverable after the decision.');await waitFor(cdp.send,`document.querySelector('[data-testid="advanced-analysis-tools"]')?.dataset.analysisContextReady === 'true'`,'current hand context capture');const contextHref=await evaluate(cdp.send,`document.querySelector('[data-analysis-route="#current-analysis"]')?.getAttribute('href') || ''`);if(!contextHref.startsWith('#current-analysis?ctx='))throw new Error(`Current-hand analysis link did not carry context: ${contextHref}`);const minimalFlipHref=await evaluate(cdp.send,`document.querySelector('[data-analysis-route="#minimal-flip"]')?.getAttribute('href') || ''`);if(!minimalFlipHref.startsWith('#minimal-flip?ctx='))throw new Error(`Minimal-flip link did not carry context: ${minimalFlipHref}`);await sleep(900);if(!await evaluate(cdp.send,`Boolean(document.querySelector(${JSON.stringify(explanationSelector)}))`))throw new Error(`Explanation auto-advanced away after answer (correct=${item.correct}).`);
 if(decisionKind==='scenario' && await evaluate(cdp.send,`Boolean(document.querySelector('[data-testid="reasoning-probe-skip"]'))`)){await evaluate(cdp.send,`document.querySelector('[data-testid="reasoning-probe-skip"]').click(); true`);}
 const nextSelector=decisionKind==='solver'?'[data-testid="solver-next"]':'[data-testid="decision-next"]';await waitFor(cdp.send,`Boolean(document.querySelector(${JSON.stringify(nextSelector)})) && !document.querySelector(${JSON.stringify(nextSelector)}).disabled`,'explicit Next enabled');await sleep(150);await evaluate(cdp.send,`document.querySelector(${JSON.stringify(nextSelector)}).click(); true`);await waitFor(cdp.send,`(()=>{const history=JSON.parse(localStorage.getItem('poker_training_history_v6')||'[]');const found=history.find(entry=>entry.attemptId===${JSON.stringify(item.attemptId)});return found&&typeof found.trainingDwellMs==='number';})()`,'explicit-Next training dwell upsert');const finalizedItem=await evaluate(cdp.send,`JSON.parse(localStorage.getItem('poker_training_history_v6')||'[]').find(entry=>entry.attemptId===${JSON.stringify(item.attemptId)})`);if(finalizedItem.trainingDwellMs<finalizedItem.durationMs)throw new Error(`Training dwell shorter than decision latency: ${JSON.stringify(finalizedItem)}`);
 await navigateRoute(cdp.send,contextHref,'Current Hand Analysis');if(!await evaluate(cdp.send,`Boolean(document.querySelector('[data-testid="analysis-context-banner"]'))`))throw new Error('Current-hand analysis lost the captured context.');if(!await evaluate(cdp.send,`document.querySelectorAll('[data-card-code]').length >= 2`))throw new Error('Current-hand analysis did not render the captured cards.');
 await navigateRoute(cdp.send,minimalFlipHref,'Minimal Flip Engine');await waitFor(cdp.send,`Boolean(document.querySelector('[data-testid="minimal-flip-result"]') || document.querySelector('[data-testid="minimal-flip-unknown"]'))`,'truth-gated minimal flip result or explicit Unknown');
 await navigateRoute(cdp.send,'#exam-mode','Hidden Exam');await waitFor(cdp.send,`Boolean(document.querySelector('[data-testid="exam-mode"]'))`,'Hidden Exam mode');await waitFor(cdp.send,`Boolean(document.querySelector('[data-testid="exam-action"]'))`,'Hidden Exam decision action');const examHistoryBefore=await evaluate(cdp.send,`JSON.parse(localStorage.getItem('poker_training_history_v6') || '[]').length`);const examProgressBefore=await readExamProgress(cdp.send);if(!examProgressBefore)throw new Error('Hidden Exam progress was not readable before answer.');await evaluate(cdp.send,`(()=>{const button=document.querySelector('[data-testid="exam-action"]');if(!button)return false;button.click();button.click();return true;})()`);await waitExamProgress(cdp.send,examProgressBefore.index+1,examProgressBefore.total);await sleep(300);const examProgressAfter=await readExamProgress(cdp.send);if(!examProgressAfter||examProgressAfter.index!==examProgressBefore.index+1)throw new Error(`Hidden Exam double-click advanced more than once: ${JSON.stringify({examProgressBefore,examProgressAfter})}`);const examHistoryAfter=await evaluate(cdp.send,`JSON.parse(localStorage.getItem('poker_training_history_v6') || '[]').length`);if(examHistoryAfter!==examHistoryBefore)throw new Error(`Incomplete Hidden Exam persisted ${examHistoryAfter-examHistoryBefore} evaluation records before completion.`);if(await evaluate(cdp.send,`Boolean(document.querySelector('[data-testid="decision-explanation"]') || document.querySelector('[data-testid="solver-auto-analysis"]') || document.querySelector('[data-testid="advanced-analysis-tools"]'))`))throw new Error('Hidden Exam leaked correctness/explanation/tools before exam completion.');
 await completeExam(cdp.send,'Cash',examHistoryBefore);
 await verifyCourseLessons(cdp.send,'Cash',['course-cash-rfi','course-cash-catch','course-cash-short','course-cash-9max-value','course-cash-9max-multiway','course-cash-short-value','course-cash-short-draw','course-cash-deep-pot-control','course-cash-deep-nuts']);
 await navigateRoute(cdp.send,'','Closed-loop Infinite Trainer');
 await evaluate(cdp.send,`document.querySelector('[data-testid="track-tournament"]').click(); true`);
 await waitFor(cdp.send,`document.querySelector('[data-testid="track-tournament"]')?.getAttribute('aria-pressed') === 'true' && localStorage.getItem('poker_training_track_v1') === 'tournament'`,'MTT track switching and persistence');
 if(!await evaluate(cdp.send,`document.querySelector('[data-testid="track-curriculum"]')?.textContent.includes('錦標賽')`))throw new Error('MTT curriculum did not follow track selection.');
 await evaluate(cdp.send,`document.querySelector('[data-testid="start-auto-table"]').click(); true`);
 await waitFor(cdp.send,`Boolean(document.querySelector('[data-testid="decision-action"]'))`,'MTT practice decision');
 await assertVisibleBoard(cdp.send,'MTT practice');
 if(await evaluate(cdp.send,`Boolean(document.querySelector('[data-testid="solver-action"]')) || !document.querySelector('[data-testid="frictionless-training-session"]')?.textContent.includes('Tournament')`))throw new Error('Cash/solver question leaked into MTT practice.');
 const mttHistoryBefore=await evaluate(cdp.send,`JSON.parse(localStorage.getItem('poker_training_history_v6')||'[]').length`);
 await evaluate(cdp.send,`document.querySelector('[data-testid="decision-action"]').click(); true`);
 await waitFor(cdp.send,`JSON.parse(localStorage.getItem('poker_training_history_v6')||'[]').length > ${mttHistoryBefore}`,'MTT practice persistence');
 const mttItem=await evaluate(cdp.send,`JSON.parse(localStorage.getItem('poker_training_history_v6')||'[]').at(-1)`);
 if(mttItem.gameFormat!=='MTT')throw new Error('MTT practice recorded another format: '+JSON.stringify(mttItem));
 await completeReasoningProbe(cdp.send);
 await navigateRoute(cdp.send,'#exam-mode','Hidden Exam');
 await waitFor(cdp.send,`Boolean(document.querySelector('[data-testid="exam-action"]'))`,'MTT hidden exam');
 const mttExamBefore=await evaluate(cdp.send,`JSON.parse(localStorage.getItem('poker_training_history_v6')||'[]').length`);
 await completeExam(cdp.send,'MTT',mttExamBefore);
 await verifyCourseLessons(cdp.send,'MTT',['course-mtt-10','course-mtt-15','course-mtt-20','course-mtt-30','course-mtt-40','course-mtt-catch','course-mtt-srp','course-mtt-turn-barrel','course-mtt-turn-flush','course-mtt-turn-low-spr','course-mtt-turn-missed-draw']);
 await verifySecondTournamentExam(cdp.send);
 await verifyRestrictedTournamentExam(cdp.send);
 await navigateRoute(cdp.send,'','Closed-loop Infinite Trainer');
 await evaluate(cdp.send,`document.querySelector('[data-testid="track-cash"]').click(); true`);
 await waitFor(cdp.send,`document.querySelector('[data-testid="track-cash"]')?.getAttribute('aria-pressed') === 'true' && localStorage.getItem('poker_training_track_v1') === 'cash'`,'return to Cash track');
 await navigateRoute(cdp.send,'#hand-history','Closed-loop Infinite Trainer');if(await evaluate(cdp.send,`Boolean(document.querySelector('[data-testid="hand-history-lab"]') || document.querySelector('[data-testid="hh-text"]'))`))throw new Error('Real-game HH route still exists.');await navigateRoute(cdp.send,'#production-intelligence','Closed-loop Infinite Trainer');if(await evaluate(cdp.send,`Boolean(document.querySelector('[data-testid="production-intelligence-dashboard"]'))`))throw new Error('Real-game production intelligence route still exists.');
 await assertHonestCorpusDiagnostic(cdp.send);
 await verifyContrastiveContext(cdp.send);
 await verifyNumericInputSafety(cdp.send);
 await navigateRoute(cdp.send,'#truth-ops','Truth Operations');await navigateRoute(cdp.send,'#strategy-surface','Full Strategy Surface');await navigateRoute(cdp.send,'#fgs-workbench','Finite Game Simulation');await navigateRoute(cdp.send,'#experiment','Randomized N-of-1');await evaluate(cdp.send,`document.querySelector('[data-testid="experiment-create"]').click(); true`);await waitFor(cdp.send,`Boolean(localStorage.getItem('poker_learning_experiment_v1'))`,'N-of-1 experiment persistence');await navigateRoute(cdp.send,'','Closed-loop Infinite Trainer');
 console.log(`Browser E2E PASS: Infinite Hand Generator (${source}) → information-gain telemetry → explicit explanation/Next dwell evidence → context bridge → Minimal Flip truth gate → atomic Hidden Exam buffering/double-click lock → Cash/MTT track switching and separate completed exams → street-visible board checks → legacy HH absent → advanced truth tools intact.`);
 if(process.env.POKER_E2E_SCREENSHOT){const capture=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(process.env.POKER_E2E_SCREENSHOT,Buffer.from(capture.data,'base64'));}
}finally{try{cdp?.socket?.close();}catch{}await terminate(chrome);await terminate(preview);const cleanupTarget=resolve(userData);if(dirname(cleanupTarget)!==resolve(tempRoot)||!basename(cleanupTarget).startsWith('poker-coach-e2e-'))throw new Error('Refusing cleanup outside the E2E temporary profile directory.');try{if(existsSync(cleanupTarget)&&dirname(realpathSync(cleanupTarget))!==tempRoot)throw new Error('E2E profile resolved outside its temporary root.');rmSync(cleanupTarget,{recursive:true,force:true,maxRetries:10,retryDelay:100});}catch(error){console.warn('Could not clean E2E profile: '+error.message);}}
