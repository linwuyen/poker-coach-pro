import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInfiniteCandidatePool, scenarioTruthTier } from '../src/learning-engine/infiniteHandGenerator';
import { buildGeneratedVariantPool } from '../src/learning-engine/variantGenerator';
import { solverCorpusRole } from '../src/learning-engine/solverCurriculum';
import { PokerBenchPreflopRow } from '../src/solver-data/pokerbench';
import { coreScenarios, semanticTeachingScenarios } from '../src/teaching/scenarioCatalog';

function trainingRow(): PokerBenchPreflopRow {
  for (let index = 1; index < 500; index += 1) {
    const row: PokerBenchPreflopRow = {
      id: `truth-tier-${index}`,
      split: 'preflop',
      prevLine: 'BTN raises 2.5 BB',
      numPlayers: 6,
      numBets: 1,
      availableMoves: ['Fold', 'Call', 'Raise 9'],
      correctDecision: 'Call',
      potSize: 4,
      heroPosition: 'BB',
      holding: 'AsKd',
    };
    if (solverCorpusRole(row) === 'training') return row;
  }
  throw new Error('Could not construct PokerBench training row.');
}

test('scenario truth tiers fail toward expert baseline unless exact evidence is explicit', () => {
  assert.equal(scenarioTruthTier(coreScenarios[0]), 'expert-baseline');
  assert.equal(scenarioTruthTier(semanticTeachingScenarios[0]), 'exact-math');
});

test('infinite candidates expose evidence tier instead of generic truth wording', () => {
  const exactPool = buildInfiniteCandidatePool([semanticTeachingScenarios[0]], [], []);
  assert.equal(exactPool[0]?.truthTier, 'exact-math');
  assert.equal(exactPool[0]?.truthLabel, 'exact-math ground truth');

  const reviewedPool = buildInfiniteCandidatePool([coreScenarios[0]], buildGeneratedVariantPool([coreScenarios[0]], 1), []);
  assert.ok(reviewedPool.some(item => item.source === 'curated' && item.truthTier === 'expert-baseline' && item.truthLabel === 'reviewed expert baseline'));
  assert.ok(reviewedPool.some(item => item.source === 'safe-variant' && item.truthTier === 'expert-baseline' && item.truthLabel === 'strategy-equivalent expert baseline'));

  const solverPool = buildInfiniteCandidatePool([], [], [trainingRow()]);
  assert.equal(solverPool[0]?.truthTier, 'verified-solver');
  assert.equal(solverPool[0]?.truthLabel, 'verified solver label');
});
