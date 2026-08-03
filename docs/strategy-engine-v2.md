# Strategy Engine v2

Strategy Engine v2 separates poker strategy data from UI rendering. It replaces the old binary `Set<string>` model with versioned, context-aware frequency profiles.

## Goals

- Express mixed strategies instead of only `open` or `fold`.
- Bind every range to game format, table size, position, stack depth, ante, spot and open size.
- Calculate range percentages using the real 1,326 starting-hand combinations.
- Keep source, version and disclaimer metadata visible to the learner.
- Allow future solver exports to coexist with heuristic or expert-authored profiles.

## Profile contract

```ts
interface StrategyProfile {
  schemaVersion: 2;
  id: string;
  version: string;
  context: {
    format: 'cash' | 'tournament';
    tableSize: '6max' | '9max';
    spot: 'rfi' | 'vs-open' | 'push-fold';
    position: Position;
    stackDepthBB: number;
    anteBB: number;
    openSizeBB?: number;
  };
  source: StrategySource;
  ranges: Record<string, Partial<ActionFrequency>>;
}
```

Unspecified frequency is assigned to `fold`. For example:

```ts
'AJo': { raise: 0.5 }
```

is normalized to 50% raise and 50% fold.

## Current seed data

Version 2.0.0 includes teaching baselines for:

- 6-max cash, 100BB, RFI: UTG, HJ, CO, BTN and SB.
- 9-max tournament, 40BB with ante, RFI: UTG through SB.

These profiles are explicitly labeled as heuristic teaching baselines, not exact solver outputs.

## Adding solver data

1. Create a new `StrategyProfile` with a unique version and source label.
2. Preserve exact solver assumptions in `context` and `source.reference`.
3. Store mixed actions as decimal frequencies from 0 to 1.
4. Add tests verifying all hand keys, frequency totals and 1,326-combo accounting.
5. Do not overwrite a previous version; add a new profile so historical training remains reproducible.

## API

- `findBestProfile(profiles, query)` selects the closest context and explains the match.
- `queryStrategy(profiles, query)` returns a normalized decision for one hand.
- `getRangeStats(profile)` returns weighted raise, call, all-in and fold combinations.
- `getAllStartingHands()` returns the canonical 169 starting-hand classes.
- `normalizeHand(input)` canonicalizes notation such as `kaS` to `AKs`.
