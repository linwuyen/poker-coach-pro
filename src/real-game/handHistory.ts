import { HistoryItem, Street } from '../types';
import { NormalizedSessionImport, sessionImportToHistory } from './sessionImport';

export type HandHistorySite = 'pokerstars' | 'ggpoker' | 'generic';
export type ParsedActionType = 'post' | 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in';

export interface ParsedHandPlayer {
  seat: number;
  name: string;
  stack: number;
  stackBB: number;
}

export interface ParsedHandAction {
  street: Street;
  player: string;
  type: ParsedActionType;
  amount?: number;
  amountBB?: number;
  toAmount?: number;
  toBB?: number;
  raw: string;
}

export interface ParsedHandHistory {
  source: HandHistorySite;
  id: string;
  format: 'Cash' | 'MTT';
  tableName?: string;
  tableSize: number;
  buttonSeat?: number;
  smallBlind: number;
  bigBlind: number;
  heroName?: string;
  heroSeat?: number;
  heroPosition?: string;
  heroStackBB?: number;
  holeCards?: string[];
  board: string[];
  players: ParsedHandPlayer[];
  actions: ParsedHandAction[];
  collected: number;
  contributed: number;
  returned: number;
  netWonBB?: number;
  timestamp?: number;
  raw: string;
}

export interface HandHistoryImportResult {
  hands: ParsedHandHistory[];
  history: HistoryItem[];
  parsedHandIds: string[];
  skippedHandIds: string[];
  heroNames: string[];
  contexts: number;
}

const STREET_MARKERS: Array<[RegExp, Street]> = [
  [/\*\*\*\s*FLOP\s*\*\*\*/i, 'Flop'],
  [/\*\*\*\s*TURN\s*\*\*\*/i, 'Turn'],
  [/\*\*\*\s*RIVER\s*\*\*\*/i, 'River'],
];

