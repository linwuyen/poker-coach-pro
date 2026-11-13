import assert from 'node:assert/strict';
import test from 'node:test';
import { semanticTeachingScenarios } from '../src/teaching/scenarioCatalog';

test('all cash lesson EVs can be recomputed from the numbers shown to the learner', () => {
  for (const scenario of semanticTeachingScenarios) {
    const step = scenario.steps[0];
    if (scenario.id.startsWith('math-pot-odds-')) {
      const input = /Pot before call ([\d.]+)BB · Call ([\d.]+)BB · Given equity ([\d.]+)%/.exec(step.description)!;
      assert.ok(input, scenario.id);
      const [, p, c, e] = input.map(Number);
      assert.ok(Math.abs(step.feedbacks.Call!.evidence!.actionEvBB! - (e / 100 * (p + c) - c)) <= .000501, scenario.id);
    } else {
      const input = /Pot ([\d.]+)BB · Bet ([\d.]+)BB .*Given fold rate ([\d.]+)%/.exec(step.description)!;
      assert.ok(input, scenario.id);
      const [, p, b, f] = input.map(Number);
      const bet = step.options.find(action => action !== 'Check')!;
      assert.ok(Math.abs(step.feedbacks[bet]!.evidence!.actionEvBB! - (f / 100 * p - (1 - f / 100) * b)) <= .000501, scenario.id);
    }
  }
});
