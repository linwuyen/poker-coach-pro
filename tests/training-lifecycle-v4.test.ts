import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { InfiniteTrainingTable } from '../src/features/training/InfiniteTrainingTable';
import { TrainingSession, ScenarioExplanation } from '../src/features/training/TrainingSession';
import { SolverDecisionSession } from '../src/features/training/SolverDecisionSession';
import { practicalCurriculum } from '../src/teaching/practicalCurriculum';
import type { HistoryItem } from '../src/types';

// Minimal hook host: exercises component handlers/effects, retaining state until React's
// actual key contract requests a fresh child. No DOM/browser dependency is needed.
function host(seed: Record<number, unknown> = {}) {
  const state: any[] = [], refs: any[] = [], effects: any[] = [];
  const cleanups: (() => void)[] = [];
  Object.assign(state, seed);
  return { dispose() { cleanups.forEach(cleanup => cleanup()); }, render<T>(render: () => T): T {
    const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    const original = internals.H;
    let si = 0, ri = 0, ei = 0;
    const pending: (() => void)[] = [];
    internals.H = {
      useState(initial: any) { const i = si++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], (v: any) => { state[i] = typeof v === 'function' ? v(state[i]) : v; }]; },
      useRef(initial: any) { return refs[ri++] ??= { current: initial }; },
      useMemo(fn: any) { return fn(); },
      useEffect(fn: any, deps: any[]) { const i = ei++; if (!effects[i] || deps.some((v, j) => v !== effects[i][j])) pending.push(() => { const cleanup = fn(); if (typeof cleanup === 'function') cleanups.push(cleanup); }); effects[i] = deps; },
    };
    try { const node = render(); pending.forEach(fn => fn()); return node; } finally { internals.H = original; }
  } };
}
function find(node: any, match: (node: any) => boolean): any {
  if (!node || typeof node !== 'object') return;
  if (match(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, match); if (found) return found; }
}
const byId = (id: string) => (n: any) => n.props?.['data-testid'] === id;
const scenario = practicalCurriculum.find(s => s.id === 'course-mtt-turn-barrel')!;

test('same queued candidate twice yields fresh playable sessions with distinct persisted attempts', async () => {
  const candidate = { id: 'repeat', familyId: 'repeat-family', kind: 'scenario', source: 'curated', scenario, truthLabel: 'teaching', street: 'Turn', position: 'BTN', actionClass: 'bet', stackBand: '25-50' };
  const parent = host({ 2: candidate, 5: [candidate, candidate] });
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} } as any;
  const records = new Map<string, HistoryItem>();
  const props = { scenarioBank: [], history: [], onRecord: (item: HistoryItem) => records.set(item.attemptId!, item), onExit: () => {}, track: 'tournament' as const };
  let childHost = host(), oldKey: string | null = null;
  function render() {
    const tree = parent.render(() => InfiniteTrainingTable(props));
    const child = find(tree, n => n.type === TrainingSession);
    assert.ok(child);
    if (child.key !== oldKey) { childHost = host(); oldKey = child.key; }
    return childHost.render(() => TrainingSession(child.props));
  }
  try {
    for (let pass = 0; pass < 2; pass++) {
      let node = render();
      assert.ok(find(node, byId('decision-action')), 'next presentation must be playable');
      find(node, byId('decision-action')).props.onClick();
      node = render();
      find(node, n => n.type === ScenarioExplanation).props.onNext();
      render();
    }
    assert.equal(records.size, 2);
    assert.ok([...records.values()].every(item => typeof item.trainingDwellMs === 'number'));
    assert.ok(find(render(), byId('decision-action')));
  } finally { parent.dispose(); globalThis.localStorage = originalStorage; }
});

test('transitioning training and solver sessions retain an exit', () => {
  for (const render of [() => TrainingSession({ scenarios: [], history: [], title: 'test', autoComplete: true, onRecord() {}, onExit() {}, onComplete() {} }), () => SolverDecisionSession({ rows: [], history: [], autoComplete: true, onRecord() {}, onExit() {}, onComplete() {} })]) {
    const node = host().render(render);
    assert.ok(find(node, n => n.type === 'button' && n.props.children === '離開'));
  }
});

