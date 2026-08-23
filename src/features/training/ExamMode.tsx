import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, EyeOff, ShieldCheck, Timer, Trophy } from 'lucide-react';
import { CardUI } from '../../components/CardUI';
import { scenarios } from '../../data';
import { loadPlayerProfile } from '../../domain/playerProfile';
import { getDifficultyWeight, makeMasteryKey } from '../../learning-engine';
import { getHiddenBenchmarkScenarios } from '../../learning-engine/benchmark';
import { inferSituationIdsFromScenarioStep, scenarioContextFamilyId } from '../../learning-engine/contextIdentity';
import { solverDecisionFamilyId } from '../../learning-engine/semanticPairs';
import { inferScenarioStepSkillIds } from '../../learning-engine/skillGraph';
import { solverCorpusRole } from '../../learning-engine/solverCurriculum';
import { decisionsMatch, loadPokerBenchSplit, parsePokerDecision, POKERBENCH_FILES, POKERBENCH_SOURCE, PokerBenchRow } from '../../solver-data/pokerbench';
import { ActionType, HistoryItem, Scenario } from '../../types';
import { createAttemptId, loadHistory, saveHistory } from '../../utils/history';
import { humanizeSolverMove, humanizeSolverPostflopLine, humanizeSolverPreflopLine, parseSolverCards } from './SolverDecisionSession';

const EXAM_SIZE = 25;
const TARGET_SECONDS = 30;
const ACTION_LABELS: Partial<Record<ActionType, string>> = { Fold:'棄牌', Call:'跟注', Raise:'加注', '3-bet':'3-Bet', '4-bet (Raise)':'4-Bet', 'All-in':'全下', Check:'過牌', 'Bet small':'小注', 'Bet half pot':'半池', 'Bet big':'大注' };
type ExamCandidate = { kind:'scenario'; id:string; scenario:Scenario; stepIndex:number } | { kind:'solver'; id:string; row:PokerBenchRow };

function stableHash(value:string):number{let hash=2166136261;for(let i=0;i<value.length;i+=1){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}return hash>>>0;}
function interleave<T>(left:T[],right:T[]):T[]{const result:T[]=[];for(let i=0;i<Math.max(left.length,right.length);i+=1){if(left[i])result.push(left[i]);if(right[i])result.push(right[i]);}return result;}

