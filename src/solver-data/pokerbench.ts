import { PokerDecisionAction, Street } from '../types';

export const POKERBENCH_SOURCE = {
  id: 'pokerbench-aaai2025',
  label: 'PokerBench · solver-computed NLHE decisions',
  revision: '52a402ba1cf00ca8f4138f8d6da278f6f9477bab',
  license: 'Apache-2.0',
  paper: 'https://arxiv.org/abs/2501.08328',
  dataset: 'https://huggingface.co/datasets/RZ412/PokerBench',
  repo: 'https://github.com/pokerllm/pokerbench',
  disclaimer: 'PokerBench exposes solver-computed optimal decisions, but not per-action EVs or mixed-strategy frequencies. The app must not fabricate missing EV values.',
} as const;

const BASE = `https://huggingface.co/datasets/RZ412/PokerBench/resolve/${POKERBENCH_SOURCE.revision}`;

export const POKERBENCH_FILES = {
  preflop: {
    id: 'preflop-test',
    label: 'Preflop solver corpus',
    split: 'preflop_1k_test',
    rows: 1000,
    url: `${BASE}/preflop_1k_test_set_game_scenario_information.csv?download=true`,
  },
  postflop: {
    id: 'postflop-test',
    label: 'Postflop solver corpus',
    split: 'postflop_10k_test',
    rows: 10000,
    url: `${BASE}/postflop_10k_test_set_game_scenario_information.csv?download=true`,
  },
} as const;

export type PokerBenchSplit = keyof typeof POKERBENCH_FILES;

interface BasePokerBenchRow {
  id: string;
  split: PokerBenchSplit;
  availableMoves: string[];
  correctDecision: string;
  potSize: number;
  heroPosition: string;
  holding: string;
}

export interface PokerBenchPreflopRow extends BasePokerBenchRow {
  split: 'preflop';
  prevLine: string;
  numPlayers: number;
  numBets: number;
}

export interface PokerBenchPostflopRow extends BasePokerBenchRow {
  split: 'postflop';
  preflopAction: string;
  boardFlop: string;
  boardTurn: string;
  boardRiver: string;
  aggressorPosition: string;
  postflopAction: string;
  evaluationAt: Street;
}

export type PokerBenchRow = PokerBenchPreflopRow | PokerBenchPostflopRow;

export interface ParsedPokerDecision {
  raw: string;
  normalized: string;
  action: PokerDecisionAction;
}

const memoryCache = new Map<PokerBenchSplit, PokerBenchRow[]>();

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      cell = '';
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell.trim());
    if (row.some(value => value.length > 0)) rows.push(row);
  }
  return rows;
}

function rowsAsObjects(text: string): Array<Record<string, string>> {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map(value => value.trim());
  return rows.slice(1).map(values => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ''])));
}

