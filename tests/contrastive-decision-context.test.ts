import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SpotCard, hasContrastiveDecisionContext } from '../src/features/training/ContrastiveTrainer';
import type { PokerBenchPostflopRow } from '../src/solver-data/pokerbench';

const river: PokerBenchPostflopRow = {
  id: 'postflop-10', split: 'postflop', holding: '4s4h', heroPosition: 'IP',
  evaluationAt: 'River', boardFlop: 'Qc8cAc', boardTurn: 'Kh', boardRiver: '3s',
  preflopAction: 'CO/2.3bb/BB/call', postflopAction: 'OOP_CHECK/IP_CHECK/dealcards/Kh/OOP_CHECK/IP_BET_6/OOP_CALL/dealcards/3s/OOP_BET_9',
  aggressorPosition: 'OOP', potSize: 26, availableMoves: ['Fold', 'Call', 'Raise 32'], correctDecision: 'Fold',
};
const render = (row: PokerBenchPostflopRow) => renderToStaticMarkup(React.createElement(SpotCard, { label: 'A', row, selected: null, onSelect() {}, disabled: false }));

test('contrastive decisions expose pot, both action histories and stack limitations before answering', () => {
  const html = render(river);
  assert.match(html, /底池.*26.*BB/);
  assert.match(html, /翻前.*CO.*2\.3.*BB.*跟注/);
  assert.match(html, /翻後.*6.*9/s);
  assert.match(html, /6-max.*100 BB/);
  assert.match(html, /目前剩餘籌碼.*未提供/);
  assert.doesNotMatch(html, /Solver：|資料集主動作：/);
});

test('contrastive missing price or action context cannot be submitted as a graded decision', () => {
  for (const row of [{ ...river, potSize: NaN }, { ...river, preflopAction: '' }, { ...river, postflopAction: '' }]) {
    const html = render(row);
    assert.match(html, /資訊不足/);
    assert.equal((html.match(/disabled=""/g) || []).length, 3);
  }
});

test('contrastive eligibility requires the current street cards and never depends on future cards', () => {
  assert.equal(hasContrastiveDecisionContext(river), true);
  assert.equal(hasContrastiveDecisionContext({ ...river, boardRiver: '' }), false);
  assert.equal(hasContrastiveDecisionContext({ ...river, boardRiver: '4s' }), false);
  assert.equal(hasContrastiveDecisionContext({ ...river, evaluationAt: 'Flop', boardRiver: '4s' }), true);
});