export function ExamMode({onExit}:{onExit:()=>void}){
  const profile=useMemo(loadPlayerProfile,[]);
  const [initialHistory]=useState<HistoryItem[]>(loadHistory);
  const [history,setHistory]=useState<HistoryItem[]>(initialHistory);
  const [solverRows,setSolverRows]=useState<PokerBenchRow[]>([]);
  const [loadingSolver,setLoadingSolver]=useState(true);
  const [index,setIndex]=useState(0);
  const [sessionItems,setSessionItems]=useState<HistoryItem[]>([]);
  const [remaining,setRemaining]=useState(TARGET_SECONDS);
  const [submitting,setSubmitting]=useState(false);
  const startedAt=useRef(Date.now());
  const submissionLock=useRef(false);
  const [examSessionId]=useState(()=>`exam-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);

  useEffect(()=>{let cancelled=false;Promise.all([loadPokerBenchSplit('preflop'),loadPokerBenchSplit('postflop')]).then(([preflop,postflop])=>{if(cancelled)return;setSolverRows([...preflop,...postflop].filter(row=>solverCorpusRole(row)==='holdout'));setLoadingSolver(false);}).catch(()=>{if(!cancelled)setLoadingSolver(false);});return()=>{cancelled=true;};},[]);

  const pool=useMemo<ExamCandidate[]>(()=>{
    const holdout=getHiddenBenchmarkScenarios(scenarios,profile);
    const scenarioCandidates:ExamCandidate[]=holdout.flatMap(scenario=>scenario.steps.map((_,stepIndex)=>({kind:'scenario' as const,id:`scenario:${scenario.id}:${stepIndex}`,scenario,stepIndex})));
    const solverCandidates:ExamCandidate[]=solverRows.map(row=>({kind:'solver' as const,id:`solver:${row.split}:${row.id}`,row}));
    const seen=(candidate:ExamCandidate)=>candidate.kind==='scenario'
      ? initialHistory.some(item=>item.trainingType==='benchmark'&&item.scenarioId===candidate.scenario.id&&item.stepId===candidate.scenario.steps[candidate.stepIndex]?.id)
      : initialHistory.some(item=>item.trainingType==='solver-benchmark'&&item.datasetRowId===candidate.row.id);
    const sort=(items:ExamCandidate[])=>[...items].sort((a,b)=>Number(seen(a))-Number(seen(b))||stableHash(a.id)-stableHash(b.id));
    return interleave(sort(scenarioCandidates),sort(solverCandidates)).slice(0,EXAM_SIZE);
  },[initialHistory,profile,solverRows]);

  const candidate=pool[index];
  const complete=!loadingSolver&&pool.length>0&&index>=pool.length;
  useEffect(()=>{if(!candidate)return;submissionLock.current=false;setSubmitting(false);setRemaining(TARGET_SECONDS);startedAt.current=Date.now();const timer=window.setInterval(()=>setRemaining(v=>Math.max(0,v-1)),1000);return()=>window.clearInterval(timer);},[candidate?.id]);

  function persist(item:HistoryItem){setSessionItems(prev=>[...prev,item]);setHistory(prev=>{const next=[...prev,item];saveHistory(next);return next;});setIndex(v=>v+1);}

  function answerScenario(action:ActionType){
    if(!candidate||candidate.kind!=='scenario'||submissionLock.current)return;
    const scenario=candidate.scenario;const step=scenario.steps[candidate.stepIndex];const feedback=step?.feedbacks[action];if(!step||!feedback)return;
    submissionLock.current=true;setSubmitting(true);const now=Date.now();const correct=feedback.score>=8;
    const hasVerifiedCashEv=scenario.type==='Cash Game'&&typeof feedback.evidence?.evLossBB==='number'&&Number.isFinite(feedback.evidence.evLossBB)&&(feedback.evidence.sourceConfidence==='exact-math'||feedback.evidence.sourceConfidence==='verified-solver');
    persist({schemaVersion:6,attemptId:createAttemptId(),trainingType:'benchmark',scenarioId:scenario.id,decisionFamilyId:scenario.decisionFamilyId||scenario.id,stepId:step.id,masteryKey:makeMasteryKey(scenario.decisionFamilyId||scenario.id,step.id),skillIds:inferScenarioStepSkillIds(scenario,step),situationIds:inferSituationIdsFromScenarioStep(scenario,step),category:[...(scenario.category||[]),...(step.conceptIds||[]),'Hidden Exam'],score:feedback.score,judgment:feedback.judgment,timestamp:now,selectedAction:action,bestAction:feedback.bestAction,street:step.street,position:scenario.position,durationMs:now-startedAt.current,correct,feedbackQuality:correct?'best':'major-error',chosenEvBB:feedback.evidence?.actionEvBB,bestEvBB:feedback.evidence?.bestEvBB,evLossBB:feedback.evidence?.evLossBB,truthTier:feedback.evidence?.sourceConfidence||'expert-baseline',difficultyWeight:getDifficultyWeight(scenario.difficulty),isReview:false,isDelayedReview:false,isUnseen:!initialHistory.some(item=>item.trainingType==='benchmark'&&item.scenarioId===scenario.id&&item.stepId===step.id),isTransferTest:true,transferLevel:'structural',questionLabel:scenario.title,gameFormat:scenario.type==='Tournament'?'MTT':'Cash',contextFamilyId:scenarioContextFamilyId(scenario),utilityUnit:hasVerifiedCashEv?'bb':undefined,utilityModel:hasVerifiedCashEv?'cash-chip-ev':undefined,examSessionId,examMode:true,notes:`Hidden exam. ${remaining===0?'30-second target exceeded.':'Answered inside 30-second target.'} Feedback intentionally withheld until exam completion.`});
  }

  function answerSolver(move:string){
    if(!candidate||candidate.kind!=='solver'||submissionLock.current)return;
    submissionLock.current=true;setSubmitting(true);const row=candidate.row;const now=Date.now();const correct=decisionsMatch(move,row.correctDecision);const selected=parsePokerDecision(move);const best=parsePokerDecision(row.correctDecision);const family=solverDecisionFamilyId(row);
    persist({schemaVersion:6,attemptId:createAttemptId(),trainingType:'solver-benchmark',scenarioId:`exam-solver:${row.split}:${row.id}`,decisionFamilyId:family,stepId:'solver-decision',masteryKey:makeMasteryKey(family,'solver-decision'),skillIds:[row.split==='preflop'?'preflop.solver-decision':'postflop.solver-decision'],situationIds:[`situation.position.${row.heroPosition.toLowerCase()}`,row.split==='preflop'?'situation.street.preflop':`situation.street.${row.evaluationAt.toLowerCase()}`],category:['PokerBench','Hidden Exam',row.split==='preflop'?'Preflop':row.evaluationAt],score:correct?10:0,judgment:correct?'正確':'錯誤',timestamp:now,selectedAction:move,bestAction:row.correctDecision,selectedDecision:selected.action,bestDecision:best.action,street:row.split==='preflop'?'Preflop':row.evaluationAt,position:row.heroPosition,durationMs:now-startedAt.current,correct,feedbackQuality:correct?'best':'major-error',truthTier:'verified-solver',truthSourceId:POKERBENCH_SOURCE.id,truthSourceRef:POKERBENCH_SOURCE.dataset,truthSourceLicense:POKERBENCH_SOURCE.license,truthSourceRevision:POKERBENCH_SOURCE.revision,datasetSplit:POKERBENCH_FILES[row.split].split,datasetRowId:row.id,isReview:false,isDelayedReview:false,isUnseen:!initialHistory.some(item=>item.trainingType==='solver-benchmark'&&item.datasetRowId===row.id),isTransferTest:true,transferLevel:'structural',solverCorpusRole:'holdout',gameFormat:'Cash',examSessionId,examMode:true,questionLabel:`Hidden Solver · ${row.holding}`,notes:`${POKERBENCH_SOURCE.label} holdout row. Exact optimal label only; feedback withheld until exam completion.`});
  }

  if(loadingSolver)return <div className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-500">正在建立 hidden exam pool…</div>;
  if(!pool.length)return <EmptyExam onExit={onExit}/>;
  if(complete)return <ExamReport items={sessionItems} onExit={onExit}/>;
  const progress=Math.round(index/pool.length*100);
  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8" data-testid="exam-mode">
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <button type="button" onClick={onExit} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-400"><ArrowLeft className="h-4 w-4"/>離開 Exam</button>
        <div className="min-w-[220px] flex-1">
          <div className="flex justify-between text-sm"><b>Hidden Exam · 不給即時答案</b><span className="font-mono text-slate-500">{index+1}/{pool.length}</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-amber-400" style={{width:`${progress}%`}}/></div>
        </div>
        <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs ${remaining>0?'border-slate-700 text-slate-300':'border-red-500/30 bg-red-500/8 text-red-300'}`}><Timer className="h-4 w-4"/>{remaining}s</div>
      </header>
      <section className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5"><div className="flex items-center gap-2 text-xs font-semibold text-amber-200"><EyeOff className="h-4 w-4"/>Exam isolation</div><p className="mt-2 text-sm leading-6 text-slate-400">只取 hidden scenario holdout 與 PokerBench holdout。每題作答後直接進下一題，不顯示正誤、解說或工具；全部完成才出報告。30 秒是決策時間目標，超時會記錄但不替你亂選答案。</p></section>
      {candidate.kind==='scenario'?<ScenarioExamCard candidate={candidate} disabled={submitting} onAnswer={answerScenario}/>:<SolverExamCard row={candidate.row} disabled={submitting} onAnswer={answerSolver}/>} 
    </div>
  </div>;
}

