# v9 Companion Architecture

## Product objective

v9 turns the old toolbox into a synchronized companion. The user should not have to decide which diagnostic page to open while studying a hand. One normalized hand state feeds context, strategy lookup, math and the intervention router.

The core flow is:

`Game / Trainer / Replay -> HandStateBus -> Context -> Advice Gate -> Strategy / Intervention -> Tool`

## HandStateBus

`CompanionHandState` is the stable adapter contract. It carries:

- mode and source
- Cash / MTT format
- table size and street
- hero / villain position
- effective stack and pot
- amount to call
- starting hand
- board and action history
- strategy spot and open size
- tournament model
- hand-complete and decision-lock flags

The browser implementation uses local storage plus a same-origin `BroadcastChannel`. This allows the training page and a separate `#companion` popup to stay synchronized without coupling the companion UI to the trainer component tree.

## Supported modes

- `training` — trainer scenarios publish state automatically. Before the learner answers, `decisionLocked` hides the exact strategy so retrieval is not spoiled. Feedback unlocks the companion.
- `play-money` — full study assistance may be shown while the hand is active.
- `replay` — full study assistance may be shown.
- `completed-real-hand` — full post-hand analysis may be shown.
- `live-real-money` — while `handComplete=false`, only context is shown. Strategy frequencies, EV, intervention and decision-tool links are locked. Once the hand is complete, post-hand analysis is unlocked.

## Companion analysis

The companion derives a Scenario-shaped context from the synchronized hand and reuses the existing v8 systems rather than creating a parallel rules engine.

It can expose:

- SPR
- pot odds when an amount-to-call is provided
- strict preflop Strategy Engine v2 lookup
- the v8 intervention router
- one-click access to Boundary, Range, Equity, ICM, Contrastive and Solver tools

Strategy lookup remains strict: unsupported or materially mismatched contexts are reported as unsupported rather than silently substituted with another node.

## Toolbox integration

The toolbox is no longer the primary mental model. In the companion:

1. current hand context is shown first,
2. the best intervention is highlighted,
3. other tools remain secondary instruments,
4. full tool pages open separately so the small companion stays synchronized beside the table.

## Trainer integration

`TrainingSession` publishes the active scenario and step to the bus. The companion popup therefore updates when the trainer moves between hands or streets.

The trainer sends `decisionLocked=true` before feedback. This preserves testing quality: the companion can show context and a general diagnostic direction, but not the exact strategy answer. After feedback, the same synchronized state is republished with the lock removed.

## External platform adapter boundary

Platform-specific integrations should normalize their state into `CompanionHandState` and call the same bus. They should not call Strategy Engine or learning-engine internals directly.

For a future platform adapter, the only required translation layer is conceptually:

`platform event / HH / replay event -> CompanionHandState -> publishCompanionHandState()`

This keeps poker-platform parsing outside the learning engine and makes adapters replaceable.

## Safety / integrity boundary

v9 intentionally does not implement screen scraping, automatic live-table decision capture, action hotkeys, or an active real-money overlay that tells a player which action to take. The live-real-money mode is context-only until the hand is marked complete.
