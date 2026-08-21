import { canonicalHoleCombo, canonicalPostflopContext, postflopContextKey } from './context';
import { validatePostflopTruthNode } from './importer';
import { PostflopAction, PostflopLineAction, PostflopStreet, PostflopTruthNode, PostflopTruthPackV3 } from './types';
import { GameFormat, Position, TableSize } from '../strategy-engine-v2/types';

export interface SolverCsvMapping {
  nodeId: string;
  nodeName?: string;
  format: string;
  tableSize: string;
  street: string;
  heroPosition: string;
  villainPosition: string;
  effectiveStackBB: string;
  potBB: string;
  spr: string;
  toCallBB: string;
  board: string;
  preflopLineJson: string;
  streetLineJson: string;
  lastAggressorPosition?: string;
  rakePercent?: string;
  rakeCapBB?: string;
  heroCards: string;
  action: string;
  frequency: string;
  evBB?: string;
  solverName: string;
  solverVersion?: string;
  sourceReference: string;
  generatedAt: string;
}

export const NORMALIZED_SOLVER_CSV_MAPPING: SolverCsvMapping = {
  nodeId: 'node_id', nodeName: 'node_name', format: 'format', tableSize: 'table_size', street: 'street',
  heroPosition: 'hero_position', villainPosition: 'villain_position', effectiveStackBB: 'effective_stack_bb',
  potBB: 'pot_bb', spr: 'spr', toCallBB: 'to_call_bb', board: 'board', preflopLineJson: 'preflop_line_json',
  streetLineJson: 'street_line_json', lastAggressorPosition: 'last_aggressor_position', rakePercent: 'rake_percent',
  rakeCapBB: 'rake_cap_bb', heroCards: 'hero_cards', action: 'action', frequency: 'frequency', evBB: 'ev_bb',
  solverName: 'solver_name', solverVersion: 'solver_version', sourceReference: 'source_reference', generatedAt: 'generated_at',
};

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (ch === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell); cell = ''; if (row.some(value => value.length)) rows.push(row); row = [];
    } else cell += ch;
  }
  row.push(cell); if (row.some(value => value.length)) rows.push(row);
  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  if (rows.length < 2) return [];
  const headers = rows[0].map(value => value.trim());
  if (new Set(headers).size !== headers.length) throw new Error('CSV headers must be unique.');
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function required(row: Record<string,string>, column: string, label = column): string {
  const value = row[column]?.trim(); if (!value) throw new Error(`Solver CSV is missing ${label} (${column}).`); return value;
}
function optional(row: Record<string,string>, column?: string): string | undefined { const value = column ? row[column]?.trim() : ''; return value || undefined; }
function finite(value: string, label: string): number { const parsed = Number(value); if (!Number.isFinite(parsed)) throw new Error(`${label} must be finite.`); return parsed; }
function optionalFinite(value: string | undefined, label: string): number | undefined { return value === undefined ? undefined : finite(value,label); }

function parseFormat(value: string): GameFormat { const normalized = value.toLowerCase(); if (normalized === 'cash') return 'cash'; if (normalized === 'tournament' || normalized === 'mtt') return 'tournament'; throw new Error(`Unsupported format ${value}.`); }
function parseTableSize(value: string): TableSize { const normalized = value.toLowerCase().replace(/[-_ ]/g,''); if (normalized === '6max' || normalized === '6') return '6max'; if (normalized === '9max' || normalized === '9') return '9max'; throw new Error(`Unsupported table size ${value}.`); }
function parseStreet(value: string): PostflopStreet { const normalized = value[0]?.toUpperCase() + value.slice(1).toLowerCase(); if (normalized === 'Flop' || normalized === 'Turn' || normalized === 'River') return normalized; throw new Error(`Unsupported postflop street ${value}.`); }
function parsePosition(value: string | undefined, label: string): Position | undefined { if (!value) return undefined; const normalized = value.toLowerCase(); if (['utg','utg1','utg2','mp','hj','co','btn','sb','bb'].includes(normalized)) return normalized as Position; throw new Error(`Unsupported ${label} ${value}.`); }
function parseAction(value: string): PostflopAction { const normalized = value.replace(/[-_ ]/g,'').toLowerCase(); const map: Record<string,PostflopAction> = { check:'check', bet:'bet', call:'call', raise:'raise', fold:'fold', allin:'allIn' }; const action = map[normalized]; if (!action) throw new Error(`Unsupported action ${value}.`); return action; }
function parseCards(value: string): string[] { const cards = value.match(/[2-9TJQKA][shdc]/gi) || []; if (!cards.length) throw new Error(`No cards in ${value}.`); return cards.map(card => card[0].toUpperCase()+card[1].toLowerCase()); }
function parseLine(value: string, label: string): PostflopLineAction[] { let parsed: unknown; try { parsed = JSON.parse(value); } catch { throw new Error(`${label} must be JSON.`); } if (!Array.isArray(parsed)) throw new Error(`${label} must be an array.`); return parsed as PostflopLineAction[]; }

