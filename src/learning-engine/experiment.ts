import { HistoryItem } from '../types';

export type LearningExperimentMetric = 'holdout-accuracy' | 'transfer-accuracy' | 'delayed-retention' | 'verified-ev-loss';

export interface ExperimentArm {
  id: string;
  label: string;
  intervention: string;
}

export interface ExperimentBlock {
  id: string;
  armId: string;
  startAt: number;
  endAt: number;
}

export interface LearningExperimentSpec {
  schemaVersion: 1;
  id: string;
  version: string;
  design: 'randomized-block-n-of-1';
  preRegisteredAt: number;
  metric: LearningExperimentMetric;
  arms: ExperimentArm[];
  blocks: ExperimentBlock[];
  washoutMs: number;
  minSamplesPerArm: number;
  assignmentSeed: string;
  hypothesis: string;
}

export interface ExperimentArmResult {
  armId: string;
  label: string;
  samples: number;
  blocksWithEvidence: number;
  mean: number | null;
}

export interface LearningExperimentResult {
  status: 'insufficient' | 'randomized-n-of-1';
  metric: LearningExperimentMetric;
  higherIsBetter: boolean;
  arms: ExperimentArmResult[];
  bestArmId?: string;
  absoluteDifference?: number;
  relativeDifferencePercent?: number;
  claim: string;
}