test('continuation resets actions, hides future board, and upserts each step under its own attempt', () => {
  const turn = scenario.steps[0];
  const action = turn.options[0];
  const linked = { ...scenario, steps: [
    { ...turn, id: 'first', feedbacks: { ...turn.feedbacks, [action]: { ...turn.feedbacks[action]!, nextStepId: 'second' } } },
    { ...turn, id: 'second', street: 'River' as const, description: 'Distinct river decision', preAction: 'River opponent checked after prior action', communityCards: [...turn.communityCards, { rank: '2' as const, suit: 'clubs' as const }], options: ['Check' as const], feedbacks: { Check: { ...turn.feedbacks[action]!, nextStepId: 'next_hand' } } },
  ] };
  const records = new Map<string, HistoryItem>();
  let completions = 0;
  const session = host();
  const props = { scenarios: [linked], history: [], title: 'Linked', autoComplete: true, onRecord: (i: HistoryItem) => records.set(i.attemptId!, i), onExit() {}, onComplete() { completions++; } };
  const render = () => session.render(() => TrainingSession(props));
  let tree = render();
  assert.ok(!find(tree, n => n.props?.value === 'Distinct river decision'));
  assert.ok(!find(tree, n => n.props?.value === 'River opponent checked after prior action'));
  assert.ok(!find(tree, n => n.props?.card?.rank === '2' && n.props?.card?.suit === 'clubs'));
  find(tree, byId('decision-action')).props.onClick();
  tree = render();
  find(tree, n => n.type === ScenarioExplanation).props.onNext();
  tree = render();
  assert.ok(find(tree, n => n.props?.value === 'Distinct river decision'));
  assert.ok(find(tree, n => n.props?.card?.rank === '2' && n.props?.card?.suit === 'clubs'));
  assert.ok(find(tree, n => n.props?.value === 'River opponent checked after prior action'));
  assert.equal(find(tree, byId('decision-action')).props.disabled, false);
  assert.ok(!find(tree, n => n.type === ScenarioExplanation));
  find(tree, byId('decision-action')).props.onClick();
  tree = render();
  find(tree, n => n.type === ScenarioExplanation).props.onNext();
  render(); render();
  assert.equal(completions, 1);
  assert.equal(records.size, 2);
  assert.deepEqual([...records.values()].map(i => i.stepId), ['first', 'second']);
  assert.ok([...records.values()].every(i => typeof i.trainingDwellMs === 'number'));
});

test('correct-answer feedback never renders a red conceptual-error panel', () => {
  const step = scenario.steps[0];
  const feedback = { ...step.feedbacks[step.options[0]]!, conceptualError: '無：這是合理的條件式選擇。' };
  const node = ScenarioExplanation({ scenario, step, feedback, selectedAction: step.options[0], currentItem: { correct: true, scenarioId: scenario.id, category: [], score: 10, judgment: '正確', timestamp: 1 }, handStrength: null, handMath: null, onReasoningProbe() {}, onNext() {} });
  assert.ok(!find(node, n => n.type === 'b' && n.props.children === '核心觀念：'));
});

test('repeating a solver candidate resets submitted state and creates a new attempt', () => {
  const row = { id: 'repeat-solver', split: 'postflop' as const, availableMoves: ['Call', 'Fold'], correctDecision: 'Call', potSize: 18, heroPosition: 'OOP', holding: 'Kh8c', preflopAction: 'SB/3.0bb/BB/call', boardFlop: 'Ks7h2d', boardTurn: 'Jc', boardRiver: '7c', aggressorPosition: 'IP', postflopAction: 'OOP_CHECK/IP_BET_8', evaluationAt: 'River' as const };
  const candidate = { id: 'repeat-solver', familyId: 'repeat-solver-family', kind: 'solver', source: 'pokerbench', row, truthLabel: 'solver', street: 'River', position: 'OOP', actionClass: 'call', stackBand: '80-125' };
  const parent = host({ 2: candidate, 5: [candidate, candidate] });
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} } as any;
  const records = new Map<string, HistoryItem>();
  const props = { scenarioBank: [], history: [], onRecord: (item: HistoryItem) => records.set(item.attemptId!, item), onExit() {} };
  let childHost = host(), oldKey: string | null = null;
  function render() {
    const tree = parent.render(() => InfiniteTrainingTable(props));
    const dimensions = find(tree, byId('infinite-dimensions'));
    assert.ok(!dimensions.props.children.includes('call'), 'pre-answer metadata must not reveal best action');
    const child = find(tree, n => n.type === SolverDecisionSession);
    assert.ok(child);
    if (child.key !== oldKey) { childHost = host(); oldKey = child.key; }
    return childHost.render(() => SolverDecisionSession(child.props));
  }
  try {
    for (let pass = 0; pass < 2; pass++) {
      let node = render();
      const action = find(node, byId('solver-action'));
      assert.ok(action, 'solver must be playable after repeating the same row');
      assert.equal(action.props.disabled, false);
      action.props.onClick();
      node = render();
      find(node, byId('solver-next')).props.onClick();
      render();
    }
    assert.equal(records.size, 2);
    assert.ok([...records.values()].every(item => typeof item.trainingDwellMs === 'number'));
    assert.ok(find(render(), byId('solver-action')));
  } finally { parent.dispose(); globalThis.localStorage = originalStorage; }
});
