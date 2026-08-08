import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateHeadsUpIcmRisk, calculateIcm } from '../src/tournament/icm';

test('ICM distributes the full payout pool', () => {
  const result = calculateIcm([
    { id: 'A', stack: 40 }, { id: 'B', stack: 30 }, { id: 'C', stack: 20 }, { id: 'D', stack: 10 },
  ], [50, 30, 20]);
  const total = Object.values(result.equities).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(total - 100) < 1e-9);
});

test('equal stacks produce equal ICM equity', () => {
  const result = calculateIcm([{ id: 'A', stack: 10 }, { id: 'B', stack: 10 }, { id: 'C', stack: 10 }], [60, 30, 10]);
  assert.ok(Math.abs(result.equities.A - result.equities.B) < 1e-9);
  assert.ok(Math.abs(result.equities.B - result.equities.C) < 1e-9);
});

test('ICM risk premium can raise break-even equity above chip EV', () => {
  const result = calculateHeadsUpIcmRisk({
    players: [{ id: 'H', stack: 25 }, { id: 'V', stack: 40 }, { id: 'S', stack: 5 }, { id: 'M', stack: 20 }],
    payouts: [50, 30, 20], heroId: 'H', villainId: 'V', amountAtRisk: 25, showdownEquity: 0.55,
  });
  assert.ok(result.icmBreakEvenPercent >= result.chipEvBreakEvenPercent);
  assert.ok(result.riskPremiumPercent >= 0);
});
