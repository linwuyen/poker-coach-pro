export interface ReviewedStrategyExplanation {
  schemaVersion: 1;
  id: string;
  version: string;
  decisionFamilyId?: string;
  profileId?: string;
  hand?: string;
  title: string;
  why: string;
  boundaryConditions: string[];
  commonMistake: string;
  contrastiveCue: string;
  reference: string;
  authoredBy: string;
  reviewedBy: string[];
  reviewedAt: string;
  disclaimer: string;
}

export interface ExplanationRegistryEnvelope {
  schemaVersion: 1;
  exportedAt: string;
  explanations: ReviewedStrategyExplanation[];
  exporter?: string;
}

export function explanationKey(explanation: ReviewedStrategyExplanation): string {
  return `${explanation.id}@${explanation.version}`;
}

export function validateReviewedExplanation(input: ReviewedStrategyExplanation): ReviewedStrategyExplanation {
  if (!input || input.schemaVersion !== 1) throw new Error('Reviewed explanation schemaVersion must be 1.');
  if (!input.id || !input.version || !input.title || !input.why || !input.commonMistake || !input.contrastiveCue) {
    throw new Error('Reviewed explanation requires id, version and complete teaching content.');
  }
  const hasFamily = Boolean(input.decisionFamilyId);
  const hasProfileTarget = Boolean(input.profileId && input.hand);
  if (!hasFamily && !hasProfileTarget) throw new Error(`${input.id}: explanation must target decisionFamilyId or profileId+hand.`);
  if (!input.reference || !input.authoredBy || !Array.isArray(input.reviewedBy) || !input.reviewedBy.length || !input.reviewedAt) {
    throw new Error(`${input.id}: authored/reviewed provenance is required.`);
  }
  if (!Number.isFinite(Date.parse(input.reviewedAt))) throw new Error(`${input.id}: invalid reviewedAt.`);
  if (!Array.isArray(input.boundaryConditions) || !input.boundaryConditions.length || input.boundaryConditions.some(value => !value.trim())) {
    throw new Error(`${input.id}: at least one explicit boundary condition is required.`);
  }
  if (!input.disclaimer.toLowerCase().includes('review')) {
    throw new Error(`${input.id}: disclaimer must state that the explanation is reviewed interpretation, not raw solver output.`);
  }
  return JSON.parse(JSON.stringify(input)) as ReviewedStrategyExplanation;
}

export function importExplanationRegistry(
  raw: string | ExplanationRegistryEnvelope,
  existing: ReviewedStrategyExplanation[] = [],
): { explanations: ReviewedStrategyExplanation[]; warnings: string[] } {
  const envelope = typeof raw === 'string' ? JSON.parse(raw) as ExplanationRegistryEnvelope : raw;
  if (!envelope || envelope.schemaVersion !== 1 || !Array.isArray(envelope.explanations)) throw new Error('Invalid explanation registry envelope.');
  const byKey = new Map(existing.map(item => [explanationKey(item), item]));
  const explanations: ReviewedStrategyExplanation[] = [];
  const warnings: string[] = [];
  envelope.explanations.forEach(candidate => {
    const validated = validateReviewedExplanation(candidate);
    const key = explanationKey(validated);
    const previous = byKey.get(key);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(validated)) throw new Error(`${key} is immutable; publish a new explanation version.`);
      warnings.push(`${key} already exists and was skipped.`);
      return;
    }
    byKey.set(key, validated);
    explanations.push(validated);
  });
  return { explanations, warnings };
}

export function findReviewedExplanation(
  explanations: ReviewedStrategyExplanation[],
  query: { decisionFamilyId?: string; profileId?: string; hand?: string },
): ReviewedStrategyExplanation | undefined {
  return explanations
    .filter(item => query.decisionFamilyId ? item.decisionFamilyId === query.decisionFamilyId : item.profileId === query.profileId && item.hand === query.hand)
    .sort((left, right) => Date.parse(right.reviewedAt) - Date.parse(left.reviewedAt) || right.version.localeCompare(left.version))[0];
}
