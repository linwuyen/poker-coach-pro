import { ParsedHandHistory } from './handHistory';
import { forcedBetContextKey, hasNonstandardForcedBetMarker, settlementGeometry } from './handHistoryGeometry';

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

/** Detects only geometry the current exact replay still cannot prove. Supported P18 geometry no longer blocks merely because a marker exists. */
export function auditHandHistoryForExactGrading(hand: ParsedHandHistory): HandHistoryIntegrityReport {
  const issues: HandHistoryIntegrityIssue[] = [];
  if (!hand.heroName) issues.push(issue('missing-hero','blocks-all','Hero identity is unavailable.'));
  if (!hand.holeCards || hand.holeCards.length !== 2) issues.push(issue('missing-hole-cards','blocks-all','Exact Hero hole cards are unavailable.'));
  if (!hand.buttonSeat) issues.push(issue('missing-button','blocks-all','Button seat is unavailable, so positions cannot be proven.'));
  if (!(hand.bigBlind > 0) || !(hand.smallBlind >= 0)) issues.push(issue('missing-blinds','blocks-all','Blind amounts are invalid or unavailable.'));
  if (hand.tableSize !== 6 && hand.tableSize !== 9) issues.push(issue('unsupported-table-size','blocks-all',`Only 6-max/9-max exact grading is modeled; observed ${hand.tableSize}.`));

  // P18: straddles/dead blinds are supported only when position/type/amount can be canonicalized.
  if (hasNonstandardForcedBetMarker(hand) && !forcedBetContextKey(hand)) {
    issues.push(issue('straddle-or-dead-blind','blocks-all','Non-standard forced bet marker exists, but exact position/type/amount geometry could not be reconstructed.'));
  }

  const settlement = settlementGeometry(hand);
  // Multiple runouts/cash-out after all Hero decisions do not change the solver decision state being graded.
  if (settlement.multipleRunout && settlement.heroActsAfterMultipleRunout) {
    issues.push(issue('run-it-twice-or-multiple-board','blocks-postflop','Hero acts after multiple-board settlement begins; the decision board cannot be represented as one exact v3/v4 runout.'));
  }
  if (settlement.cashout && settlement.heroActsAfterCashout) {
    issues.push(issue('cashout','blocks-postflop','Hero acts after cash-out settlement begins; post-settlement utility/action geometry is not modeled.'));
  }

  // P18 side pots are represented decision-by-decision by v4 potStructureKey when an active all-in makes tiers material.
  // A side-pot marker alone is therefore not a blocker. Impossible two-player side-pot text remains fail-closed.
  if (settlement.sidePotMarker && hand.players.length < 3) {
    issues.push(issue('side-pot','blocks-postflop','Side-pot marker exists without enough players to reconstruct a valid side-pot geometry.'));
  }

  // A raise/all-in with no exact amount cannot reproduce material action geometry exactly.
  if (hand.actions.some(action => action.type === 'raise' && action.toBB === undefined)
      || hand.actions.some(action => action.type === 'all-in' && action.toBB === undefined && action.amountBB === undefined)) {
    issues.push(issue('unknown-action-geometry','blocks-all','At least one raise/all-in lacks an exact amount/raise-to amount.'));
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
