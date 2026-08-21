# Postflop Truth Pack v3

P12 uses a separate exact postflop truth format instead of overloading preflop Strategy Profile v2.

## Design goal

A node is safe for automatic real-hand grading only when an observed HH decision can reproduce the same material state without approximation.

Required context:

- cash/tournament + 6max/9max
- Flop/Turn/River
- Hero and Villain positions
- heads-up (`playersInHand: 2`)
- effective stack BB
- pot BB
- SPR
- to-call BB
- exact board
- canonical preflop action line
- current-street action line
- last aggressor position when known
- rake/rake-cap when material

Truth rows use exact hole-card combos such as `AsKd`, not only `AKo`.

## Envelope

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

## Automatic-grading contract

The matcher returns a node only when exactly one verified node matches the observed state. Zero matches and multiple exact versions both return Unknown.

Per-action regret is emitted only when:

1. the exact Hero combo exists;
2. the chosen action EV exists;
3. at least one comparison action EV exists.

No EV interpolation, rank-class fallback, board bucketing, nearest-stack search or approximate node fallback is allowed in automatic HH grading.

## Large datasets

Large exports should be split into independently versioned packs by stable context dimensions such as format/table/stack/street/tree configuration. Importing multiple packs is additive because node `id@version` is immutable. Coverage is calculated from the actual imported nodes.

The repository intentionally does not manufacture missing solver data. A full external solver export can be loaded through this format when its license/provenance permits it.
