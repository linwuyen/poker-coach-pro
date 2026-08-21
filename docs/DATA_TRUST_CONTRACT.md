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

## Solver surface import

A Strategy Profile marked `verified-solver` requires:

- solver name
- source reference
- generated time
- frequency data
- immutable `id@version`

Per-action EV values must be finite and source-referenced. If EV is absent, Strategy Distance may still be computed from frequency, but EV regret is unavailable.

## Hand histories

Raw PokerStars/GGPoker HH can establish what happened in the observed hand and how often a context appeared.

It cannot by itself establish:

- optimal action
- GTO EV regret
- population tendency
- causal training benefit

Therefore HH-only imports create real-game exposure evidence. Regret remains absent unless another compatible verified/exact source supplies it.

## Population exploit

A `population-exploit` profile requires all of:

- external reference
- methodology
- named population / pool
- generated time
- at least 1,000 observations in the imported profile
- explicit exploit range supplied by that evidence source

The built-in Nit/TAG/LAG/Calling Station overlays remain `heuristic-estimate`.

If population EV is imported, an EV methodology is additionally required.

## Exact-math teaching

P6 exact-math scenarios are conditional exercises. The scenario explicitly supplies inputs such as equity or fold rate, and the answer is recomputed from those inputs.

Examples:

```text
Call EV = equity × (pot + call) − call
Pure bluff EV = fold% × pot − (1 − fold%) × bet
```

The card artwork is illustrative where the problem directly supplies equity/fold-rate assumptions; the system must not imply that the displayed cards independently generated those inputs.

## FGS

FGS requires an explicit finite future state tree. Child branch probabilities must be supplied and sum to 1.

The engine guarantees exact ICM evaluation of supplied leaf states and probability-weighted backward induction. It does not guarantee that supplied branch probabilities represent equilibrium poker strategy.

## Effectiveness reports

Before/after reports are observational. They may support statements such as “follow-up holdout accuracy was higher than baseline in these windows.”

They do not by themselves support the causal claim “the training caused the improvement.”

## UI rule

When required evidence is missing, use one of:

- `Unavailable`
- `Unsupported`
- `Insufficient evidence`
- explicit lower trust tier

Never substitute a plausible-looking number.
