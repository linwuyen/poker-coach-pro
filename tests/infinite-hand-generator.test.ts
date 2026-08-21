import assert from 'node:assert/strict';
import test from 'node:test';
import { isHiddenBenchmarkScenario } from '../src/learning-engine/benchmark';
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

test('infinite generator ingests 216 scenarios plus 528 safe variants before truth/holdout gates', () => {
  const variants = buildGeneratedVariantPool(coreScenarios, 6);
  assert.equal(scenarios.length, 216);
  assert.equal(variants.length, 528);
  assert.equal(scenarios.every(isTruthBackedScenario), true);
  assert.equal(variants.every(isTruthBackedScenario), true);

  const pool = buildInfiniteCandidatePool(scenarios, variants, []);
  const summary = summarizeInfinitePool(scenarios, variants, [], pool);
  assert.equal(summary.curatedInput, 216);
  assert.equal(summary.safeVariantInput, 528);
  assert.ok(summary.heldOut > 0);
  assert.ok(summary.usable > 500);
  assert.ok(summary.usable <= 744);
  assert.equal(new Set(pool.map(item => item.presentationFingerprint)).size, pool.length);
});

test('hidden benchmark scenarios and their generated variants never enter infinite training', () => {
  const variants = buildGeneratedVariantPool(coreScenarios, 6);
  const hiddenIds = new Set(scenarios.filter(isHiddenBenchmarkScenario).map(item => item.id));
  assert.ok(hiddenIds.size > 0);
  const pool = buildInfiniteCandidatePool(scenarios, variants, []);
  for (const candidate of pool) {
    if (candidate.kind !== 'scenario') continue;
    assert.equal(hiddenIds.has(candidate.scenario.id), false);
    if (candidate.source === 'safe-variant' && candidate.scenario.reviewSourceId) {
      assert.equal(hiddenIds.has(candidate.scenario.reviewSourceId), false);
    }
  }
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
  const second = { ...first, id: `${first.id}-duplicate` };
  assert.equal(solverCorpusRole(second), 'training');
  const pool = buildInfiniteCandidatePool([], [], [first, second]);
  assert.equal(pool.length, 1);
});

test('next-hand sampling avoids recent exact candidates and recent decision families when alternatives exist', () => {
  const curated = coreScenarios.filter(item => !isHiddenBenchmarkScenario(item)).slice(0, 8);
  const variants = buildGeneratedVariantPool(curated, 2);
  const pool = buildInfiniteCandidatePool(curated, variants, []);
  assert.ok(pool.length >= 5);
  const recent = pool[0];
  const next = selectNextInfiniteCandidate(pool, [], [recent.id], [recent.familyId], () => 0.01, Date.now());
  assert.ok(next);
  assert.notEqual(next!.id, recent.id);
  assert.notEqual(next!.familyId, recent.familyId);
});
