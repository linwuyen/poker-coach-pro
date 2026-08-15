import assert from 'node:assert/strict';
import test from 'node:test';
import { companionAdvicePolicy } from '../src/companion/advicePolicy';
import { companionStateFromManual, companionStateFromScenario } from '../src/companion/adapters';
import { analyzeCompanionState } from '../src/companion/companionEngine';
import { clearCompanionHandState, getCompanionHandState, publishCompanionHandState } from '../src/companion/handStateBus';
import { CompanionHandState } from '../src/companion/types';
import { Scenario } from '../src/types';

function scenario(): Scenario {
  return {
    id: 'v9-bb-defense',
    title: 'BB 防守 BTN open',
    category: ['BB 防守'],
    difficulty: '中階',
    type: 'Cash Game',
    blinds: '1/2',
    ante: false,
    userStack: '40BB',
    userBB: 40,
    position: 'BB',
    tableSize: '6max',
    holeCards: [{ rank: 'A', suit: 'spades' }, { rank: 'Q', suit: 'spades' }],
    preAction: 'BTN open 2.5BB',
    effectiveStack: '40BB',
    steps: [{ id: 'pre', street: 'Preflop', communityCards: [], description: 'Facing BTN open', potSize: 4, options: ['Fold', 'Call', 'Raise'], feedbacks: {} }],
  };
}

function liveRealMoney(): CompanionHandState {
  return {
    schemaVersion: 1,
    handId: 'live-1',
    source: 'external-adapter',
    mode: 'live-real-money',
    gameFormat: 'Cash',
    tableSize: '6max',
    street: 'Preflop',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    effectiveStackBB: 40,
    potBB: 4,
    amountToCallBB: 1.5,
    heroHand: 'AQs',
    actionHistory: [],
    spot: 'bb-defense',
    openSizeBB: 2.5,
    handComplete: false,
    updatedAt: 1,
  };
}

test('active real-money hand is context-only until hand complete', () => {
  const active = companionAdvicePolicy(liveRealMoney());
  assert.equal(active.level, 'context-only');
  assert.equal(active.canShowStrategy, false);
  assert.equal(active.canOpenDecisionTools, false);
  assert.equal(active.canShowIntervention, false);

  const completed = companionAdvicePolicy({ ...liveRealMoney(), handComplete: true });
  assert.equal(completed.level, 'full');
  assert.equal(completed.canShowStrategy, true);
  assert.equal(completed.canOpenDecisionTools, true);
});

test('trainer adapter synchronizes scenario context and locks answer before feedback', () => {
  const state = companionStateFromScenario(scenario(), 0, { mode: 'training', decisionLocked: true });
  assert.equal(state.heroHand, 'AQs');
  assert.equal(state.heroPosition, 'BB');
  assert.equal(state.villainPosition, 'BTN');
  assert.equal(state.spot, 'bb-defense');
  assert.equal(state.openSizeBB, 2.5);
  const policy = companionAdvicePolicy(state);
  assert.equal(policy.canShowStrategy, false);
  assert.equal(policy.canShowIntervention, true);
});

test('trainer feedback unlocks strategy-capable companion mode', () => {
  const state = companionStateFromScenario(scenario(), 0, { mode: 'training', handComplete: true, decisionLocked: false });
  const policy = companionAdvicePolicy(state);
  assert.equal(policy.level, 'full');
  assert.equal(policy.canShowStrategy, true);
});

test('companion computes SPR and pot odds from synchronized state', () => {
  const state = companionStateFromManual({
    mode: 'replay', gameFormat: 'Cash', tableSize: '6max', street: 'Flop', heroPosition: 'BB', villainPosition: 'BTN', effectiveStackBB: 40, potBB: 9, amountToCallBB: 3, handComplete: true,
  });
  const analysis = analyzeCompanionState(state, []);
  assert.ok(analysis.spr !== undefined && Math.abs(analysis.spr - 40 / 9) < 1e-9);
  assert.ok(analysis.potOdds !== undefined && Math.abs(analysis.potOdds - 0.25) < 1e-9);
});

test('MTT ICM companion state routes to ICM intervention after hand is analyzable', () => {
  const state = companionStateFromManual({
    mode: 'replay', gameFormat: 'MTT', tableSize: '9max', street: 'Preflop', heroPosition: 'BTN', villainPosition: 'BB', effectiveStackBB: 18, potBB: 2.5, heroHand: 'AJo', spot: 'push-fold', tournamentModel: 'icm', handComplete: true,
  });
  const analysis = analyzeCompanionState(state, []);
  assert.equal(analysis.intervention?.type, 'icm');
});

test('hand-state bus works in non-browser tests without BroadcastChannel side effects', () => {
  clearCompanionHandState();
  assert.equal(getCompanionHandState(), null);
  const state = companionStateFromScenario(scenario(), 0, { mode: 'training' });
  publishCompanionHandState(state);
  assert.equal(getCompanionHandState()?.handId, 'v9-bb-defense:pre');
  clearCompanionHandState();
  assert.equal(getCompanionHandState(), null);
});
