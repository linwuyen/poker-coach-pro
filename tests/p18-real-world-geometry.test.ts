import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalHoleCombo, findExactVerifiedPostflopNode, PostflopTruthContext, PostflopTruthNode } from '../src/strategy-engine-v3';
import { parseHandHistoryText } from '../src/real-game/handHistory';
import { auditHandHistoryForExactGrading } from '../src/real-game/handHistoryIntegrity';
import { extractObservedPostflopDecisions } from '../src/real-game/postflopState';
import { extractObservedMultiwayDecisions } from '../src/real-game/multiwayState';

const STRADDLE_HH=`PokerStars Hand #18001: Hold'em No Limit ($0.50/$1.00 USD) - 2026/08/21 04:00:00 ET
Table 'Straddle' 6-max Seat #1 is the button
Seat 1: Hero ($100 in chips)
Seat 2: SB ($100 in chips)
Seat 3: BB ($100 in chips)
Seat 4: UTG ($100 in chips)
Seat 5: HJ ($100 in chips)
Seat 6: CO ($100 in chips)
SB: posts small blind $0.50
BB: posts big blind $1
UTG: straddles $2
*** HOLE CARDS ***
Dealt to Hero [As Kd]
UTG: checks
HJ: folds
CO: folds
Hero: raises $4 to $6
SB: folds
BB: folds
UTG: calls $4
*** FLOP *** [Ah 8c 4d]
UTG: checks
Hero: checks
*** TURN *** [Ah 8c 4d] [7s]`;

function solverNode(context:PostflopTruthContext):PostflopTruthNode{return{schemaVersion:3,id:'p18:straddle-a84',version:'1',name:'straddled A84r',description:'P18 fixture',context,source:{type:'solver',trustTier:'verified-solver',label:'fixture',reference:'fixture://p18-straddle',solverName:'FixtureSolver',solverVersion:'1',generatedAt:'2026-08-21T00:00:00Z',disclaimer:'Verified fixture truth used only for deterministic tests.'},strategyByCombo:{[canonicalHoleCombo(['As','Kd'])]:{check:0.4,bet:0.6}},evByCombo:{[canonicalHoleCombo(['As','Kd'])]:{check:1,bet:1.2}},tags:['p18-test'],immutable:true};}

test('P18 straddle is replayed as live forced commitment and cannot match a standard node',()=>{
 const hand=parseHandHistoryText(STRADDLE_HH)[0];const audit=auditHandHistoryForExactGrading(hand);assert.equal(audit.gradeablePreflop,true);assert.equal(audit.gradeablePostflop,true);
 const decision=extractObservedPostflopDecisions(hand,{rakePercent:5,rakeCapBB:2})[0];assert.ok(decision);assert.ok(decision.query.forcedBetKey);assert.equal(decision.query.potBB,13.5);assert.equal(decision.query.toCallBB,0);
 const {heroCards,...rawContext}=decision.query;const context=rawContext as PostflopTruthContext;assert.equal(findExactVerifiedPostflopNode([solverNode(context)],decision.query)?.id,'p18:straddle-a84');
 const standard=solverNode({...context,forcedBetKey:undefined});assert.equal(findExactVerifiedPostflopNode([standard],decision.query),undefined);
});

test('P18 run-it-twice and cashout after all Hero decisions no longer block decision grading',()=>{
 const raw=`PokerStars Hand #18002: Hold'em No Limit ($0.50/$1.00 USD) - 2026/08/21 04:10:00 ET
Table 'RIT' 6-max Seat #1 is the button
Seat 1: Hero ($100 in chips)
Seat 2: V1 ($100 in chips)
Seat 3: V2 ($100 in chips)
Seat 4: V3 ($100 in chips)
Seat 5: V4 ($100 in chips)
Seat 6: V5 ($100 in chips)
V1: posts small blind $0.50
V2: posts big blind $1
*** HOLE CARDS ***
Dealt to Hero [As Kd]
Hero: raises $1.50 to $2.50
V1: folds
V2: calls $1.50
*** FLOP *** [Ah 8c 4d]
V2: checks
Hero: bets $4
V2: raises $93.50 to $97.50 and is all-in
Hero: calls $93.50 and is all-in
Run it twice
Cash Out accepted
*** FIRST TURN *** [Ah 8c 4d] [7s]
*** SECOND TURN *** [Ah 8c 4d] [2s]`;
 const report=auditHandHistoryForExactGrading(parseHandHistoryText(raw)[0]);assert.equal(report.gradeablePostflop,true);assert.equal(report.issues.some(item=>item.code==='run-it-twice-or-multiple-board'||item.code==='cashout'),false);
});

test('P18 multiway replay emits potStructureKey when an active all-in makes side-pot tiers material',()=>{
 const raw=`PokerStars Hand #18003: Hold'em No Limit ($0.50/$1.00 USD) - 2026/08/21 04:20:00 ET
Table 'Side' 6-max Seat #1 is the button
Seat 1: Hero ($100 in chips)
Seat 2: SB ($100 in chips)
Seat 3: BB ($100 in chips)
Seat 4: UTG ($20 in chips)
Seat 5: HJ ($100 in chips)
Seat 6: CO ($100 in chips)
SB: posts small blind $0.50
BB: posts big blind $1
*** HOLE CARDS ***
Dealt to Hero [As Kd]
UTG: raises $19 to $20 and is all-in
HJ: folds
CO: folds
Hero: calls $20
SB: folds
BB: calls $19
*** FLOP *** [Ah 8c 4d]
BB: bets $30
Hero: calls $30
*** TURN *** [Ah 8c 4d] [7s]
BB: checks
Hero: checks
*** SUMMARY ***
Main pot $60.50. Side pot $60.00.`;
 const hand=parseHandHistoryText(raw)[0],audit=auditHandHistoryForExactGrading(hand);assert.equal(audit.gradeablePostflop,true);
 const decisions=extractObservedMultiwayDecisions(hand,{rakePercent:5,rakeCapBB:2});assert.ok(decisions.length>=2);const flop=decisions.find(item=>item.query.street==='Flop');const turn=decisions.find(item=>item.query.street==='Turn');assert.ok(flop?.query.potStructureKey);assert.ok(turn?.query.potStructureKey);assert.notEqual(flop?.query.potStructureKey,turn?.query.potStructureKey);
});

test('P18 unresolved dead-button geometry still fails closed',()=>{
 const raw=STRADDLE_HH.replace('UTG: straddles $2','Dead button');const report=auditHandHistoryForExactGrading(parseHandHistoryText(raw)[0]);assert.equal(report.gradeablePreflop,false);assert.ok(report.issues.some(item=>item.code==='straddle-or-dead-blind'));
});