function ScenarioExamCard({candidate,disabled,onAnswer}:{candidate:Extract<ExamCandidate,{kind:'scenario'}>;disabled:boolean;onAnswer:(action:ActionType)=>void}){const{scenario,stepIndex}=candidate;const step=scenario.steps[stepIndex];return <section className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 md:p-8"><div className="text-xs text-slate-500">{scenario.type} · {scenario.position} · {step.street} · Effective {scenario.effectiveStack}</div><h2 className="mt-2 text-xl font-bold">{scenario.title}</h2><div className="mt-5 rounded-2xl border border-emerald-500/15 bg-slate-950/45 p-6 text-center"><div className="flex min-h-20 items-center justify-center gap-2">{step.communityCards.length?step.communityCards.map((card,i)=><CardUI key={`${card.rank}-${card.suit}-${i}`} card={card} size="sm"/>):<span className="text-xs text-slate-600">Preflop</span>}</div><div className="mt-4 font-mono text-sm text-emerald-300">Pot {step.potSize} BB</div><div className="mt-5 flex justify-center gap-2">{scenario.holeCards.map((card,i)=><CardUI key={`${card.rank}-${card.suit}-${i}`} card={card} size="sm"/>)}</div></div><div className="mt-4 grid gap-3 md:grid-cols-2"><Context label="前序行動" value={scenario.preAction}/><Context label="現在的問題" value={step.description}/></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{step.options.map(action=><button data-testid="exam-action" key={action} type="button" disabled={disabled} onClick={()=>onAnswer(action)} className="rounded-xl border border-slate-700 bg-slate-950/35 p-4 text-left text-sm font-semibold hover:border-amber-500/40 disabled:cursor-not-allowed disabled:opacity-40">{ACTION_LABELS[action]||action}</button>)}</div></section>;}
function SolverExamCard({row,disabled,onAnswer}:{row:PokerBenchRow;disabled:boolean;onAnswer:(move:string)=>void}){const hero=parseSolverCards(row.holding);const board=row.split==='postflop'?parseSolverCards(`${row.boardFlop}${row.boardTurn||''}${row.boardRiver||''}`):[];const preflop=row.split==='preflop'?humanizeSolverPreflopLine(row.prevLine):humanizeSolverPreflopLine(row.preflopAction);const postflop=row.split==='postflop'?humanizeSolverPostflopLine(row.postflopAction):'';return <section className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 md:p-8"><div className="text-xs text-slate-500">PokerBench Holdout · {row.heroPosition} · {row.split==='preflop'?'Preflop':row.evaluationAt}</div><div className="mt-5 rounded-2xl border border-emerald-500/15 bg-slate-950/45 p-6 text-center"><div className="flex min-h-20 items-center justify-center gap-2">{board.length?board.map((card,i)=><CardUI key={`${card.rank}-${card.suit}-${i}`} card={card} size="sm"/>):<span className="text-xs text-slate-600">Preflop</span>}</div><div className="mt-4 font-mono text-sm text-emerald-300">Pot {row.potSize} BB</div><div className="mt-5 flex justify-center gap-2">{hero.map((card,i)=><CardUI key={`${card.rank}-${card.suit}-${i}`} card={card} size="sm"/>)}</div></div><div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/35 p-4 text-sm leading-7 text-slate-300"><div><span className="text-slate-500">翻前：</span>{preflop}</div>{postflop&&<div><span className="text-slate-500">翻後：</span>{postflop}</div>}</div><div className="mt-5 grid gap-2 sm:grid-cols-2">{row.availableMoves.map(move=><button data-testid="exam-action" key={move} type="button" disabled={disabled} onClick={()=>onAnswer(move)} className="rounded-xl border border-slate-700 bg-slate-950/35 p-4 text-left text-sm font-semibold hover:border-amber-500/40 disabled:cursor-not-allowed disabled:opacity-40">{humanizeSolverMove(move)}</button>)}</div></section>;}
function ExamReport({items,onExit}:{items:HistoryItem[];onExit:()=>void}){const correctCount=items.filter(i=>i.correct).length;const accuracy=items.length?Math.round(correctCount/items.length*100):0;const evItems=items.filter(i=>i.utilityUnit==='bb'&&i.utilityModel==='cash-chip-ev'&&typeof i.evLossBB==='number');const averageEv=evItems.length?evItems.reduce((s,i)=>s+Math.max(0,i.evLossBB||0),0)/evItems.length:undefined;const timePressureErrors=items.filter(i=>i.correct===false&&(i.durationMs||0)>TARGET_SECONDS*1000).length;const highEv=evItems.filter(i=>(i.evLossBB||0)>=0.5).length;const wrong=items.filter(i=>i.correct===false);const leaks=[...new Set(wrong.flatMap(i=>i.skillIds?.length?i.skillIds:i.category).filter(Boolean))].slice(0,3);return <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100" data-testid="exam-report"><div className="mx-auto max-w-5xl"><section className="rounded-3xl border border-amber-500/20 bg-amber-500/6 p-7"><div className="flex items-center gap-2 text-xs font-semibold text-amber-200"><Trophy className="h-4 w-4"/>Hidden Exam Report</div><h1 className="mt-3 text-3xl font-bold">現在才揭露答案</h1><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Decision accuracy" value={`${accuracy}%`}/><Metric label="Verified EV loss" value={averageEv===undefined?'Unavailable':`${averageEv.toFixed(3)} BB/decision`}/><Metric label="High-EV mistakes" value={String(highEv)}/><Metric label="Time-pressure errors" value={String(timePressureErrors)}/></div>{leaks.length>0&&<div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-xs text-slate-500">主要 leak</div><div className="mt-2 text-sm text-slate-200">{leaks.join(' · ')}</div></div>}</section><section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-400"/>逐題結果</div><div className="divide-y divide-slate-800">{items.map((item,i)=><div key={item.attemptId||i} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><div className="font-medium">{item.questionLabel||item.scenarioId}</div><div className="mt-1 text-xs text-slate-500">你：{item.selectedAction||'-'} · 最佳：{item.bestAction||'-'}{typeof item.evLossBB==='number'?` · EV loss ${item.evLossBB.toFixed(2)} BB`:''}</div></div><span className={item.correct?'text-emerald-300':'text-red-300'}>{item.correct?'正確':'需修正'}</span></div>)}</div></section><div className="mt-5 rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 text-sm leading-6 text-slate-400">答案已揭露；本次 holdout session 不允許立即重考。請先返回，再從 Train 重新進入 Hidden Exam，讓系統以最新 history snapshot 建立新的評估 pool。</div><div className="mt-5"><button data-testid="exam-exit-after-report" type="button" onClick={onExit} className="rounded-xl border border-slate-700 px-5 py-3 text-slate-300">返回</button></div></div></div>;}
function EmptyExam({onExit}:{onExit:()=>void}){return <div className="grid min-h-screen place-items-center bg-slate-950 p-6 text-slate-100"><div className="max-w-lg rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center"><EyeOff className="mx-auto h-8 w-8 text-slate-400"/><h1 className="mt-4 text-xl font-semibold">沒有可用的 Hidden Exam 題</h1><p className="mt-2 text-sm text-slate-500">系統不會拿 training 題冒充 holdout。請確認 hidden split / PokerBench holdout 可用。</p><button type="button" onClick={onExit} className="mt-5 rounded-xl border border-slate-700 px-4 py-2 text-sm">返回</button></div></div>;}
function Context({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-[10px] uppercase tracking-[0.16em] text-slate-600">{label}</div><div className="mt-2 text-sm leading-6 text-slate-300">{value}</div></div>;}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 font-mono text-xl font-bold">{value}</div></div>;}
