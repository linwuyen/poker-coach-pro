# Data Trust Contract

Poker Coach Pro must fail toward **unknown**, not toward fabricated precision.

## Trust tiers

1. `verified-solver` — solver output with source/provenance.
2. `exact-math` — result recomputable from stated mathematical inputs.
3. `population-exploit` — evidence-backed external population exploit profile with provenance and sample gate.
4. `expert-baseline` — reviewed teaching strategy, not solver truth.
5. `derived-interpolation` — explicit derivation between supported nodes.
6. `heuristic-estimate` — transparent teaching/ranking heuristic.

A lower tier must never be relabelled as a higher tier just because it agrees with an expected answer.

## PokerBench

The pinned PokerBench corpus supplies optimal decision labels. It does **not** supply a complete per-action EV/frequency surface for every row.

Allowed:

- train/evaluate decision labels
- build one-variable semantic pairs when both rows exist and the label flips
- preserve dataset source/revision/split/row id

Not allowed:

- invent mixed frequencies
- invent EV for unavailable actions
- invent solver explanations

## Solver surface import and coverage

### Preflop Strategy Profile v2

A v2 Strategy Profile marked `verified-solver` requires solver name, source reference, generated time, frequency data, and immutable `id@version`. Per-action EV values must be finite and source-referenced. If EV is absent, Strategy Distance may still be computed from frequency, but EV regret is unavailable.

### Postflop Truth Pack v3

P12 v3 nodes represent exact heads-up Flop/Turn/River states. Automatic grading requires all material dimensions to match:

- game/table format
- street
- Hero/Villain positions
- heads-up player count
- effective stack
- pot / SPR / to-call
- exact board
- canonical preflop action line
- current-street action line and sizing geometry
- last aggressor
- rake / rake cap when present
- exact Hero hole-card combo

A v3 truth node must carry verified solver provenance and strategy frequencies. EV regret is available only when the chosen action and at least one comparison action both have sourced finite EV values.

Coverage reports count only actually imported verified data. A coverage engine or importer is **not** equivalent to owning a complete solver database. If no trustworthy full solver dataset is available, the product must report the coverage gap rather than synthesize missing truth.

For both v2 and v3, automated real-game grading never uses approximate profile fallback. Zero exact matches is Unknown. More than one exact immutable version is also Unknown/Ambiguous until the source/version conflict is resolved.

## Hand histories and automatic leak grading

Raw PokerStars/GGPoker HH can establish what happened in the observed hand and how often a context appeared. It cannot by itself establish optimal action, GTO EV regret, population tendency, or causal training benefit.

Therefore HH imports always create observation/exposure evidence first.

### Preflop

P9-C may add `verified-solver` regret only when the observed decision maps to exactly one verified v2 profile, the hand exists, and sourced action EV exists.

### Postflop

P12-C replays the HH to the exact state **before** each Hero Flop/Turn/River decision. It may add `verified-solver` regret only when:

1. the hand is heads-up at that decision;
2. board and action state are fully reconstructable;
3. exactly one verified immutable v3 node matches;
4. the exact Hero combo exists in that node;
5. the chosen action has sourced EV;
6. at least one comparison action has sourced EV.

Multiway postflop remains Unsupported rather than being projected onto a heads-up node. Cash rake/rake-cap are never guessed. Missing required context leaves the decision exposure-only.

Verified real-game regret may influence Daily **priority** for a matching position/street in the PokerBench Training partition. This is situation-level routing only; it never asserts that a PokerBench row is the same solver node and never unlocks Sibling/Holdout for training.

## Population evidence

A `population-exploit` profile still requires external reference, methodology, named population/pool, generated time, a meaningful sample floor, and explicit exploit strategy supplied by that evidence source.

P9-B population cohort registry preserves site/stake/game/window/sample/reference/methodology/raw numerator/raw denominator and immutable versions.

P12-D adds **measured local population cohorts** from actual imported HH. These cohorts preserve:

- sample hand count
- postflop decision opportunities
- street/facing/action
- raw numerator/denominator
- observed rate
- source hand-id hash
- direct aggregation methodology

These records are `measured-local-cohort` observations. They do **not** automatically become `population-exploit`, do not imply a GTO deviation, and do not authorize exploit recommendations by themselves.

## Reviewed teaching explanations

P9-E human explanations are not solver output. They live in a separate immutable registry and require target, author, reviewer, review timestamp, reference, boundary conditions, common mistake, contrastive cue, and an interpretation disclaimer.

A solver label or EV table does not authorize the app to fabricate causal rationale.

## Exact-math teaching

P6 exact-math scenarios are conditional exercises. Inputs such as equity or fold rate are explicit and the answer is recomputed from those inputs. Card artwork must not be represented as the source of those supplied assumptions.

## Tournament HH / ICM / PKO / FGS

Ordinary tournament HH is an observation and a hand-level join key. It does not reliably contain the complete tournament utility state.

P9-D exact tournament utility therefore requires explicit referenced state: all players/stacks, payout vector, declared utility unit, Hero/chosen action, ICM/PKO risk inputs, bounty data when used, and complete FGS trees/probabilities when used.

P12-E reduces manual repetition by adding a tournament metadata registry keyed by tournamentId plus full-field stack snapshots keyed by handId. The system may automatically extract table players/Hero/hand identity from HH and join registered full-field/payout metadata.

Critical invariant: **table stacks are never silently treated as the entire tournament field**. If no full-field snapshot exists, the reconstruction draft must remain incomplete and list the missing state.

Decision-specific quantities that ordinary HH cannot prove—such as pre-decision showdown equity, bounty semantics, or future branch probabilities—remain explicit inputs from a traceable source.

FGS continues to evaluate only the supplied finite future tree; it does not claim the supplied probabilities are equilibrium strategy.

## Effectiveness and experiments

P5-C before/after reports are observational and do not by themselves prove training causality.

P10 randomized N-of-1 comparisons require preregistration, explicit primary metric, seeded balanced blocks, non-overlap, washout, at least two evidence-bearing blocks per arm, and minimum sample thresholds. Below the gates the result is `Insufficient`. Above them the claim is an individual randomized-block comparison, not a population-wide causal claim.

## UI rule

When required evidence is missing, use one of:

- `Unavailable`
- `Unsupported`
- `Insufficient evidence`
- `Ambiguous truth version`
- explicit lower trust tier

Never substitute a plausible-looking number.
