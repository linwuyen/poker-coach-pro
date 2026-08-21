# Infinite Hand Generator

## Product contract

Poker Coach Pro is a self-contained decision training table. The player does not import real poker hands and does not configure truth/evidence workbenches during normal use.

The runtime loop is:

```text
truth-backed candidate inventory
  ↓
truth / holdout gate
  ↓
exact presentation dedupe
  ↓
novelty + leak + due-review sampling
  ↓
player decision
  ↓
History v6 evidence
  ↓
next candidate
```

## Candidate sources

### Curated scenarios

The current rendered catalog contains 216 scenarios. These include genuine decision families plus suit-isomorphic retrieval instances. A scenario is eligible only when every step exposes one internally consistent best action.

### Safe generated variants

The current inventory contains 528 variants generated from the 88 core scenarios. The transformation is a global suit permutation only. It therefore preserves Hold'em strategic equivalence while changing card appearance.

The generator must never call a mutation safe merely because it looks nearby. Stack depth, position, action line, sizing, range assumptions and board ranks cannot be mutated without separate truth.

### PokerBench

The pinned PokerBench inventory contains 1,000 preflop and 10,000 postflop solver-labelled rows. A row is eligible only when:

- its stable corpus role is `training`;
- it contains at least two available moves;
- its solver `correctDecision` exactly normalizes to one of those moves.

Sibling and holdout rows are never used for ordinary infinite training.

PokerBench supplies an optimal decision label, not a complete EV/frequency surface. The generator must not fabricate missing mixed frequencies or per-action EV.

## Holdout isolation

The 216 and 528 numbers are source inventory sizes, not promises that every entry is trainable.

Before building the live pool:

- curated hidden benchmark scenarios are removed;
- safe variants whose `reviewSourceId` points at a hidden curated source are removed;
- PokerBench sibling and holdout families are removed.

This preserves the independent benchmark even as the apparent hand variety grows.

## Presentation deduplication

Each eligible candidate receives an exact presentation fingerprint.

Scenario fingerprints include the material player-visible state: format/table, position, stack/blinds, pre-action, exact cards, street/board, pot/SPR, descriptions and verified best actions.

PokerBench fingerprints include split, exact holding, position, pot, available move tree, solver label and the applicable action/board/street context.

Two candidates with the same presentation fingerprint are one training presentation even when their source IDs differ.

## Recent-repeat control

The selector maintains two short-term memories:

- recent exact candidate IDs: up to 64;
- recent decision-family IDs: family cooldown window of 6 for selection, with a longer local history retained by the UI.

Exact recent candidates are excluded when alternatives exist. Recent families are also avoided when there is sufficient diversity.

This is intentionally stronger than ordinary shuffle because a shuffled pool can still place strategically identical spots adjacent to one another.

## Adaptive weighting

After truth and novelty constraints are satisfied, selection uses bounded weighting.

Current source targets:

```text
curated       30%
safe variant  25%
PokerBench    45%
```

Within an eligible source, historical misses and due-review evidence increase a candidate's weight. Unseen candidates receive a novelty prior.

The weights prioritize learning; they do not alter or infer the candidate's truth label.

## Availability behavior

The built-in scenario + safe-variant pool is available immediately.

PokerBench loads in the background. If its pinned files are temporarily unavailable, the app continues on the built-in holdout-safe pool. The system does not replace missing PokerBench rows with approximate generated truth.

## History contract

Every player action is written immediately to History v6 through the existing scenario or solver-session recorder.

Scenario candidates retain their existing exact-math/teaching EV evidence when present. PokerBench candidates record solver provenance and label correctness but do not invent EV values.

History then provides:

- leak evidence;
- review timing;
- novelty history;
- decision-family mastery;
- delayed retrieval and transfer evidence.

## Real-game retirement

The product no longer exposes Hand History ingestion or external-poker workflow routes. The following old runtime routes fall back to the normal player application instead of loading real-game workbenches:

```text
#hand-history
#production-ops
#evidence-ops
#production-intelligence
#tournament-context
```

Legacy source modules may remain temporarily for historical tests or isolated internal contracts, but they are not part of the player runtime or Infinite Hand Generator dependency graph. Removing those modules physically is a separate dead-code cleanup and must not be confused with reintroducing real-game functionality.

## Non-negotiable invariants

1. No unverified generated poker state may be graded.
2. No hidden benchmark or its derived variant may enter training.
3. No PokerBench sibling/holdout row may enter training.
4. No approximate solver fallback may be introduced to increase variety.
5. Exact duplicate presentations must collapse before sampling.
6. A training mistake may change future sampling weight, never the source truth.
7. Missing external corpus data degrades to a smaller valid pool, not fabricated precision.
