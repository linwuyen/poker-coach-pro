import assert from 'node:assert/strict';
import test from 'node:test';
import { getReviewSchedule } from '../src/utils/history';
import { isDue } from '../src/learning-engine';
import { HistoryItem } from '../src/types';

const now = 1_800_000_000_000;

function previous(score: number, reviewIntervalDays = 0): HistoryItem {
  return { scenarioId: 'x', stepId: 's1', category: [], score, judgment: score >= 8 ? '正確' : '錯誤', timestamp: now - 1000, reviewIntervalDays };
}

test('missed answers wait before becoming due', () => {
  const schedule = getReviewSchedule(4, 2, undefined, now);
  assert.equal(schedule.nextReviewAt, now + 10 * 60 * 1000);
  assert.equal(isDue({ ...previous(4), ...schedule }, now), false);
});

test('repeated misses use a longer correction interval', () => {
  const schedule = getReviewSchedule(2, 4, previous(2), now);
  assert.equal(schedule.nextReviewAt, now + 60 * 60 * 1000);
});

test('low confidence correct answers return earlier than confident reviews', () => {
  assert.equal(getReviewSchedule(10, 1, undefined, now).reviewIntervalDays, 1);
  assert.equal(getReviewSchedule(10, 4, previous(10, 3), now).reviewIntervalDays, 9);
});

test('legacy second-argument previous history remains supported', () => {
  assert.equal(getReviewSchedule(10, previous(10, 1), undefined, now).reviewIntervalDays, 3);
});
