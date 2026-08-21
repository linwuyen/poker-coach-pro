import { ParsedHandHistory } from './handHistory';

export type HandHistoryIntegrityCode =
  | 'missing-hero'
  | 'missing-hole-cards'
  | 'missing-button'
  | 'missing-blinds'
  | 'unsupported-table-size'
  | 'straddle-or-dead-blind'
  | 'run-it-twice-or-multiple-board'
  | 'cashout'
  | 'side-pot'
  | 'unknown-action-geometry';

export interface HandHistoryIntegrityIssue {
  code: HandHistoryIntegrityCode;
  severity: 'blocks-preflop' | 'blocks-postflop' | 'blocks-all';
  detail: string;
}

export interface HandHistoryIntegrityReport {
  handId: string;
  gradeablePreflop: boolean;
  gradeablePostflop: boolean;
  issues: HandHistoryIntegrityIssue[];
}

function issue(code: HandHistoryIntegrityCode, severity: HandHistoryIntegrityIssue['severity'], detail: string): HandHistoryIntegrityIssue {
  return { code, severity, detail };
}

/**
 * Detects HH features that the current deterministic replay does not model exactly. The parser may
 * still retain the hand as exposure evidence, but automatic solver regret must fail closed.
 */
export function auditHandHistoryForExactGrading(hand: ParsedHandHistory): HandHistoryIntegrityReport {
  const issues: HandHistoryIntegrityIssue[] = [];
  if (!hand.heroName) issues.push(issue('missing-hero','blocks-all','Hero identity is unavailable.'));
  if (!hand.holeCards || hand.holeCards.length !== 2) issues.push(issue('missing-hole-cards','blocks-all','Exact Hero hole cards are unavailable.'));
  if (!hand.buttonSeat) issues.push(issue('missing-button','blocks-all','Button seat is unavailable, so positions cannot be proven.'));
  if (!(hand.bigBlind > 0) || !(hand.smallBlind >= 0)) issues.push(issue('missing-blinds','blocks-all','Blind amounts are invalid or unavailable.'));
  if (hand.tableSize !== 6 && hand.tableSize !== 9) issues.push(issue('unsupported-table-size','blocks-all',`Only 6-max/9-max exact grading is modeled; observed ${hand.tableSize}.`));

  const raw = hand.raw;
  if (/\bstraddles?\b|posts?\s+(?:a\s+)?dead\s+blind|dead\s+button/i.test(raw)) {
    issues.push(issue('straddle-or-dead-blind','blocks-all','Straddle/dead-blind geometry is not represented by v2/v3 exact context.'));
  }
  if (/run\s+it\s+twice|first\s+(?:flop|turn|river)|second\s+(?:flop|turn|river)|\*\*\*\s+(?:first|second)\s+(?:flop|turn|river)/i.test(raw)) {
    issues.push(issue('run-it-twice-or-multiple-board','blocks-postflop','Multiple board runouts are not represented by v3 exact board state.'));
  }
  if (/cash\s*out|cashout/i.test(raw)) issues.push(issue('cashout','blocks-postflop','Cash-out settlement semantics are not modeled for exact postflop utility.'));
  if (/\bside\s+pot\b|\bmain\s+pot\b/i.test(raw)) issues.push(issue('side-pot','blocks-postflop','Side-pot ownership is not represented by the heads-up v3 state.'));

  // A raise with no raise-to amount cannot reproduce the material action geometry exactly.
  if (hand.actions.some(action => action.type === 'raise' && action.toBB === undefined)) {
    issues.push(issue('unknown-action-geometry','blocks-all','At least one raise lacks an exact raise-to amount.'));
  }

  const blocksPreflop = issues.some(item => item.severity === 'blocks-preflop' || item.severity === 'blocks-all');
  const blocksPostflop = issues.some(item => item.severity === 'blocks-postflop' || item.severity === 'blocks-all');
  return { handId: hand.id, gradeablePreflop: !blocksPreflop, gradeablePostflop: !blocksPostflop, issues };
}

export function summarizeIntegrity(reports: HandHistoryIntegrityReport[]): { hands: number; preflopBlocked: number; postflopBlocked: number; issueCounts: Record<string, number> } {
  const issueCounts: Record<string, number> = {};
  reports.forEach(report => report.issues.forEach(item => { issueCounts[item.code] = (issueCounts[item.code] || 0) + 1; }));
  return {
    hands: reports.length,
    preflopBlocked: reports.filter(report => !report.gradeablePreflop).length,
    postflopBlocked: reports.filter(report => !report.gradeablePostflop).length,
    issueCounts,
  };
}
