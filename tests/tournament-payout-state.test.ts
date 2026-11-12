import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateHeadsUpIcmRisk, calculateHeadsUpPkoRisk, calculateIcm, calculateFgs, compareFgsActions } from '../src/tournament/icm';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('heads-up ICM preserves the runner-up prize and accepts a profitable 55% risk', () => {
  const result = calculateHeadsUpIcmRisk({ players: [{ id: 'H', stack: 10 }, { id: 'V', stack: 10 }], payouts: [60, 40], heroId: 'H', villainId: 'V', amountAtRisk: 10, showdownEquity: .55 });
  close(result.foldEquity, 50);
  close(result.loseEquity, 40);
  close(result.winEquity, 60);
  close(result.callEquity, 51);
  close(result.dollarEvDelta, 1);
  close(result.icmBreakEvenPercent, 50);
});

test('a single eliminated player receives the last prize and payouts remain conserved', () => {
  const result = calculateIcm([{ id: 'H', stack: 0 }, { id: 'V', stack: 20 }, { id: 'S', stack: 10 }], [60, 30, 10]);
  close(result.equities.H, 10);
  close(result.equities.V, 50);
  close(result.equities.S, 40);
  close(Object.values(result.equities).reduce((sum, value) => sum + value, 0), 100);
});

test('multiple eliminated players require explicit finishing order instead of guessing prizes', () => {
  assert.throws(() => calculateIcm([{ id: 'A', stack: 20 }, { id: 'B', stack: 0 }, { id: 'C', stack: 0 }], [60, 30, 10]), /eliminatedPlace|finishing order/);
  const result = calculateIcm([{ id: 'A', stack: 20 }, { id: 'B', stack: 0, eliminatedPlace: 2 }, { id: 'C', stack: 0, eliminatedPlace: 3 }], [60, 30, 10]);
  assert.deepEqual(result.equities, { A: 60, B: 30, C: 10 });
  assert.throws(() => calculateIcm([{ id: 'A', stack: 20, eliminatedPlace: 2 }, { id: 'B', stack: 0 }], [60, 40]), /eliminatedPlace/);
});

test('PKO adds only the stated immediately paid bounty to correct finishing prizes', () => {
  const result = calculateHeadsUpPkoRisk({ players: [{ id: 'H', stack: 10 }, { id: 'V', stack: 10 }], payouts: [60, 40], heroId: 'H', villainId: 'V', amountAtRisk: 10, showdownEquity: .55, villainBountyValue: 8, bountyCashFraction: .5 });
  close(result.bountyEv, 2.2);
  close(result.pkoCallEquity, 53.2);
  close(result.pkoDollarEvDelta, 3.2);
  close(result.pkoBreakEvenPercent, 100 * 10 / 24);
});

test('FGS carries past elimination places through later knockouts and pays all finishers', () => {
  const result = calculateFgs({ heroId: 'B', payouts: [60, 30, 10], root: { id: 'root', players: [{ id: 'A', stack: 10 }, { id: 'B', stack: 10 }, { id: 'C', stack: 10 }], children: [{ id: 'third', probability: 1, players: [{ id: 'A', stack: 20 }, { id: 'B', stack: 10 }, { id: 'C', stack: 0 }], children: [{ id: 'second', probability: 1, players: [{ id: 'A', stack: 30 }, { id: 'B', stack: 0 }, { id: 'C', stack: 0 }] }] }] } });
  assert.deepEqual(result.equities, { A: 60, B: 30, C: 10 });
  close(result.heroEquity, 30);
  close(Object.values(result.equities).reduce((sum, value) => sum + value, 0), 100);
});

test('FGS rejects ambiguous simultaneous busts and resurrection of a finished player', () => {
  assert.throws(() => calculateFgs({ heroId: 'A', payouts: [60, 30, 10], root: { id: 'root', players: [{ id: 'A', stack: 10 }, { id: 'B', stack: 10 }, { id: 'C', stack: 10 }], children: [{ id: 'ambiguous', probability: 1, players: [{ id: 'A', stack: 30 }, { id: 'B', stack: 0 }, { id: 'C', stack: 0 }] }] } }), /eliminatedPlace|finishing order/);
  assert.throws(() => calculateFgs({ heroId: 'A', payouts: [60, 40], root: { id: 'bust', players: [{ id: 'A', stack: 20 }, { id: 'B', stack: 0 }], children: [{ id: 'revived', probability: 1, players: [{ id: 'A', stack: 10 }, { id: 'B', stack: 10 }] }] } }), /eliminated|finished/);
});

