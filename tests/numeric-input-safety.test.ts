import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { calculateIcmWorkbench, parseIcmNumbers } from '../src/features/tournament/IcmWorkbench';
import { calculateEquityWorkbench } from '../src/features/learning/EquityWorkbench';
import { calculateEquity, parseCardsText } from '../src/poker/equityEngine';

const icmInput = {
  mode: 'icm' as const,
  stacks: '25 40 18 12 7',
  payouts: '40 25 18',
  heroIndex: 0,
  villainIndex: 1,
  risk: '18',
  showdown: '55',
  bounty: '8',
  satelliteSeats: '2',
};

test('ICM list whitespace never inserts players or changes explicit zero positions', () => {
  assert.deepEqual(parseIcmNumbers(' \t25, 40, 0\n18 12 7, '), [25, 40, 0, 18, 12, 7]);
  assert.deepEqual(parseIcmNumbers(' \t,\n '), []);
});

test('ICM rejects a whole roster when its middle player is invalid', () => {
  for (const token of ['-40', 'invalid', 'Infinity', '-Infinity', 'NaN']) {
    assert.throws(() => parseIcmNumbers(`25 ${token} 18 12 7`), /2/, token);
    const result = calculateIcmWorkbench({ ...icmInput, stacks: `25 ${token} 18 12 7` });
    assert.equal(result?.base, undefined, `${token} must not be silently removed`);
    assert.match(result?.error ?? '', /籌碼.*2/, 'error identifies the rejected player position');
  }
});

test('ICM rejects a whole payout list when its middle prize is invalid', () => {
  for (const token of ['-25', 'invalid', 'Infinity', 'NaN']) {
    const result = calculateIcmWorkbench({ ...icmInput, payouts: `40 ${token} 18` });
    assert.equal(result?.base, undefined, `${token} must not shift finishing-place prizes`);
    assert.match(result?.error ?? '', /獎金.*2/);
  }
});

test('valid ICM whitespace produces the same selected players and result', () => {
  const clean = calculateIcmWorkbench({ ...icmInput, heroIndex: 2, villainIndex: 1 });
  const spaced = calculateIcmWorkbench({ ...icmInput, stacks: ' \n25, 40\t18 12 7, ', payouts: ' 40,25 18 ', heroIndex: 2, villainIndex: 1 });
  assert.ok(clean?.base);
  assert.deepEqual(spaced, clean);
});

test('ICM numeric fields reject malformed or blank values instead of defaulting to zero', () => {
  for (const field of ['risk', 'showdown', 'bounty'] as const) {
    for (const value of ['', 'not-a-number', 'Infinity', '-1']) {
      const result = calculateIcmWorkbench({ ...icmInput, mode: 'pko', [field]: value });
      assert.equal(result?.base, undefined, `${field}=${value} must be rejected`);
      assert.ok(result?.error, `${field}=${value} needs a readable error`);
    }
  }
});

test('satellite seats must be a positive integer within the supplied roster', () => {
  for (const satelliteSeats of ['', 'invalid', 'Infinity', '0', '2.5', '6']) {
    const result = calculateIcmWorkbench({ ...icmInput, mode: 'satellite', satelliteSeats });
    assert.equal(result?.base, undefined, `seats=${satelliteSeats}`);
    assert.ok(result?.error);
  }
  assert.ok(calculateIcmWorkbench({ ...icmInput, mode: 'satellite', satelliteSeats: '2' })?.base);
});

const riverRequest = {
  hero: parseCardsText('As Ah'),
  board: parseCardsText('Ac Kd 7s 2c 3h'),
  villainRange: [{ hand: 'KK' }],
};

test('equity engine rejects unsafe iteration counts even when the board would use exact enumeration', () => {
  for (const iterations of [NaN, Infinity, -Infinity, 0, -1, 999, 1000.5, 100001]) {
    assert.throws(() => calculateEquity({ ...riverRequest, iterations }), /iterations.*finite integer/i, String(iterations));
  }
});

test('equity workbench rejects invalid text instead of using a fallback or silently clamping', () => {
  for (const iterations of ['', 'invalid', 'NaN', 'Infinity', '-Infinity', '0', '999', '1000.5', '100001']) {
    assert.throws(() => calculateEquityWorkbench('As Ah', 'Ac Kd 7s 2c 3h', 'KK 1', iterations), /iterations.*finite integer/i, iterations);
  }
});

test('equity Monte Carlo Infinity is rejected promptly in an isolated process', () => {
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    import { calculateEquity, parseCardsText } from './src/poker/equityEngine.ts';
    assert.throws(() => calculateEquity({ hero: parseCardsText('As Ks'), villainRange: [{ hand: 'QQ' }], iterations: Infinity }), /iterations.*finite integer/i);
  `], { cwd: process.cwd(), timeout: 3000, encoding: 'utf8', windowsHide: true });
  assert.equal(child.error, undefined, 'unsafe input must be rejected before any unbounded loop');
  assert.equal(child.status, 0, child.stderr);
});

test('equity accepts bounded counts and preserves the requested Monte Carlo sample count', () => {
  assert.equal(calculateEquity({ ...riverRequest, iterations: 100000 }).method, 'exact');
  const result = calculateEquityWorkbench('As Ks', '', 'QQ 1', ' 1000 ');
  assert.equal(result.method, 'monte-carlo');
  assert.equal(result.samples, 1000);
  assert.ok(result.equity > 0 && result.equity < 100);
});
