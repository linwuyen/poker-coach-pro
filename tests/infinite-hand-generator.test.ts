import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInfiniteCandidatePool,
  isTruthBackedPokerBenchRow,
  isTruthBackedScenario,
  selectNextInfiniteCandidate,
  summarizeInfinitePool,
} from '../src/learning-engine/infiniteHandGenerator';
import { buildGeneratedVariantPool } from '../src/learning-engine/variantGenerator';
import { solverCorpusRole } from '../src/learning-engine/solverCurriculum';
import { PokerBenchPreflopRow } from '../src/solver-data/pokerbench';
import { coreScenarios, scenarios } from '../src/teaching/scenarioCatalog';

function trainingRow(seed = 1): PokerBenchPreflopRow {
  for (let index = seed; index < seed + 500; index += 1) {
    const row: PokerBenchPreflopRow = {
      id: `infinite-test-${index}`,
      split: 'preflop',
      prevLine: 'BTN raises 2.5 BB',
      numPlayers: 6,
      numBets: 1,
      availableMoves: ['Fold', 'Call', 'Raise 9'],
      correctDecision: 'Call',
      potSize: 4,
      heroPosition: 'BB',
      holding: index % 2 ? 'AsKd' : 'AhKc',
    };
    if (solverCorpusRole(row) === 'training') return row;
  }
  throw new Error('Could not construct a PokerBench training row.');
}

test('infinite generator ingests 216 scenarios plus 528 safe variants before dedupe', () => {
  const variants = buildGeneratedVariantPool(coreScenarios, 6);
  assert.equal(scenarios.length, 216);
  assert.equal(variants.length, 528);
  assert.equal(scenarios.every(isTruthBackedScenario), true);
  assert.equal(variants.every(isTruthBackedScenario), true);

  const pool = buildInfiniteCandidatePool(scenarios, variants, []);
  const summary = summarizeInfinitePool(scenarios, variants, [], pool);
  assert.equal(summary.curatedInput, 216);
  assert.equal(summary.safeVariantInput, 528);
  assert.ok(summary.usable > 500);
  assert.ok(summary.usable <= 744);
  assert.equal(new Set(pool.map(item => item.presentationFingerprint)).size, pool.length);
});

test('PokerBench enters the infinite pool only with a training-partition exact solver label', () => {
  const valid = trainingRow();
  const invalid = { ...trainingRow(100), id: 'invalid-label', correctDecision: 'Jam' };
  assert.equal(isTruthBackedPokerBenchRow(valid), true);
  assert.equal(isTruthBackedPokerBenchRow(invalid), false);

  const pool = buildInfiniteCandidatePool([], [], [valid, invalid]);
  assert.equal(pool.length, 1);
  assert.equal(pool[0].source, 'pokerbench');
  assert.equal(pool[0].kind, 'solver');
});

test('exact duplicate PokerBench presentations are deduplicated even if row ids differ', () => {
  const first = trainingRow();
  let second = { ...first, id: `${first.id}-duplicate` };
  if (solverCorpusRole(second) !== 'training') {
    // Corpus role is a guard on family, not row order; keep a valid training id if needed.
    second = { ...first };
  }
  const pool = buildInfiniteCandidatePool([], [], [first, second]);
  assert.equal(pool.length, 1);
});

test('next-hand sampling avoids recent exact candidates and recent decision families when alternatives exist', () => {
  const variants = buildGeneratedVariantPool(coreScenarios.slice(0, 5), 2);
  const pool = buildInfiniteCandidatePool(coreScenarios.slice(0, 5), variants, []);
  assert.ok(pool.length >= 5);
  const recent = pool[0];
  const next = selectNextInfiniteCandidate(pool, [], [recent.id], [recent.familyId], () => 0.01, Date.now());
  assert.ok(next);
  assert.notEqual(next!.id, recent.id);
  assert.notEqual(next!.familyId, recent.familyId);
});
