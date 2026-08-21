import assert from 'node:assert/strict';
import test from 'node:test';
import { importPopulationRegistry, populationRegistryReport, validatePopulationCohort } from '../src/strategy-engine-v2/populationRegistry';

const cohort = {
  schemaVersion: 1 as const,
  id: 'gg-nl50-6max-q2',
  version: '2026q2',
  site: 'GGPoker',
  stake: 'NL50',
  game: 'cash',
  tableSize: '6max',
  population: 'regular pool',
  observedFrom: '2026-04-01T00:00:00Z',
  observedTo: '2026-06-30T23:59:59Z',
  generatedAt: '2026-07-05T00:00:00Z',
  sampleSize: 120000,
  reference: 'file://population-report.json',
  methodology: 'Observed opportunities; duplicate hands removed.',
  metrics: [{ id: 'river-fold-vs-bet', label: 'River fold vs bet', numerator: 6400, denominator: 10000, rate: 0.64 }],
  exploitProfileKeys: ['population:gg-river@2026q2'],
};

test('population registry preserves site/stake/window/sample provenance and measured counts', () => {
  const valid = validatePopulationCohort(cohort);
  assert.equal(valid.metrics[0].rate, 0.64);
  const report = populationRegistryReport([valid]);
  assert.equal(report.cohorts, 1);
  assert.equal(report.totalSampleSize, 120000);
  assert.deepEqual(report.sites, ['GGPoker']);
  assert.equal(report.linkedExploitProfiles, 1);
});

test('population registry refuses decorative rates that disagree with raw counts', () => {
  assert.throws(() => validatePopulationCohort({ ...cohort, metrics: [{ ...cohort.metrics[0], rate: 0.72 }] }));
});

test('population cohort id@version is immutable', () => {
  const envelope = { schemaVersion: 1 as const, exportedAt: '2026-07-05T00:00:00Z', cohorts: [cohort] };
  const first = importPopulationRegistry(envelope);
  assert.equal(first.cohorts.length, 1);
  const duplicate = importPopulationRegistry(envelope, first.cohorts);
  assert.equal(duplicate.cohorts.length, 0);
  assert.equal(duplicate.warnings.length, 1);
  assert.throws(() => importPopulationRegistry({ ...envelope, cohorts: [{ ...cohort, sampleSize: 120001 }] }, first.cohorts));
});
