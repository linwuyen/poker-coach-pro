import type { InfiniteHandCandidate } from './infiniteHandGenerator';

function relevance(candidate: InfiniteHandCandidate, failed: InfiniteHandCandidate): number {
  let score = 0;
  if (candidate.familyId === failed.familyId) score += 100;
  if (candidate.street === failed.street) score += 24;
  if (candidate.position === failed.position) score += 18;
  if (candidate.actionClass === failed.actionClass) score += 18;
  if (candidate.format === failed.format) score += 12;
  if (candidate.stackBand !== 'unknown' && candidate.stackBand === failed.stackBand) score += 10;
  if (candidate.source === failed.source) score += 4;
  return score;
}

/**
 * Build an immediate repair queue only from the already truth-gated Infinite pool.
 * No answer is synthesized: this only reorders validated candidates after a miss.
 */
export function selectTargetedReviewCandidates(
  pool: InfiniteHandCandidate[],
  failed: InfiniteHandCandidate,
  recentIds: string[] = [],
  limit = 3,
): InfiniteHandCandidate[] {
  const recent = new Set(recentIds.slice(-64));
  const ranked = pool
    .filter(candidate => candidate.id !== failed.id)
    .map(candidate => ({ candidate, score: relevance(candidate, failed), recent: recent.has(candidate.id) }))
    .filter(item => item.score >= 24)
    .sort((left, right) => {
      if (left.recent !== right.recent) return left.recent ? 1 : -1;
      if (right.score !== left.score) return right.score - left.score;
      return left.candidate.id.localeCompare(right.candidate.id);
    });
  const selected: InfiniteHandCandidate[] = [];
  const fingerprints = new Set<string>();
  for (const item of ranked) {
    if (fingerprints.has(item.candidate.presentationFingerprint)) continue;
    selected.push(item.candidate);
    fingerprints.add(item.candidate.presentationFingerprint);
    if (selected.length >= Math.max(0, limit)) break;
  }
  return selected;
}

export function targetedReviewReason(candidate: InfiniteHandCandidate, failed: InfiniteHandCandidate): string {
  const matches = [
    candidate.familyId === failed.familyId ? 'same decision family' : undefined,
    candidate.street === failed.street ? failed.street : undefined,
    candidate.position === failed.position ? failed.position : undefined,
    candidate.actionClass === failed.actionClass ? failed.actionClass : undefined,
    candidate.stackBand !== 'unknown' && candidate.stackBand === failed.stackBand ? `${failed.stackBand}BB band` : undefined,
  ].filter(Boolean);
  return matches.join(' · ') || 'structural review';
}