test('risk comparisons refuse invalid equity, negative risk and risk exceeding the effective stack', () => {
  const input = { players: [{ id: 'H', stack: 10 }, { id: 'V', stack: 10 }], payouts: [60, 40], heroId: 'H', villainId: 'V', amountAtRisk: 10, showdownEquity: .55 };
  for (const amountAtRisk of [-1, 11, NaN]) assert.throws(() => calculateHeadsUpIcmRisk({ ...input, amountAtRisk }), /risk|amountAtRisk/);
  for (const showdownEquity of [-.1, 1.1, NaN]) assert.throws(() => calculateHeadsUpIcmRisk({ ...input, showdownEquity }), /equity|showdownEquity/);
});

test('zero risk is explicitly indifferent at every equity without an invented premium', () => {
  for (const showdownEquity of [0, .35, 1]) {
    const result = calculateHeadsUpPkoRisk({ players: [{ id: 'H', stack: 10 }, { id: 'V', stack: 10 }], payouts: [60, 40], heroId: 'H', villainId: 'V', amountAtRisk: 0, showdownEquity, villainBountyValue: 8 });
    close(result.foldEquity, 50);
    close(result.callEquity, 50);
    close(result.dollarEvDelta, 0);
    close(result.pkoDollarEvDelta, 0);
    close(result.icmBreakEvenPercent, 0);
    close(result.pkoBreakEvenPercent, 0);
    close(result.riskPremiumPercent, 0);
    assert.equal(result.icmIndifferent, true);
    assert.equal(result.chipEvIndifferent, true);
    assert.equal(result.pkoIndifferent, true);
    assert.equal(result.canEliminateVillain, false);
  }
});

test('flat paid places make positive chip risk indifferent in prize utility only', () => {
  for (const showdownEquity of [0, .35, 1]) {
    const result = calculateHeadsUpIcmRisk({ players: [{ id: 'H', stack: 10 }, { id: 'V', stack: 20 }, { id: 'S', stack: 7 }], payouts: [40, 40, 40], heroId: 'H', villainId: 'V', amountAtRisk: 10, showdownEquity });
    close(result.foldEquity, 40);
    close(result.callEquity, 40);
    close(result.icmBreakEvenPercent, 0);
    close(result.riskPremiumPercent, 0);
    close(result.chipEvBreakEvenPercent, 50);
    assert.equal(result.icmIndifferent, true);
    assert.equal(result.chipEvIndifferent, false);
  }
});

test('a collectible bounty breaks flat-prize indifference while a zero bounty preserves it', () => {
  const input = { players: [{ id: 'H', stack: 10 }, { id: 'V', stack: 10 }], payouts: [40, 40], heroId: 'H', villainId: 'V', amountAtRisk: 10, showdownEquity: .25 };
  const rewarded = calculateHeadsUpPkoRisk({ ...input, villainBountyValue: 8, bountyCashFraction: .5 });
  close(rewarded.pkoCallEquity, 41);
  close(rewarded.pkoBreakEvenPercent, 0);
  assert.equal(rewarded.icmIndifferent, true);
  assert.equal(rewarded.pkoIndifferent, false);
  const unrewarded = calculateHeadsUpPkoRisk({ ...input, villainBountyValue: 0 });
  close(unrewarded.pkoCallEquity, 40);
  close(unrewarded.pkoBreakEvenPercent, 0);
  assert.equal(unrewarded.pkoIndifferent, true);
});

test('FGS flat-prize actions retain equal values through different knockout trees', () => {
  const rows = compareFgsActions([
    { action: 'Preserve', root: { id: 'preserve', players: [{ id: 'H', stack: 10 }, { id: 'V', stack: 10 }] } },
    { action: 'Contest', root: { id: 'contest', players: [{ id: 'H', stack: 10 }, { id: 'V', stack: 10 }], children: [
      { id: 'win', probability: .25, players: [{ id: 'H', stack: 20 }, { id: 'V', stack: 0 }] },
      { id: 'lose', probability: .75, players: [{ id: 'H', stack: 0 }, { id: 'V', stack: 20 }] },
    ] } },
  ], [40, 40], 'H');
  for (const row of rows) {
    close(row.heroEquity, 40);
    close(row.deltaVsBest, 0);
  }
});

test('FGS does not invent a uniquely best flat-prize action from floating-point roundoff', () => {
  const rows = compareFgsActions([
    { action: 'A', root: { id: 'a', players: [{ id: 'H', stack: 10 }, { id: 'V', stack: 20 }, { id: 'S', stack: 7 }] } },
    { action: 'B', root: { id: 'b', players: [{ id: 'H', stack: 11 }, { id: 'V', stack: 19 }, { id: 'S', stack: 7 }] } },
  ], [40, 40, 40], 'V');
  assert.ok(rows.every(row => row.deltaVsBest === 0));
});
