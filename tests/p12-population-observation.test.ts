import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHandHistoryText } from '../src/real-game/handHistory';
import { buildObservedPopulationCohort } from '../src/real-game/populationObservation';

const hh = `PokerStars Hand #13001: Hold'em No Limit ($0.50/$1.00 USD) - 2026/08/20 18:50:25 ET
Table 'Pool' 6-max Seat #6 is the button
Seat 1: SB ($100 in chips)
Seat 2: BB ($100 in chips)
Seat 6: Hero ($100 in chips)
SB: posts small blind $0.50
BB: posts big blind $1
*** HOLE CARDS ***
Dealt to Hero [As Kd]
Hero: raises $1.50 to $2.50
SB: folds
BB: calls $1.50
*** FLOP *** [Ah 8c 4d]
BB: checks
Hero: bets $1.80
BB: folds
*** SUMMARY ***`;

test('local HH cohort preserves raw numerator/denominator counts instead of inventing exploit truth', () => {
  const cohort = buildObservedPopulationCohort(parseHandHistoryText(hh), 123456);
  assert.equal(cohort.source, 'local-hand-history');
  assert.equal(cohort.trust, 'measured-local-cohort');
  assert.equal(cohort.sampleHands, 1);
  const checked = cohort.metrics.find(metric => metric.key === 'Flop|none|check');
  assert.ok(checked);
  assert.equal(checked!.numerator, 1);
  assert.equal(checked!.denominator, 1);
  assert.equal(checked!.rate, 1);
  assert.match(cohort.methodology, /No solver optimality/);
});
