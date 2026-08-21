import assert from 'node:assert/strict';
import test from 'node:test';
import { HistoryItem } from '../src/types';
import { buildFamilyOutcomes, buildLongitudinalPokerReport, buildTrainingPrescriptions } from '../src/learning-engine/longitudinal';

const DAY=86400000,now=Date.parse('2026-08-21T00:00:00Z');
function real(id:string,daysAgo:number,loss:number):HistoryItem{return{schemaVersion:6,trainingType:'real-hand',scenarioId:`r-${id}-${daysAgo}`,decisionFamilyId:id,category:['Real Game'],score:loss<=0.01?10:5,judgment:'verified',timestamp:now-daysAgo*DAY,street:'River',position:'BB',correct:loss<=0.01,truthTier:'verified-solver',utilityLoss:loss,utilityUnit:'bb',utilityModel:'cash-chip-ev',spotFrequencyPer100Hands:2,gameFormat:'Cash'};}
function train(id:string,daysAgo:number,correct:boolean,delayed=false):HistoryItem{return{schemaVersion:6,trainingType:'scenario',scenarioId:`t-${id}-${daysAgo}`,decisionFamilyId:id,category:['Training'],score:correct?10:0,judgment:correct?'ok':'miss',timestamp:now-daysAgo*DAY,correct,isDelayedReview:delayed,street:'River'};}

test('P17 family outcome separates early and recent verified regret without causal overclaim',()=>{const history:HistoryItem[]=[];for(let i=0;i<6;i++)history.push(real('river-catch',80-i,0.4));for(let i=0;i<6;i++)history.push(real('river-catch',10-i,0.15));const outcome=buildFamilyOutcomes(history)[0];assert.equal(outcome.observations,12);assert.ok(outcome.earlyAverageEvLossBB!>outcome.recentAverageEvLossBB!);assert.equal(outcome.improved,true);});

test('P17 prescription prioritizes verified costly leaks with weak recent retention',()=>{const history:HistoryItem[]=[real('river-catch',5,0.4),real('river-catch',4,0.35),real('river-catch',3,0.45),real('river-catch',2,0.3),real('river-catch',1,0.4),train('river-catch',5,false,true),train('river-catch',4,false,true),train('river-catch',3,true,false),real('tiny-leak',2,0.01)];const list=buildTrainingPrescriptions(history,now);assert.equal(list[0].decisionFamilyId,'river-catch');assert.ok(list[0].priority>0);assert.equal(list.some(item=>item.decisionFamilyId==='tiny-leak'),true);});

test('P17 longitudinal report excludes raw HH exposure from verified outcomes',()=>{const raw:HistoryItem={schemaVersion:6,trainingType:'real-hand',scenarioId:'raw',category:['Real Game'],score:0,judgment:'exposure',timestamp:now,gameFormat:'Cash',handsObserved:100};const report=buildLongitudinalPokerReport([raw,real('verified',1,0.2)],now);assert.equal(report.months[0].verifiedDecisions,1);assert.match(report.caveats.join(' '),/observational/i);});
