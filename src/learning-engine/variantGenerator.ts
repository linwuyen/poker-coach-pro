import { Scenario } from '../types';
import { makeSuitIsomorphicScenario } from '../teaching/scenarioCatalog';

/**
 * Generate strategy-equivalent transfer nodes by permuting only suits.
 * Hold'em is invariant under a global suit renaming, so the optimal action and
 * feedback ground truth remain valid. This deliberately does NOT mutate stack,
 * bet size, position, range, or board ranks without solver-backed truth.
 */
export function generateEquivalentDecisionVariants(base: Scenario, count = 6): Scenario[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const variant = makeSuitIsomorphicScenario(base, index + 8, 'gen');
    return {
      ...variant,
      title: `${variant.title.replace(/ · 同構轉移$/, '')} · 泛化變式 ${index + 1}`,
      reviewSourceId: base.reviewSourceId || base.id,
      benchmarkRole: 'training' as const,
    };
  });
}

export function buildGeneratedVariantPool(scenarios: Scenario[], perScenario = 6): Scenario[] {
  return scenarios.flatMap(scenario => generateEquivalentDecisionVariants(scenario, perScenario));
}

export function sampleVariantSession(pool: Scenario[], size = 24, random: () => number = Math.random): Scenario[] {
  const remaining = [...pool];
  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.min(0.999999999999, Math.max(0, random())) * (index + 1));
    [remaining[index], remaining[swap]] = [remaining[swap], remaining[index]];
  }

  // Avoid placing two variants of the same source scenario back-to-back when possible.
  const selected: Scenario[] = [];
  while (remaining.length && selected.length < Math.min(size, pool.length)) {
    const previousSource = selected[selected.length - 1]?.reviewSourceId;
    const candidateIndex = remaining.findIndex(item => !previousSource || item.reviewSourceId !== previousSource);
    const index = candidateIndex >= 0 ? candidateIndex : 0;
    selected.push(remaining.splice(index, 1)[0]);
  }
  return selected;
}
