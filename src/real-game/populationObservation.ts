import { Street } from '../types';
import { ParsedHandAction, ParsedHandHistory } from './handHistory';

export type ObservedFacing = 'checked-to' | 'facing-bet' | 'facing-raise' | 'none';

export interface ObservedPopulationMetric {
  key: string;
  street: Exclude<Street, 'Preflop'>;
  facing: ObservedFacing;
  action: 'check' | 'bet' | 'call' | 'raise' | 'fold' | 'all-in';
  numerator: number;
  denominator: number;
  rate: number;
}

export interface ObservedPopulationCohort {
  schemaVersion: 1;
  id: string;
  version: string;
  source: 'local-hand-history';
  site: 'pokerstars' | 'ggpoker' | 'generic' | 'mixed';
  game: 'Cash' | 'MTT' | 'Mixed';
  tableSize: number | 'mixed';
  observedFrom?: number;
  observedTo?: number;
  generatedAt: string;
  sampleHands: number;
  decisionOpportunities: number;
  sourceHandIdsHash: string;
  methodology: string;
  trust: 'measured-local-cohort';
  metrics: ObservedPopulationMetric[];
}

function fnv(values: string[]): string {
  const canonical = [...values].sort().join('|');
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function observedFacing(prior: ParsedHandAction[]): ObservedFacing {
  for (let cursor = prior.length - 1; cursor >= 0; cursor -= 1) {
    const action = prior[cursor];
    if (action.type === 'raise' || action.type === 'all-in') return 'facing-raise';
    if (action.type === 'bet') return 'facing-bet';
    if (action.type === 'check') return 'checked-to';
  }
  return 'none';
}

function canonicalAction(action: ParsedHandAction): ObservedPopulationMetric['action'] | undefined {
  if (action.type === 'check' || action.type === 'bet' || action.type === 'call' || action.type === 'raise' || action.type === 'fold') return action.type;
  if (action.type === 'all-in') return 'all-in';
  return undefined;
}

/**
 * Aggregates actual observed postflop decisions from imported HH. This is measured evidence, not a
 * population-exploit recommendation: no solver optimality or exploit direction is inferred here.
 */
export function buildObservedPopulationCohort(hands: ParsedHandHistory[], generatedAt = Date.now()): ObservedPopulationCohort {
  const counts = new Map<string, { street: Exclude<Street, 'Preflop'>; facing: ObservedFacing; action: ObservedPopulationMetric['action']; numerator: number; denominator: number }>();
  let opportunities = 0;
  for (const hand of hands) {
    const streets: Array<Exclude<Street, 'Preflop'>> = ['Flop', 'Turn', 'River'];
    for (const street of streets) {
      const actions = hand.actions.filter(action => action.street === street && action.type !== 'post');
      for (let index = 0; index < actions.length; index += 1) {
        const action = canonicalAction(actions[index]);
        if (!action) continue;
        const facing = observedFacing(actions.slice(0, index));
        opportunities += 1;
        const possible: ObservedPopulationMetric['action'][] = facing === 'facing-bet' || facing === 'facing-raise'
          ? ['call', 'raise', 'fold', 'all-in']
          : ['check', 'bet', 'all-in'];
        for (const candidate of possible) {
          const key = `${street}|${facing}|${candidate}`;
          const current = counts.get(key) || { street, facing, action: candidate, numerator: 0, denominator: 0 };
          current.denominator += 1;
          if (candidate === action) current.numerator += 1;
          counts.set(key, current);
        }
      }
    }
  }
  const sites = [...new Set(hands.map(hand => hand.source))];
  const games = [...new Set(hands.map(hand => hand.format))];
  const sizes = [...new Set(hands.map(hand => hand.tableSize))];
  const timestamps = hands.map(hand => hand.timestamp).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const hash = fnv(hands.map(hand => hand.id));
  const metrics = [...counts.entries()].map(([key, value]) => ({
    key,
    street: value.street,
    facing: value.facing,
    action: value.action,
    numerator: value.numerator,
    denominator: value.denominator,
    rate: value.denominator ? value.numerator / value.denominator : 0,
  })).sort((a, b) => a.key.localeCompare(b.key));
  return {
    schemaVersion: 1,
    id: `observed-hh:${hash}`,
    version: new Date(generatedAt).toISOString(),
    source: 'local-hand-history',
    site: sites.length === 1 ? sites[0] : 'mixed',
    game: games.length === 1 ? games[0] : 'Mixed',
    tableSize: sizes.length === 1 ? sizes[0] : 'mixed',
    observedFrom: timestamps.length ? Math.min(...timestamps) : undefined,
    observedTo: timestamps.length ? Math.max(...timestamps) : undefined,
    generatedAt: new Date(generatedAt).toISOString(),
    sampleHands: hands.length,
    decisionOpportunities: opportunities,
    sourceHandIdsHash: hash,
    methodology: 'Direct numerator/denominator aggregation of observed postflop actions in locally imported hand histories. No solver optimality or exploit recommendation is inferred.',
    trust: 'measured-local-cohort',
    metrics,
  };
}
