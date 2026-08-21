import assert from 'node:assert/strict';
import test from 'node:test';
import { createRandomizedBlockExperiment, evaluateLearningExperiment } from '../src/learning-engine/experiment';
import { HistoryItem } from '../src/types';

const DAY = 86400000;
const arms = [
  { id: 'standard', label: 'Standard feedback', intervention: '10-second answer + why' },
  { id: 'contrastive', label: 'Contrastive feedback', intervention: 'one-variable counterfactual after answer' },
];

function spec() {
  return createRandomizedBlockExperiment({
    id: 'n1-feedback', version: '1', preRegisteredAt: 0, startAt: DAY, blockDurationMs: DAY, blockCount: 4,
    arms, metric: 'holdout-accuracy', assignmentSeed: 'stable-seed', hypothesis: 'Contrastive feedback improves holdout accuracy.', minSamplesPerArm: 2,
  });
}

test('randomized block assignment is deterministic and balanced across arms', () => {
  const first = spec();
  const second = spec();
  assert.deepEqual(first.blocks, second.blocks);
  assert.equal(first.blocks.filter(block => block.armId === 'standard').length, 2);
  assert.equal(first.blocks.filter(block => block.armId === 'contrastive').length, 2);
});

test('experiment evaluates only preregistered primary outcome evidence inside assigned blocks', () => {
  const experiment = spec();
  const history: HistoryItem[] = [];
  experiment.blocks.forEach(block => {
    const good = block.armId === 'contrastive';
    history.push(
      { scenarioId: `${block.id}-1`, category: ['holdout'], score: good ? 10 : 0, judgment: good ? 'right' : 'wrong', timestamp: block.startAt + 1000, correct: good, trainingType: 'solver-benchmark', solverCorpusRole: 'holdout' },
      { scenarioId: `${block.id}-2`, category: ['holdout'], score: 10, judgment: 'right', timestamp: block.startAt + 2000, correct: true, trainingType: 'solver-benchmark', solverCorpusRole: 'holdout' },
      { scenarioId: `${block.id}-noise`, category: ['train'], score: 10, judgment: 'right', timestamp: block.startAt + 3000, correct: true, trainingType: 'scenario' },
    );
  });
  const result = evaluateLearningExperiment(history, experiment);
  assert.equal(result.status, 'randomized-n-of-1');
  assert.equal(result.bestArmId, 'contrastive');
  assert.ok((result.absoluteDifference || 0) > 0);
  assert.match(result.claim, /not a population-wide causal claim/);
});

test('experiment refuses to announce a winner below sample/block evidence gates', () => {
  const experiment = spec();
  const result = evaluateLearningExperiment([
    { scenarioId: 'only-one', category: ['holdout'], score: 10, judgment: 'right', timestamp: experiment.blocks[0].startAt + 1, correct: true, trainingType: 'solver-benchmark', solverCorpusRole: 'holdout' },
  ], experiment);
  assert.equal(result.status, 'insufficient');
  assert.equal(result.bestArmId, undefined);
});