function numberFromAmount(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[^0-9.,-]/g, '').replace(/,/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstAmount(text: string): number | undefined {
  const match = text.match(/(?:[$€£¥]|USD|EUR|GBP)?\s*([0-9]+(?:[.,][0-9]+)*)/i);
  return numberFromAmount(match?.[1]);
}

function extractBlinds(header: string): { smallBlind: number; bigBlind: number } {
  const parens = [...header.matchAll(/\(([^()]*)\)/g)].map(match => match[1]);
  for (const content of parens) {
    const match = content.match(/(?:[$€£¥]\s*)?([0-9]+(?:[.,][0-9]+)*)\s*\/\s*(?:[$€£¥]\s*)?([0-9]+(?:[.,][0-9]+)*)/);
    if (!match) continue;
    const smallBlind = numberFromAmount(match[1]);
    const bigBlind = numberFromAmount(match[2]);
    if (smallBlind !== undefined && bigBlind && bigBlind > 0) return { smallBlind, bigBlind };
  }
  return { smallBlind: 0.5, bigBlind: 1 };
}

function splitHands(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const starts = [...normalized.matchAll(/^(?=(?:PokerStars Hand|Poker Hand)\s*#)/gmi)].map(match => match.index || 0);
  if (!starts.length) return [normalized];
  return starts.map((start, index) => normalized.slice(start, starts[index + 1] ?? normalized.length).trim()).filter(Boolean);
}

function detectSource(raw: string): HandHistorySite {
  if (/^PokerStars Hand\s*#/mi.test(raw)) return 'pokerstars';
  if (/^Poker Hand\s*#/mi.test(raw)) return 'ggpoker';
  return 'generic';
}

function parseTimestamp(raw: string): number | undefined {
  const match = raw.match(/-\s*(20\d{2}[\/-]\d{2}[\/-]\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  if (!match) return undefined;
  const iso = `${match[1].replace(/\//g, '-') }T${match[2]}`;
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : undefined;
}

function normalizeActionAmount(raw: string, bigBlind: number): Pick<ParsedHandAction, 'amount' | 'amountBB' | 'toAmount' | 'toBB'> {
  const raise = raw.match(/raises\s+(?:[$€£¥]\s*)?([0-9.,]+)\s+to\s+(?:[$€£¥]\s*)?([0-9.,]+)/i);
  if (raise) {
    const amount = numberFromAmount(raise[1]);
    const toAmount = numberFromAmount(raise[2]);
    return {
      amount,
      amountBB: amount !== undefined ? amount / bigBlind : undefined,
      toAmount,
      toBB: toAmount !== undefined ? toAmount / bigBlind : undefined,
    };
  }
  const amount = firstAmount(raw.replace(/^.*?:\s*/, ''));
  return { amount, amountBB: amount !== undefined ? amount / bigBlind : undefined };
}

function actionType(line: string): ParsedActionType | undefined {
  if (/posts (?:small|big) blind|posts the ante/i.test(line)) return 'post';
  if (/\bfolds\b/i.test(line)) return 'fold';
  if (/\bchecks\b/i.test(line)) return 'check';
  if (/\bcalls\b/i.test(line)) return /all-in/i.test(line) ? 'all-in' : 'call';
  if (/\bbets\b/i.test(line)) return /all-in/i.test(line) ? 'all-in' : 'bet';
  if (/\braises\b/i.test(line)) return /all-in/i.test(line) ? 'all-in' : 'raise';
  return undefined;
}

function parseBoardFromMarker(line: string): string[] {
  return [...line.matchAll(/\[([^\]]+)\]/g)].flatMap(match => match[1].trim().split(/\s+/)).filter(card => /^[2-9TJQKA][shdc]$/i.test(card));
}

function positionForSeat(players: ParsedHandPlayer[], heroSeat?: number, buttonSeat?: number): string | undefined {
  if (heroSeat === undefined || buttonSeat === undefined || players.length < 2) return undefined;
  const seats = [...players].sort((a, b) => a.seat - b.seat).map(player => player.seat);
  const buttonIndex = seats.indexOf(buttonSeat);
  const heroIndex = seats.indexOf(heroSeat);
  if (buttonIndex < 0 || heroIndex < 0) return undefined;
  const offset = (heroIndex - buttonIndex + seats.length) % seats.length;
  const maps: Record<number, string[]> = {
    2: ['BTN', 'BB'],
    3: ['BTN', 'SB', 'BB'],
    4: ['BTN', 'SB', 'BB', 'CO'],
    5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
    6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
    7: ['BTN', 'SB', 'BB', 'UTG', 'MP', 'HJ', 'CO'],
    8: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'MP', 'HJ', 'CO'],
    9: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'UTG2', 'MP', 'HJ', 'CO'],
  };
  const map = maps[Math.min(9, Math.max(2, seats.length))];
  return map?.[Math.min(offset, map.length - 1)];
}

function parseOne(raw: string, heroOverride?: string): ParsedHandHistory | null {
  const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  const source = detectSource(raw);
  const idMatch = raw.match(/(?:PokerStars Hand|Poker Hand)\s*#([^:\s]+)/i) || raw.match(/hand\s+([^\s*]+?)(?:\s|\*)/i);
  const id = idMatch?.[1];
  if (!id) return null;
  const header = lines.slice(0, 3).join(' ');
  const format: 'Cash' | 'MTT' = /Tournament\s*#/i.test(raw) ? 'MTT' : 'Cash';
  const { smallBlind, bigBlind } = extractBlinds(header);
  const tableMatch = raw.match(/Table\s+'([^']+)'[^\n]*?(\d+)-max[^\n]*?Seat\s*#(\d+)\s+is\s+the\s+button/i);
  const tableName = tableMatch?.[1];
  const declaredSize = tableMatch ? Number(tableMatch[2]) : undefined;
  const buttonSeat = tableMatch ? Number(tableMatch[3]) : undefined;
  const seatMatches = [...raw.matchAll(/^Seat\s+(\d+):\s+(.+?)\s+\(([^)]*?)\s+in\s+chips\)/gmi)];
  const players: ParsedHandPlayer[] = seatMatches.map(match => {
    const stack = firstAmount(match[3]) ?? 0;
    return { seat: Number(match[1]), name: match[2].trim(), stack, stackBB: bigBlind > 0 ? stack / bigBlind : 0 };
  });
  const dealt = raw.match(/Dealt to\s+(.+?)\s+\[([^\]]+)\]/i);
  const heroName = heroOverride?.trim() || dealt?.[1]?.trim();
  const heroPlayer = heroName ? players.find(player => player.name === heroName) : undefined;
  const heroSeat = heroPlayer?.seat;
  const heroPosition = positionForSeat(players, heroSeat, buttonSeat);
  const heroStackBB = heroPlayer?.stackBB;
  const holeCards = dealt?.[2]?.trim().split(/\s+/).filter(Boolean);
  const actions: ParsedHandAction[] = [];
  const board: string[] = [];
  let street: Street = 'Preflop';
  let contributed = 0;
  let returned = 0;
  let collected = 0;

  for (const line of lines) {
    for (const [pattern, markerStreet] of STREET_MARKERS) {
      if (pattern.test(line)) {
        street = markerStreet;
        const cards = parseBoardFromMarker(line);
        cards.forEach(card => { if (!board.includes(card)) board.push(card); });
      }
    }
    const actor = line.match(/^(.+?):\s+(.+)$/);
    if (actor) {
      const type = actionType(line);
      if (type) {
        const amounts = normalizeActionAmount(line, bigBlind);
        actions.push({ street, player: actor[1].trim(), type, raw: line, ...amounts });
        if (heroName && actor[1].trim() === heroName) {
          if (type === 'post' || type === 'call' || type === 'bet' || type === 'raise' || type === 'all-in') contributed += amounts.amount ?? 0;
        }
      }
    }
    if (heroName && line.startsWith(heroName)) {
      const returnedMatch = line.match(/Uncalled bet\s*\(([^)]+)\)\s+returned/i) || line.match(/returned to\s+.+?\s*\(([^)]+)\)/i);
      if (returnedMatch) returned += firstAmount(returnedMatch[1]) ?? 0;
      const collectMatch = line.match(/collected\s+(?:[$€£¥]\s*)?([0-9.,]+)\s+from pot/i);
      if (collectMatch) collected += numberFromAmount(collectMatch[1]) ?? 0;
    }
  }
  // Some sites put "Uncalled bet (...) returned to Hero" before the actor name.
  if (heroName) {
    for (const match of raw.matchAll(/Uncalled bet\s*\(([^)]+)\)\s+returned to\s+([^\n]+)/gi)) {
      if (match[2].trim() === heroName && returned === 0) returned += firstAmount(match[1]) ?? 0;
    }
  }
  const netWonBB = heroName && bigBlind > 0 ? (collected + returned - contributed) / bigBlind : undefined;
  return {
    source,
    id,
    format,
    tableName,
    tableSize: declaredSize || players.length,
    buttonSeat,
    smallBlind,
    bigBlind,
    heroName,
    heroSeat,
    heroPosition,
    heroStackBB,
    holeCards,
    board,
    players,
    actions,
    collected,
    contributed,
    returned,
    netWonBB,
    timestamp: parseTimestamp(header),
    raw,
  };
}