export function parseAvailableMoves(value: string): string[] {
  const quoted = [...value.matchAll(/['\"]([^'\"]+)['\"]/g)].map(match => match[1].trim()).filter(Boolean);
  if (quoted.length) return quoted;
  return value.replace(/^\[/, '').replace(/\]$/, '').split(',').map(item => item.trim()).filter(Boolean);
}

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStreet(value: string): Street {
  const lower = value.trim().toLowerCase();
  if (lower === 'turn') return 'Turn';
  if (lower === 'river') return 'River';
  if (lower === 'preflop') return 'Preflop';
  return 'Flop';
}

export function parsePokerBenchCsv(text: string, split: PokerBenchSplit): PokerBenchRow[] {
  const objects = rowsAsObjects(text);
  if (split === 'preflop') {
    return objects.map((row, index): PokerBenchPreflopRow => ({
      id: `preflop-${index + 1}`,
      split: 'preflop',
      prevLine: row.prev_line || '',
      heroPosition: row.hero_pos || '',
      holding: row.hero_holding || '',
      correctDecision: row.correct_decision || '',
      numPlayers: numberValue(row.num_players),
      numBets: numberValue(row.num_bets),
      availableMoves: parseAvailableMoves(row.available_moves || ''),
      potSize: numberValue(row.pot_size),
    }));
  }
  return objects.map((row, index): PokerBenchPostflopRow => ({
    id: `postflop-${index + 1}`,
    split: 'postflop',
    preflopAction: row.preflop_action || '',
    boardFlop: row.board_flop || '',
    boardTurn: row.board_turn || '',
    boardRiver: row.board_river || '',
    aggressorPosition: row.aggressor_position || '',
    postflopAction: row.postflop_action || '',
    evaluationAt: normalizeStreet(row.evaluation_at || 'Flop'),
    availableMoves: parseAvailableMoves(row.available_moves || ''),
    potSize: numberValue(row.pot_size),
    heroPosition: row.hero_position || '',
    holding: row.holding || '',
    correctDecision: row.correct_decision || '',
  }));
}

export function normalizeDecision(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
}

export function parsePokerDecision(value: string): ParsedPokerDecision {
  const normalized = normalizeDecision(value);
  const amountMatch = normalized.match(/(?:bet|raise)\s+([0-9]+(?:\.[0-9]+)?)/i);
  const amount = amountMatch ? Number(amountMatch[1]) : undefined;
  let type: PokerDecisionAction['type'] = 'check';
  if (/all\s*-?\s*in|allin|jam/.test(normalized)) type = 'all-in';
  else if (/^fold/.test(normalized)) type = 'fold';
  else if (/^call/.test(normalized)) type = 'call';
  else if (/^raise/.test(normalized)) type = 'raise';
  else if (/^bet/.test(normalized)) type = 'bet';
  else if (/^check/.test(normalized)) type = 'check';
  return { raw: value, normalized, action: { type, ...(amount !== undefined ? { sizeBB: amount } : {}) } };
}

export function decisionsMatch(left: string, right: string): boolean {
  return normalizeDecision(left) === normalizeDecision(right);
}

export function isSizingDecisionRow(row: PokerBenchRow): boolean {
  const moves = row.availableMoves.map(normalizeDecision);
  return row.split === 'postflop' && moves.some(move => /^(bet|raise)\s+[0-9]/.test(move));
}

export function canonicalHolding(value: string): string {
  const cards = [...value.matchAll(/([2-9TJQKA])([cdhs])/gi)].map(match => ({ rank: match[1].toUpperCase(), suit: match[2].toLowerCase() }));
  if (cards.length !== 2) return value.toUpperCase();
  const order = 'AKQJT98765432';
  const [first, second] = cards.sort((a, b) => order.indexOf(a.rank) - order.indexOf(b.rank));
  if (first.rank === second.rank) return `${first.rank}${second.rank}`;
  return `${first.rank}${second.rank}${first.suit === second.suit ? 's' : 'o'}`;
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function deterministicSample<T extends { id: string }>(rows: T[], count: number, seed: string): T[] {
  return [...rows]
    .map(row => ({ row, score: hash(`${seed}:${row.id}`) }))
    .sort((a, b) => a.score - b.score || a.row.id.localeCompare(b.row.id))
    .slice(0, Math.max(0, count))
    .map(item => item.row);
}

async function readThroughCache(url: string): Promise<string> {
  const request = new Request(url, { mode: 'cors', credentials: 'omit' });
  if (typeof caches !== 'undefined') {
    const cache = await caches.open(`pokerbench-${POKERBENCH_SOURCE.revision.slice(0, 8)}`);
    const cached = await cache.match(request);
    if (cached) return cached.text();
    const response = await fetch(request);
    if (!response.ok) throw new Error(`PokerBench download failed (${response.status}).`);
    await cache.put(request, response.clone());
    return response.text();
  }
  const response = await fetch(request);
  if (!response.ok) throw new Error(`PokerBench download failed (${response.status}).`);
  return response.text();
}

export async function loadPokerBenchSplit(split: PokerBenchSplit, force = false): Promise<PokerBenchRow[]> {
  if (!force && memoryCache.has(split)) return memoryCache.get(split)!;
  const text = await readThroughCache(POKERBENCH_FILES[split].url);
  const rows = parsePokerBenchCsv(text, split);
  if (!rows.length) throw new Error('PokerBench returned no parseable rows.');
  memoryCache.set(split, rows);
  return rows;
}
