import assert from 'node:assert/strict';
import test from 'node:test';
import { practicalCurriculum } from '../src/teaching/practicalCurriculum';
import { SKILL_GRAPH } from '../src/learning-engine/skillGraph';
const find=(key:string)=>practicalCurriculum.find(s=>s.id===`course-${key}`)!;
test('practical feedback uses actual premises and audited call prices',()=>{
 for(const key of ['cash-9max-value','mtt-turn-flush']) assert.ok(find(key).steps[0].feedbacks[key.startsWith('cash')?'Call':'Bet small']!.score<8);
 for(const scenario of practicalCurriculum) for(const step of scenario.steps){
  const cost=step.potAccounting?.callCostBB;
  if(cost && cost>0) assert.ok(Math.abs(parseFloat(step.potOdds!)-100*cost/(step.potSize+cost))<0.001);
  for(const feedback of Object.values(step.feedbacks)) if(feedback!.score>=8) assert.equal(feedback!.conceptualError,'無');
 }
});
test('every practical decision declares valid skills and legal current cards',()=>{
 const valid=new Set(SKILL_GRAPH.map(s=>s.id));
 for(const scenario of practicalCurriculum) for(const step of scenario.steps){
  assert.ok(step.skillIds?.length,`${scenario.id}/${step.id}`);
  for(const id of step.skillIds!) assert.ok(valid.has(id),id);
  const cards=[...scenario.holeCards,...step.communityCards].map(c=>c.rank+c.suit);
  assert.equal(cards.length,new Set(cards).size);
  assert.equal(step.communityCards.length,{Preflop:0,Flop:3,Turn:4,River:5}[step.street]);
  if(step.potAccounting) assert.ok(Math.abs(step.potAccounting.contributionsBB.reduce((a,b)=>a+b,0)-(step.potAccounting.rakeBB||0)-step.potSize)<1e-5);
 }
});
test('connected value, draw and multiway lessons only follow compatible actions',()=>{
 for(const key of ['mtt-turn-low-spr','mtt-turn-barrel','cash-9max-multiway']){
  const scenario=find(key);assert.ok(scenario.steps.length>=2,key);
  for(const step of scenario.steps) for(const [action,feedback] of Object.entries(step.feedbacks)) if(feedback!.nextStepId!=='next_hand'){
   assert.equal(action,feedback!.bestAction);assert.ok(scenario.steps.some(s=>s.id===feedback!.nextStepId));
  }
 }
 assert.ok(find('cash-depth-pair-short'));assert.ok(find('cash-depth-pair-deep'));
});

test('changed payment premise is separate, while paired depths keep cards and rules',()=>{
 assert.equal(find('mtt-turn-flush').steps[0].feedbacks['Bet small']!.score,6);
 assert.equal(find('mtt-turn-flush-paying').steps[0].feedbacks['Bet small']!.score,10);
 const short=find('cash-depth-pair-short'),deep=find('cash-depth-pair-deep');
 assert.deepEqual(short.holeCards,deep.holeCards);
 assert.deepEqual(short.steps[0].communityCards,deep.steps[0].communityCards);
 assert.deepEqual(short.steps[0].assumptions,deep.steps[0].assumptions);
 assert.ok(short.steps[0].assumptions!.some(text=>text.includes('過牌範圍只有 KQ/KJ/KT') && text.includes('兩對以上已在翻牌加注') && text.includes('超過 21BB')));
 assert.equal(short.steps[0].handState!.heroStackBB,21);assert.equal(deep.steps[0].handState!.heroStackBB,191);
 assert.equal(find('mtt-turn-low-spr').steps[1].potSize,19.9);
 assert.equal(find('mtt-turn-low-spr').steps[1].handState!.villainStackBB,9.8);
 assert.equal(find('mtt-turn-barrel').steps[1].handState!.heroStackBB,20.8);
 assert.equal(find('cash-9max-multiway').steps[1].potSize,23.5);
 assert.equal(find('cash-9max-multiway').steps[1].handState!.villainStackBB,90);
 assert.equal(find('cash-9max-button-response').steps[0].potSize,11.5);
});
