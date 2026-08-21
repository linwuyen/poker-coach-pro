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

A Strategy Profile marked `verified-solver` requires:

- solver name
- source reference
- generated time
- frequency data
- immutable `id@version`

Per-action EV values must be finite and source-referenced. If EV is absent, Strategy Distance may still be computed from frequency, but EV regret is unavailable.

P9-A coverage reports count only actually imported `verified-solver` data. A coverage engine is not equivalent to owning a complete solver database.

Automated real-game grading uses a stricter contract than interactive lookup: every material context dimension represented by the profile must be present and exact within a narrow tolerance. No approximate profile fallback is permitted for automatic regret attribution.

## Hand histories and automatic leak grading

Raw PokerStars/GGPoker HH can establish what happened in the observed hand and how often a context appeared.

It cannot by itself establish:

- optimal action
- GTO EV regret
- population tendency
- causal training benefit

Therefore HH-only imports create real-game exposure evidence.

P9-C may add `verified-solver` regret only when all are true:

1. the observed decision can be represented by Strategy Engine v2;
2. exactly one immutable verified profile matches the material context exactly;
3. the observed starting hand exists in that profile;
4. the chosen action has an actual sourced EV value;
5. at least one comparison action EV also exists.

Cash rake/rake-cap are never guessed. If a profile requires them and the observed/imported context does not provide them, the decision stays exposure-only.

Current automated HH→solver grading is intentionally preflop-only because Strategy Engine v2 does not yet encode a complete postflop board/action-tree state. Postflop remains Unsupported rather than being graded against a preflop or coarse context.

A verified real-game leak may influence Daily **priority** for a matching position/street in the PokerBench Training partition. This routing signal does not claim that a PokerBench row is the same solver node. It never unlocks Sibling/Holdout for training.

## Population evidence

A `population-exploit` profile requires all of:

- external reference
- methodology
- named population / pool
- generated time
- at least 1,000 observations in the imported profile
- explicit exploit range supplied by that evidence source

The built-in Nit/TAG/LAG/Calling Station overlays remain `heuristic-estimate`.

If population EV is imported, an EV methodology is additionally required.

P9-B population cohort registry adds a separate evidence plane. Each measured population metric must preserve:

- site / stake / game / observation window
- sample size
- reference / methodology
- raw numerator and denominator
- reported rate consistent with those counts

A standalone percentage without those inputs cannot become an evidence-backed cohort. Cohort `id@version` is immutable.

## Reviewed teaching explanations

P9-E human explanations are **not** solver output. They live in a separate immutable registry and require:

- target decision family or profile+hand
- author
- at least one reviewer
- review timestamp
- reference
- explicit boundary conditions
- common mistake and contrastive cue
- disclaimer that the prose is reviewed interpretation

A solver label or EV table does not authorize the app to fabricate causal rationale.

## Exact-math teaching

P6 exact-math scenarios are conditional exercises. The scenario explicitly supplies inputs such as equity or fold rate, and the answer is recomputed from those inputs.

Examples:

```text
Call EV = equity × (pot + call) − call
Pure bluff EV = fold% × pot − (1 − fold%) × bet
```

The card artwork is illustrative where the problem directly supplies equity/fold-rate assumptions; the system must not imply that the displayed cards independently generated those inputs.

## Tournament HH / ICM / PKO / FGS

Ordinary tournament HH is only an observation and a `handId` join key. It does not reliably contain the full tournament utility state.

P9-D tournament utility requires an explicit referenced context containing the necessary state:

- all player IDs/stacks
- payout vector and declared utility unit
- Hero/chosen action
- ICM/PKO risk inputs when used
- bounty data for PKO
- complete action trees and branch probabilities for FGS

The engine then produces `exact-math` evidence conditional on those supplied inputs.

FGS requires an explicit finite future state tree. Child branch probabilities must be supplied and sum to 1. The engine guarantees exact ICM evaluation of supplied leaf states and probability-weighted backward induction. It does not guarantee that supplied branch probabilities represent equilibrium poker strategy.

## Effectiveness and experiments

P5-C before/after reports are observational. They may support statements such as “follow-up holdout accuracy was higher than baseline in these windows.” They do not by themselves support the causal claim “the training caused the improvement.”

P10 randomized N-of-1 comparisons require:

- preregistration before the first block
- explicit primary metric
- seeded randomized balanced blocks
- non-overlapping blocks
- declared washout
- at least two evidence-bearing blocks per arm
- minimum sample threshold per arm

Below those gates, the result is `Insufficient` and no winner is reported. Above them, the allowed claim is an **individual randomized-block experimental comparison for this player**. It is not a population-wide causal claim.

## UI rule

When required evidence is missing, use one of:

- `Unavailable`
- `Unsupported`
- `Insufficient evidence`
- explicit lower trust tier

Never substitute a plausible-looking number.