const METRICS: LearningExperimentMetric[] = ['holdout-accuracy', 'transfer-accuracy', 'delayed-retention', 'verified-ev-loss'];

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rng(seed: string): () => number {
  let state = hashSeed(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function createRandomizedBlockExperiment(input: {
  id: string;
  version: string;
  preRegisteredAt: number;
  startAt: number;
  blockDurationMs: number;
  blockCount: number;
  arms: ExperimentArm[];
  metric: LearningExperimentMetric;
  assignmentSeed: string;
  hypothesis: string;
  washoutMs?: number;
  minSamplesPerArm?: number;
}): LearningExperimentSpec {
  if (!input.id || !input.version || !input.assignmentSeed || !input.hypothesis) throw new Error('Experiment requires id, version, seed and preregistered hypothesis.');
  if (!Number.isFinite(input.preRegisteredAt) || input.preRegisteredAt > input.startAt) throw new Error('Experiment must be preregistered before the first block starts.');
  if (!Number.isFinite(input.blockDurationMs) || input.blockDurationMs <= 0 || !Number.isInteger(input.blockCount) || input.blockCount < input.arms.length * 2) {
    throw new Error('Experiment requires positive block duration and at least two blocks per arm.');
  }
  if (input.arms.length < 2 || new Set(input.arms.map(arm => arm.id)).size !== input.arms.length || input.arms.some(arm => !arm.id || !arm.label || !arm.intervention)) {
    throw new Error('Experiment requires at least two unique, fully described arms.');
  }
  const random = rng(input.assignmentSeed);
  const assignments: string[] = [];
  while (assignments.length < input.blockCount) {
    const cycle = input.arms.map(arm => arm.id);
    for (let index = cycle.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [cycle[index], cycle[swap]] = [cycle[swap], cycle[index]];
    }
    assignments.push(...cycle);
  }
  const blocks = assignments.slice(0, input.blockCount).map((armId, index) => ({
    id: `${input.id}:block-${index + 1}`,
    armId,
    startAt: input.startAt + index * input.blockDurationMs,
    endAt: input.startAt + (index + 1) * input.blockDurationMs,
  }));
  return {
    schemaVersion: 1,
    id: input.id,
    version: input.version,
    design: 'randomized-block-n-of-1',
    preRegisteredAt: input.preRegisteredAt,
    metric: input.metric,
    arms: input.arms.map(arm => ({ ...arm })),
    blocks,
    washoutMs: Math.max(0, input.washoutMs || 0),
    minSamplesPerArm: Math.max(1, Math.floor(input.minSamplesPerArm || 10)),
    assignmentSeed: input.assignmentSeed,
    hypothesis: input.hypothesis,
  };
}

export function validateLearningExperiment(spec: LearningExperimentSpec): LearningExperimentSpec {
  if (!spec || spec.schemaVersion !== 1 || spec.design !== 'randomized-block-n-of-1') throw new Error('Unsupported learning experiment schema/design.');
  if (!spec.id || !spec.version || !spec.assignmentSeed || !spec.hypothesis || !METRICS.includes(spec.metric)) throw new Error('Experiment metadata/primary metric is incomplete.');
  if (!Array.isArray(spec.blocks) || !spec.blocks.length || !Array.isArray(spec.arms)) throw new Error(`${spec.id}: experiment blocks/arms are required.`);
  if (!Number.isFinite(spec.preRegisteredAt) || spec.preRegisteredAt > Math.min(...spec.blocks.map(block => block.startAt))) throw new Error(`${spec.id}: preregistration must precede all blocks.`);
  if (!Number.isFinite(spec.washoutMs) || spec.washoutMs < 0) throw new Error(`${spec.id}: washout must be finite and non-negative.`);
  const armIds = new Set(spec.arms.map(arm => arm.id));
  if (armIds.size < 2 || armIds.size !== spec.arms.length || spec.arms.some(arm => !arm.id || !arm.label || !arm.intervention)) throw new Error(`${spec.id}: experiment arms must be unique and fully described.`);
  const sorted = [...spec.blocks].sort((a, b) => a.startAt - b.startAt);
  if (new Set(sorted.map(block => block.id)).size !== sorted.length) throw new Error(`${spec.id}: experiment block ids must be unique.`);
  sorted.forEach((block, index) => {
    if (!block.id || !armIds.has(block.armId) || !Number.isFinite(block.startAt) || !Number.isFinite(block.endAt) || block.endAt <= block.startAt) throw new Error(`${spec.id}: invalid experiment block.`);
    if (index > 0 && sorted[index - 1].endAt > block.startAt) throw new Error(`${spec.id}: experiment blocks cannot overlap.`);
    if (spec.washoutMs >= block.endAt - block.startAt) throw new Error(`${spec.id}: washout must be shorter than each block.`);
  });
  spec.arms.forEach(arm => {
    if (sorted.filter(block => block.armId === arm.id).length < 2) throw new Error(`${spec.id}: each arm requires at least two randomized blocks.`);
  });
  if (!Number.isInteger(spec.minSamplesPerArm) || spec.minSamplesPerArm < 1) throw new Error(`${spec.id}: minSamplesPerArm must be positive.`);
  return JSON.parse(JSON.stringify(spec)) as LearningExperimentSpec;
}

function metricValue(item: HistoryItem, metric: LearningExperimentMetric): number | undefined {
  if (metric === 'holdout-accuracy') {
    const holdout = item.trainingType === 'benchmark' || item.trainingType === 'solver-benchmark' || item.solverCorpusRole === 'holdout';
    return holdout && typeof item.correct === 'boolean' ? (item.correct ? 1 : 0) : undefined;
  }
  if (metric === 'transfer-accuracy') return item.isTransferTest && typeof item.correct === 'boolean' ? (item.correct ? 1 : 0) : undefined;
  if (metric === 'delayed-retention') return item.isDelayedReview && typeof item.correct === 'boolean' ? (item.correct ? 1 : 0) : undefined;
  // P10 never mixes tournament dollar/seat utility with cash BB regret.
  if (item.trainingType === 'real-hand'
      && item.truthTier === 'verified-solver'
      && item.gameFormat === 'Cash'
      && item.utilityUnit === 'bb'
      && item.utilityModel === 'cash-chip-ev'
      && typeof item.evLossBB === 'number'
      && Number.isFinite(item.evLossBB)) return item.evLossBB;
  return undefined;
}

export function evaluateLearningExperiment(history: HistoryItem[], rawSpec: LearningExperimentSpec): LearningExperimentResult {
  const spec = validateLearningExperiment(rawSpec);
  const byArm = new Map(spec.arms.map(arm => [arm.id, { values: [] as number[], blockIds: new Set<string>() }]));
  spec.blocks.forEach(block => {
    const effectiveStart = block.startAt + spec.washoutMs;
    history.forEach(item => {
      if (item.timestamp < effectiveStart || item.timestamp >= block.endAt) return;
      const value = metricValue(item, spec.metric);
      if (value === undefined) return;
      const bucket = byArm.get(block.armId)!;
      bucket.values.push(value);
      bucket.blockIds.add(block.id);
    });
  });
  const arms: ExperimentArmResult[] = spec.arms.map(arm => {
    const bucket = byArm.get(arm.id)!;
    return {
      armId: arm.id,
      label: arm.label,
      samples: bucket.values.length,
      blocksWithEvidence: bucket.blockIds.size,
      mean: bucket.values.length ? bucket.values.reduce((sum, value) => sum + value, 0) / bucket.values.length : null,
    };
  });
  const enough = arms.every(result => result.samples >= spec.minSamplesPerArm && result.blocksWithEvidence >= 2 && result.mean !== null);
  const higherIsBetter = spec.metric !== 'verified-ev-loss';
  if (!enough) return { status: 'insufficient', metric: spec.metric, higherIsBetter, arms, claim: 'Insufficient randomized block evidence; no experimental winner is reported.' };
  const ranked = [...arms].sort((left, right) => higherIsBetter ? (right.mean! - left.mean!) : (left.mean! - right.mean!));
  const best = ranked[0];
  const runnerUp = ranked[1];
  const absoluteDifference = Math.abs(best.mean! - runnerUp.mean!);
  const baseline = Math.abs(runnerUp.mean!) > 1e-12 ? Math.abs(runnerUp.mean!) : undefined;
  const relativeDifferencePercent = baseline ? absoluteDifference / baseline * 100 : undefined;
  return {
    status: 'randomized-n-of-1',
    metric: spec.metric,
    higherIsBetter,
    arms,
    bestArmId: best.armId,
    absoluteDifference,
    relativeDifferencePercent,
    claim: `Within this preregistered randomized N-of-1 block experiment, ${best.label} had the better observed ${spec.metric}. This supports an individual experimental comparison, not a population-wide causal claim.`,
  };
}