export function parseHandHistoryText(text: string, heroOverride?: string): ParsedHandHistory[] {
  const seen = new Set<string>();
  return splitHands(text)
    .map(raw => parseOne(raw, heroOverride))
    .filter((hand): hand is ParsedHandHistory => Boolean(hand))
    .filter(hand => { if (seen.has(hand.id)) return false; seen.add(hand.id); return true; });
}

function stackBand(stackBB: number | undefined): string {
  if (stackBB === undefined) return 'unknown';
  if (stackBB <= 20) return '10-20';
  if (stackBB <= 40) return '20-40';
  if (stackBB <= 100) return '40-100';
  return '100+';
}

function facingType(actions: ParsedHandAction[], index: number, heroName: string): string {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const action = actions[cursor];
    if (action.player === heroName) continue;
    if (action.type === 'raise' || action.type === 'all-in') return 'raise';
    if (action.type === 'bet') return 'bet';
    if (action.type === 'check') return 'check';
  }
  return 'none';
}

function skillIdsFor(hand: ParsedHandHistory, action: ParsedHandAction, facing: string, depth: number): string[] {
  if (action.street === 'Preflop') {
    if (hand.heroPosition === 'BB' && facing === 'raise') return ['preflop.bb-defense'];
    if (depth >= 3) return ['preflop.4bet'];
    if (depth >= 2) return ['preflop.3bet'];
    return ['preflop.rfi'];
  }
  const ids = new Set<string>(['postflop.board-texture']);
  if (action.street === 'River' && (facing === 'bet' || facing === 'raise')) ids.add('postflop.bluff-catch');
  if (action.type === 'bet' || action.type === 'raise' || action.type === 'all-in') ids.add('postflop.bet-sizing');
  return [...ids];
}

interface ExposureSpot {
  contextFamilyId: string;
  label: string;
  format: 'Cash' | 'MTT';
  street: Street;
  position?: string;
  skillIds: string[];
  situationIds: string[];
  chosenAction: string;
}

