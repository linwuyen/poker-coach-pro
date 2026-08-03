import assert from 'node:assert/strict';
import test from 'node:test';
import { getReviewSchedule } from '../src/utils/history';

test('missed answers return after a short delay', () => {
  const before = Date.now();
  const schedule = getReviewSchedule(4);
  assert.equal(schedule.reviewIntervalDays, 0);
  assert.ok((schedule.nextReviewAt || 0) >= before + 4 * 60 * 1000);
});

test('successful reviews expand from one to three days', () => {
  assert.equal(getReviewSchedule(10).reviewIntervalDays, 1);
  assert.equal(getReviewSchedule(10, { scenarioId: 'x', category: [], score: 10, judgment: '正確', timestamp: 0, reviewIntervalDays: 1 }).reviewIntervalDays, 3);
});
