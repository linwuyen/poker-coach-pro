# Postflop Truth Pack v3

P12 introduced a separate exact heads-up postflop truth format instead of overloading preflop Strategy Profile v2. P13 keeps the same epistemic contract and replaces the small-data storage/query path with indexed ingestion.

## Design goal

A node is safe for automatic real-hand grading only when an observed HH decision can reproduce the same material state without approximation.

Required context:

- cash/tournament + 6max/9max
- Flop/Turn/River
- Hero and Villain positions
- heads-up (`playersInHand: 2`)
- effective stack BB
- pot BB / SPR / to-call BB
- exact board
- canonical preflop action line
- current-street action line
- last aggressor when known
- rake/rake-cap when material
- exact Hero hole-card combo such as `AsKd`

## JSON envelope

```json
{
  "schemaVersion": 3,
  "packId": "solver-export-2026q3",
  "version": "1",
  "exportedAt": "2026-08-21T00:00:00Z",
  "sourceReference": "solver-export://job/123",
  "nodes": []
}
```

Each node carries immutable `id@version`, verified solver provenance, strategy frequencies and optional per-action EV.

## P13 IndexedDB storage

Browser production storage is IndexedDB database `poker-coach-truth-v3`:

- `nodes`: immutable validated truth nodes
- `contextKey` index: exact material-state lookup
- `contexts`: unique context metadata for bounded diagnostics
- `packs`: import manifests/provenance/count metadata

Legacy `poker_postflop_truth_nodes_v3` localStorage data is migration-only. New truth writes use the indexed store.

An observed HH query computes the same canonical `contextKey` and asks the index for only that context. It does **not** scan every imported node. If the indexed candidates contain zero matching verified versions or more than one exact version, automatic grading returns Unknown.

## Normalized / mapped solver CSV

P13-B provides a configurable column mapping. The normalized contract includes:

```text
node_id
node_name
format
table_size
street
hero_position
villain_position
effective_stack_bb
pot_bb
spr
to_call_bb
board
preflop_line_json
street_line_json
last_aggressor_position
rake_percent
rake_cap_bb
hero_cards
action
frequency
ev_bb            # optional
solver_name
solver_version   # optional but recommended
source_reference
generated_at
```

Rows sharing one node/context are grouped into per-combo action frequencies and optional EV maps. The adapter requires explicit solver provenance and does not guess proprietary vendor semantics.

## NDJSON streaming

Large exports may also supply one complete v3 node per line. The browser reads `.ndjson` / `.jsonl` through a text stream and validates/inserts incrementally, avoiding one giant in-memory JSON array.

Streaming changes only transport/memory behavior; each line must still pass the same v3 validation and immutability rules.

## Automatic-grading contract

Per-action regret is emitted only when:

1. exactly one verified node matches the complete observed context;
2. the exact Hero combo exists;
3. chosen action EV exists;
4. at least one comparison action EV exists.

No EV interpolation, rank-class fallback, board bucketing, nearest-stack search or approximate node fallback is allowed.

## Multiway boundary

v3 stays heads-up. P14 uses a separate Strategy Engine v4 for 3-way+ states, enumerating every active opponent position and remaining stack. A v3 node never grades a multiway HH decision.

## Large datasets

Large exports should be split into independently versioned packs by stable context dimensions such as format/table/stack/street/tree configuration. Importing packs is additive because `id@version` is immutable.

The repository intentionally does not manufacture missing solver data. A full external export can be loaded when its license/provenance permits it; coverage remains the coverage of truth actually imported.