interface MutableNode {
  node: PostflopTruthNode;
  contextKey: string;
}

/**
 * Converts an evidence-bearing solver CSV into immutable v3 nodes. The mapping is explicit so vendor
 * exports can be adapted without pretending that one undocumented proprietary layout is universal.
 */
export function solverCsvToPostflopPack(
  csv: string,
  mapping: SolverCsvMapping = NORMALIZED_SOLVER_CSV_MAPPING,
  pack: { packId: string; version: string; exportedAt?: string },
): PostflopTruthPackV3 {
  const rows = parseCsv(csv); if (!rows.length) throw new Error('Solver CSV contains no data rows.');
  const nodes = new Map<string, MutableNode>();
  let envelopeReference = '';
  for (const row of rows) {
    const nodeId = required(row,mapping.nodeId,'node id');
    const sourceReference = required(row,mapping.sourceReference,'source reference');
    envelopeReference ||= sourceReference;
    if (sourceReference !== envelopeReference) throw new Error('One solver CSV pack must use one source_reference. Split mixed sources into separate packs.');
    const context = canonicalPostflopContext({
      format: parseFormat(required(row,mapping.format)), tableSize: parseTableSize(required(row,mapping.tableSize)), street: parseStreet(required(row,mapping.street)),
      heroPosition: parsePosition(required(row,mapping.heroPosition),'hero position')!, villainPosition: parsePosition(required(row,mapping.villainPosition),'villain position')!, playersInHand: 2,
      effectiveStackBB: finite(required(row,mapping.effectiveStackBB),'effective_stack_bb'), potBB: finite(required(row,mapping.potBB),'pot_bb'),
      spr: finite(required(row,mapping.spr),'spr'), toCallBB: finite(required(row,mapping.toCallBB),'to_call_bb'), board: parseCards(required(row,mapping.board)),
      preflopLine: parseLine(required(row,mapping.preflopLineJson),'preflop_line_json'), streetLine: parseLine(required(row,mapping.streetLineJson),'street_line_json'),
      lastAggressorPosition: parsePosition(optional(row,mapping.lastAggressorPosition),'last aggressor'), rakePercent: optionalFinite(optional(row,mapping.rakePercent),'rake_percent'), rakeCapBB: optionalFinite(optional(row,mapping.rakeCapBB),'rake_cap_bb'),
    });
    const key = `${nodeId}|${postflopContextKey(context)}`;
    let current = nodes.get(key);
    const solverName = required(row,mapping.solverName,'solver name'); const generatedAt = required(row,mapping.generatedAt,'generated_at');
    if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('generated_at must be an ISO-compatible timestamp.');
    if (!current) {
      const node: PostflopTruthNode = {
        schemaVersion:3, id:nodeId, version:pack.version, name: optional(row,mapping.nodeName) || nodeId, description:'Imported through P13-B explicit solver CSV mapping.', context,
        source:{ type:'solver', trustTier:'verified-solver', label:solverName, solverName, solverVersion:optional(row,mapping.solverVersion), reference:sourceReference, generatedAt, disclaimer:'Imported from an explicit solver export mapping. Frequencies/EV remain valid only for the exact exported game tree and context.' },
        strategyByCombo:{}, evByCombo:{}, tags:['p13-solver-csv-adapter'], immutable:true,
      };
      current = { node, contextKey:postflopContextKey(context) }; nodes.set(key,current);
    } else if (current.contextKey !== postflopContextKey(context)) throw new Error(`${nodeId}: rows disagree on material context.`);
    const combo = canonicalHoleCombo(parseCards(required(row,mapping.heroCards,'hero cards'))); const action = parseAction(required(row,mapping.action));
    const frequency = finite(required(row,mapping.frequency),'frequency'); if (frequency < 0 || frequency > 1) throw new Error('frequency must be in [0,1].');
    current.node.strategyByCombo[combo] ||= {}; current.node.strategyByCombo[combo][action] = frequency;
    const evRaw = optional(row,mapping.evBB); if (evRaw !== undefined) { current.node.evByCombo ||= {}; current.node.evByCombo[combo] ||= {}; current.node.evByCombo[combo]![action] = finite(evRaw,'ev_bb'); }
  }
  const validated = [...nodes.values()].map(value => validatePostflopTruthNode(value.node));
  return { schemaVersion:3, packId:pack.packId, version:pack.version, exportedAt:pack.exportedAt || new Date().toISOString(), sourceReference:envelopeReference, nodes:validated, exporter:'P13-B configurable solver CSV adapter' };
}
