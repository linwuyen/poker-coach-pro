import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { coreScenarios, semanticTeachingScenarios } from '../src/teaching/scenarioCatalog';
import { validateScenarios } from '../src/utils/validateScenarios';
import * as training from '../src/features/training/TrainingSession';
import type { HistoryItem } from '../src/types';
import { tournamentTrainingScenarios, tournamentEvaluationScenarios } from '../src/teaching/tournamentMathScenarios';
import { inferScenarioStepSkillIds } from '../src/learning-engine/skillGraph';
import { buildScenarioAnalysisContext } from '../src/features/analysis/analysisContext';

test('river overbet lesson reconciles pot ledger and displayed call price',()=>{
  const scenario=coreScenarios.find(s=>s.id==='81')!;
  const step=scenario.steps[0];
  assert.equal(step.potSize,20.4);
  assert.ok(Math.abs(Number.parseFloat(step.potOdds!)-15/35.4*100)<0.01);
  assert.equal(step.feedbacks.Fold!.bestAction,'Fold');
  assert.ok(Math.abs(step.feedbacks.Call!.evidence!.actionEvBB!-(-0.84))<0.001);
  const broken=structuredClone(scenario); broken.steps[0].potSize=9.5;
  assert.ok(validateScenarios([broken]).some(e=>e.includes('pot accounting')));
});

test('arithmetic exercises do not measure board texture using illustrative cards',()=>{
  for(const scenario of [...semanticTeachingScenarios,...tournamentTrainingScenarios,...tournamentEvaluationScenarios]) {
    const skills=inferScenarioStepSkillIds(scenario,scenario.steps[0]);
    assert.ok(!skills.includes('postflop.board-texture'),scenario.id);
    assert.ok(skills.includes('decision.boundary'),scenario.id);
  }
});

test('symmetric tournament risk is not sent to analysis tools as an actual pot',()=>{
  const scenario=tournamentTrainingScenarios[0],step=scenario.steps[0];
  const feedback=Object.values(step.feedbacks)[0]!;
  const item:HistoryItem={scenarioId:scenario.id,category:[],score:10,judgment:'正確',timestamp:1};
  assert.equal(buildScenarioAnalysisContext(scenario,step,item,feedback).potBB,undefined);
});

test('initial cash math prompt does not reveal its calculated price threshold',()=>{
  const scenario=semanticTeachingScenarios[0];
  const html=renderToStaticMarkup(React.createElement(training.TrainingSession,{scenarios:[scenario],history:[],title:'數學練習',onRecord:()=>{},onExit:()=>{},onComplete:()=>{}}));
  assert.ok(!html.includes(`Pot Odds ${scenario.steps[0].potOdds}`));
  assert.doesNotMatch(scenario.title,/門檻/);
});

test('authored accepted alternatives are accepted and low SPR is not an unconditional rule',()=>{
  for(const scenario of coreScenarios) for(const step of scenario.steps) for(const feedback of Object.values(step.feedbacks)) {
    if(feedback?.judgment==='可接受') assert.ok(feedback.score>=8,`${scenario.id}: accepted option scored wrong`);
  }
  assert.doesNotMatch(coreScenarios.find(s=>s.id==='43')!.steps[0].feedbacks['All-in']!.remember,/自動套池|沒有猶豫/);
  assert.doesNotMatch(coreScenarios.find(s=>s.id==='1')!.steps[0].feedbacks.Check!.why,/中等 kicker/);
});

test('unaided reasoning question hides explanations and the correct reversal until answered',()=>{
  const scenario=semanticTeachingScenarios[0];const step=scenario.steps[0];
  const feedback=Object.values(step.feedbacks).find(f=>f?.score===10)!;
  let item:HistoryItem={scenarioId:scenario.id,category:[],score:10,correct:true,judgment:'正確',timestamp:1};
  for(let i=0;i<100;i++){item={...item,attemptId:`probe-${i}`};if(training.shouldShowReasoningProbe(item,feedback))break;}
  assert.equal(training.shouldShowReasoningProbe(item,feedback),true);
  assert.equal(typeof training.ScenarioExplanation,'function');
  const props={scenario,step,feedback,currentItem:item,selectedAction:feedback.bestAction,handStrength:null,handMath:null,onReasoningProbe:()=>{},onNext:()=>{}};
  const before=renderToStaticMarkup(React.createElement(training.ScenarioExplanation,props));
  assert.ok(before.includes('reasoning-probe'));
  assert.ok(!before.includes('minimal-flip-summary'));
  assert.ok(!before.includes(feedback.why));
  const after=renderToStaticMarkup(React.createElement(training.ScenarioExplanation,{...props,currentItem:{...item,reasoningProbeResult:'pass'}}));
  assert.ok(after.includes('minimal-flip-summary'));
});