function spotsForHand(hand: ParsedHandHistory): ExposureSpot[] {
  if (!hand.heroName) return [];
  const result: ExposureSpot[] = [];
  const streetAggressionDepth = new Map<Street, number>();
  hand.actions.forEach((action, index) => {
    if (action.type === 'bet' || action.type === 'raise' || action.type === 'all-in') {
      streetAggressionDepth.set(action.street, (streetAggressionDepth.get(action.street) || 0) + 1);
    }
    if (action.player !== hand.heroName || action.type === 'post') return;
    const facing = facingType(hand.actions.filter(candidate => candidate.street === action.street), hand.actions.filter(candidate => candidate.street === action.street).findIndex(candidate => candidate === action), hand.heroName!);
    const depth = streetAggressionDepth.get(action.street) || 0;
    const position = hand.heroPosition || 'UNK';
    const band = stackBand(hand.heroStackBB);
    const contextFamilyId = `hh:${hand.format.toLowerCase()}:${hand.tableSize}max:${position.toLowerCase()}:${band}:${action.street.toLowerCase()}:face-${facing}:depth-${depth}`;
    result.push({
      contextFamilyId,
      label: `${position} · ${band}BB · ${action.street} · facing ${facing} · depth ${depth}`,
      format: hand.format,
      street: action.street,
      position: hand.heroPosition,
      skillIds: skillIdsFor(hand, action, facing, depth),
      situationIds: [
        `format.${hand.format.toLowerCase()}`,
        `position.${position.toLowerCase()}`,
        `stack.${band}`,
        `street.${action.street.toLowerCase()}`,
        `source.${hand.source}`,
        `facing.${facing}`,
        `action-depth.${depth}`,
      ],
      chosenAction: action.type,
    });
  });
  return result;
}

export function handHistoriesToSessionImports(hands: ParsedHandHistory[], batchId: string): NormalizedSessionImport[] {
  const byFormat = new Map<'Cash' | 'MTT', ParsedHandHistory[]>();
  hands.filter(hand => hand.heroName).forEach(hand => byFormat.set(hand.format, [...(byFormat.get(hand.format) || []), hand]));
  return [...byFormat.entries()].map(([format, formatHands]) => {
    const aggregates = new Map<string, { spot: ExposureSpot; count: number; actions: Map<string, number> }>();
    formatHands.forEach(hand => spotsForHand(hand).forEach(spot => {
      const current = aggregates.get(spot.contextFamilyId) || { spot, count: 0, actions: new Map<string, number>() };
      current.count += 1;
      current.actions.set(spot.chosenAction, (current.actions.get(spot.chosenAction) || 0) + 1);
      aggregates.set(spot.contextFamilyId, current);
    }));
    const endedAt = Math.max(...formatHands.map(hand => hand.timestamp || 0), 0) || undefined;
    return {
      schemaVersion: 1,
      session: { id: `${batchId}:${format.toLowerCase()}`, format, handsObserved: formatHands.length, endedAt },
      spots: [...aggregates.values()].map(({ spot, count, actions }) => ({
        contextFamilyId: spot.contextFamilyId,
        label: `${spot.label} · actions ${[...actions.entries()].map(([action, value]) => `${action}:${value}`).join('/')}`,
        skillIds: spot.skillIds,
        situationIds: spot.situationIds,
        street: spot.street,
        position: spot.position,
        exposureCount: count,
      })),
    };
  });
}

export function importHandHistoryText(
  text: string,
  options: { heroName?: string; batchId?: string; alreadyImportedIds?: Iterable<string>; importedAt?: number } = {},
): HandHistoryImportResult {
  const allHands = parseHandHistoryText(text, options.heroName);
  const already = new Set(options.alreadyImportedIds || []);
  const hands = allHands.filter(hand => !already.has(hand.id));
  const skippedHandIds = allHands.filter(hand => already.has(hand.id)).map(hand => hand.id);
  const batchId = options.batchId || `hh-${options.importedAt || Date.now()}`;
  const history = handHistoriesToSessionImports(hands, batchId).flatMap(payload => sessionImportToHistory(payload, options.importedAt));
  return {
    hands,
    history,
    parsedHandIds: hands.map(hand => hand.id),
    skippedHandIds,
    heroNames: [...new Set(allHands.map(hand => hand.heroName).filter((name): name is string => Boolean(name)))],
    contexts: history.length,
  };
}
