import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const HOST = '127.0.0.1';
const PREVIEW_PORT = 4187;
const DEBUG_PORT = 9247;
const BASE_URL = `http://${HOST}:${PREVIEW_PORT}/poker-coach-pro/`;
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
async function evaluate(send,expression,returnByValue=true){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Runtime.evaluate failed');return result.result?.value;}
async function waitFor(send,expression,description,attempts=140){for(let index=0;index<attempts;index+=1){if(await evaluate(send,expression))return;await sleep(125);}throw new Error(`Timed out waiting for ${description}`);}
async function terminate(child){if(!child||child.exitCode!==null)return;const waitForExit=timeoutMs=>new Promise(resolve=>{if(child.exitCode!==null)return resolve();const timer=setTimeout(resolve,timeoutMs);child.once('exit',()=>{clearTimeout(timer);resolve();});});child.kill('SIGTERM');await waitForExit(1500);if(child.exitCode===null){child.kill('SIGKILL');await waitForExit(1500);}}

export { HOST, PREVIEW_PORT, DEBUG_PORT, BASE_URL, VITE_BIN, sleep, waitHttp, browserCommand, waitForChrome, connectCdp, evaluate, waitFor, terminate };
