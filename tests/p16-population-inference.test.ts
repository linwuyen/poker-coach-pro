import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePopulationDeviation, wilson95 } from '../src/learning-engine/populationInference';
import { populationContextKey, populationProfileToStrategyProfile, PopulationExploitProfile } from '../src/strategy-engine-v2/population';

const context={format:'cash' as const,tableSize:'6max' as const,spot:'bb-defense' as const,position:'bb' as const,villainPosition:'btn' as const,stackDepthBB:100,anteBB:0,openSizeBB:2.5};
function exploit():PopulationExploitProfile{return{schemaVersion:1,id:'bb-field',version:'1',name:'BB field response',description:'external',context,source:{label:'study',reference:'study://pool',generatedAt:'2026-08-21T00:00:00Z',sampleSize:50000,methodology:'External strategy response derived and reviewed from tracked pool.',population:'NL100'},exploitRanges:{AKo:{raise:0.6,call:0.4}}};}
const input={id:'fold-vs-cbet',metric:'fold-vs-flop-bet',strategyContextKey:populationContextKey(context),solverBaselineRate:0.5,solverReference:'solver://baseline',populationReference:'pool://split-study',methodology:'Chronological train/holdout split; same predeclared metric.',training:{numerator:6500,denominator:10000},holdout:{numerator:1920,denominator:3000}};

test('P16 Wilson interval is bounded and derived from raw counts',()=>{const interval=wilson95({numerator:650,denominator:1000});assert.ok(interval.low<0.65&&interval.high>0.65);assert.ok(interval.low>=0&&interval.high<=1);});

test('P16 replicated population deviation can link only to evidence-backed matching exploit strategy',()=>{const profile=populationProfileToStrategyProfile(exploit());const result=evaluatePopulationDeviation(input,profile);assert.equal(result.status,'validated-deviation');assert.equal(result.direction,'higher-than-solver');assert.equal(result.exploitEligible,true);assert.equal(result.linkedExploitProfileKey,`${profile.id}@${profile.version}`);});

test('P16 refuses non-replicated or underpowered population claims',()=>{const reversed=evaluatePopulationDeviation({...input,holdout:{numerator:1200,denominator:3000}});assert.equal(reversed.status,'not-replicated');assert.equal(reversed.exploitEligible,false);const small=evaluatePopulationDeviation({...input,training:{numerator:60,denominator:100},holdout:{numerator:30,denominator:50}});assert.equal(small.status,'insufficient');});

test('P16 never synthesizes an exploit from a validated deviation alone',()=>{const result=evaluatePopulationDeviation(input);assert.equal(result.status,'validated-deviation');assert.equal(result.exploitEligible,false);assert.match(result.reasons.join(' '),/no evidence-backed exploit strategy/i);});
