# Poker Coach UI v2 Architecture

The v2 entry point organizes the product around a learning loop instead of exposing every feature at once.

## Primary navigation

1. **Today** — one recommended daily session, review count, weak areas and weekly progress.
2. **Training** — comprehensive and topic-specific sessions.
3. **Review** — due items, mistakes, bookmarks and weak categories.
4. **Learn** — Strategy Engine v2, range exploration and concept tools.
5. **Analysis** — progress summaries, recent attempts, backup and advanced tools.

## Compatibility strategy

The original `App.tsx` remains available through **Advanced Tools**. The new entry point is `src/app/AppV2.tsx`, so features can be migrated incrementally without removing custom hand analysis, AI coaching or legacy utilities.

## Training flow

The main training UI deliberately shows only:

- session progress;
- cards and board;
- directly relevant pot, stack, position, SPR and pot odds;
- decision buttons;
- layered feedback after a choice.

Statistics, range charts and AI are not permanently visible during a decision.

## Daily plan composition

The planner attempts to create a 12-question session from:

- up to 4 due reviews;
- up to 3 weak-area questions;
- up to 2 recent mistakes;
- up to 2 unseen questions;
- a deterministic daily mix to fill the remainder.

Scenario IDs are deduplicated across all buckets.
