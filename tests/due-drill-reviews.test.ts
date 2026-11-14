import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as learning from '../src/learning-engine';
import { buildRangeHistoryItems, RangeReadingTrainer } from '../src/features/range/RangeReadingTrainer';
import { buildCounterfactualHistoryItems, CounterfactualTrainer } from '../src/features/training/CounterfactualTrainer';
import { RANGE_QUESTIONS } from '../src/features/range/data';
import { baselineSelections, calculateRangeDecision, EQUITY_BANDS } from '../src/features/range/rangeEngine';
import { loadHistory, persistHistoryItems } from '../src/utils/history';
import type { HistoryItem } from '../src/types';
import type { RangeQuestion } from '../src/features/range/types';

const day = 86400000;
const time = 1800000000000;
const question = RANGE_QUESTIONS.find(q => q.id === 'fourbet-shove-qq')!;
function rangeAttempt(q: RangeQuestion, history: HistoryItem[], now: number) {
  const selections = baselineSelections(q);
  const calculation = calculateRangeDecision(q, selections);
  const selectedEquity = EQUITY_BANDS.find(band => calculation.heroEquity >= band.min && calculation.heroEquity <= band.max)!.id;
  return buildRangeHistoryItems(q, { selections, selectedEquity, potOddsEstimate: calculation.potOdds, selectedAction: calculation.bestAction, confidence: 4 }, history, now);
}
function counterAttempt(q: RangeQuestion, dimension: 'bet-size' | 'range-width', history: HistoryItem[], now: number) {
  const probe = buildCounterfactualHistoryItems(q, dimension, {}, 4, [], now - 1000, now);
  const answers = Object.fromEntries(probe.map(item => [item.stepId!, item.bestAction])) as Record<string, 'fold' | 'call'>;
  return buildCounterfactualHistoryItems(q, dimension, answers, 4, history, now - 1000, now);
}
const queue = () => {
  const fn = (learning as typeof learning & { buildDueDrillQueue?: (history: HistoryItem[], track: 'cash' | 'tournament', now: number) => Array<{ id: string; kind: 'range' | 'counterfactual'; question: RangeQuestion; dimension?: 'bet-size' | 'range-width'; dueItems: HistoryItem[] }> }).buildDueDrillQueue;
  assert.equal(typeof fn, 'function', 'due drill records must resolve to an actionable original question');
  return fn!;
};

test('seven real Range and Counterfactual schedules resolve to two exact drill replays', () => {
  const history = [...rangeAttempt(question, [], time), ...counterAttempt(question, 'bet-size', [], time)];
  assert.equal(learning.currentDueReviews(history, time + 2 * day).length, 7);
  const due = queue()(history, 'cash', time + 2 * day);
  assert.equal(due.length, 2);
  assert.ok(due.every(item => item.question.id === 'fourbet-shove-qq'));
  assert.equal(due.find(item => item.kind === 'range')?.dueItems.length, 4);
  assert.equal(due.find(item => item.kind === 'counterfactual')?.dimension, 'bet-size');
  assert.deepEqual(queue()(history, 'tournament', time + 2 * day), []);
});

test('exact drill replays advance all schedules once, retain review evidence, and survive reload', async () => {
  const initial = [...rangeAttempt(question, [], time), ...counterAttempt(question, 'bet-size', [], time), ...counterAttempt(question, 'range-width', [], time)];
  const now = time + 2 * day;
  assert.equal(queue()(initial, 'cash', now).length, 3);
  const reviews = [...rangeAttempt(question, initial, now), ...counterAttempt(question, 'bet-size', initial, now), ...counterAttempt(question, 'range-width', initial, now)];
  for (const item of reviews) {
    assert.equal(item.isReview, true);
    assert.equal(item.isDelayedReview, true);
    assert.equal(item.isUnseen, false);
    assert.equal(Boolean(item.isTransferTest), false);
    assert.ok(item.nextReviewAt! > now);
    assert.ok(initial.some(previous => previous.masteryKey === item.masteryKey));
  }
  const store = new Map<string, string>();
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) } });
  try {
    await persistHistoryItems(initial);
    await persistHistoryItems(reviews);
    await persistHistoryItems(reviews);
    const reloaded = loadHistory();
    assert.equal(reloaded.length, initial.length + 10);
    assert.deepEqual(queue()(reloaded, 'cash', now + 10), []);
    assert.equal(learning.currentDueReviews(reloaded, now + 10).length, 0);
    assert.equal(queue()(reloaded, 'cash', Math.max(...reviews.map(item => item.nextReviewAt!)) + 1).length, 3);
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('malformed drill identities do not silently launch another question or dimension', () => {
  const records = counterAttempt(question, 'range-width', [], time);
  const malformed = records.map(item => ({ ...item, transferGroupId: 'counterfactual-unknown-bet-size' }));
  assert.deepEqual(queue()(malformed, 'cash', time + 2 * day), []);
});

test('replay screens render the queued Cash question and lock the Counterfactual dimension', () => {
  const range = renderToStaticMarkup(React.createElement(RangeReadingTrainer, { reviewQuestion: question, onExit() {} }));
  assert.ok(range.includes(question.title));
  assert.ok(!range.includes(RANGE_QUESTIONS[0].title));
  const counter = renderToStaticMarkup(React.createElement(CounterfactualTrainer, { reviewQuestion: question, reviewDimension: 'range-width', onExit() {} }));
  assert.ok(counter.includes(question.title));
  assert.ok(counter.includes('Value-heavy / Tight'));
  assert.ok(!counter.includes('較小下注'));
  assert.match(counter, /<button[^>]*disabled=""[^>]*>[^]*?下注尺寸<\/button>/);
});
