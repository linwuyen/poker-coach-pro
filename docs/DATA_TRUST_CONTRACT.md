# Data Trust Contract

Poker Coach Pro must fail toward **unknown**, not toward fabricated precision.

## Trust tiers

1. `verified-solver` — solver output with source/provenance.
2. `exact-math` — result recomputable from stated mathematical inputs.
3. `population-exploit` — evidence-backed external population exploit profile with provenance and sample gate.
4. `expert-baseline` — reviewed teaching strategy, not solver truth.
5. `derived-interpolation` — explicit derivation between supported nodes.
6. `heuristic-estimate` — transparent teaching/ranking heuristic.

A lower tier must never be relabelled as a higher tier just because it agrees with an expected answer. Storage, indexing, caching, migration, UI convenience, or sample size alone never upgrades a truth tier.

## PokerBench

The pinned PokerBench corpus supplies optimal decision labels. It does **not** supply a complete per-action EV/frequency surface for every row.

Allowed: train/evaluate labels, build verified one-variable pairs when both rows exist, preserve dataset source/revision/split/row id. Not allowed: invent mixed frequencies, unavailable EV, or solver explanations.

## Solver truth

### Preflop Strategy Profile v2

A v2 profile marked `verified-solver` requires solver name, source reference, generated time, frequency data and immutable `id@version`. Per-action EV values must be finite and source-referenced.

### Heads-up Postflop Truth Pack v3

A v3 node represents one exact heads-up Flop/Turn/River state. Material dimensions include format/table, street, Hero/Villain positions, player count, effective stack, pot, SPR, to-call, exact board, preflop line, street line/sizing, last aggressor, rake/cap when material and exact Hero combo.

Automatic regret requires a unique verified immutable node plus sourced EV for the chosen action and at least one comparison action. Zero exact nodes is Unknown; multiple exact versions is Ambiguous/Unknown.

### P13 indexed storage and solver adapters

Moving v3 truth from `localStorage` to IndexedDB changes **storage scale**, not epistemic status.

- Every node is still validated before indexed insertion.
- `id@version` remains immutable.
- `contextKey` is an exact lookup accelerator, not an approximate matcher.
- legacy localStorage migration cannot upgrade invalid/unverified data.
- diagnostics/counts/manifests are observability metadata, not solver evidence.
- NDJSON streaming changes import memory behavior only.

P13-B configurable CSV mapping accepts a solver export only when material context, combo, action frequency and provenance fields can be explicitly mapped. Optional EV is accepted only when actually supplied. The adapter must not infer proprietary vendor semantics or manufacture missing solver rows.

Coverage/import capability is not equivalent to owning a licensed complete solver database.

### P14 Multiway Truth Pack v4

Multiway truth is a separate contract, not a relaxation of v3. A v4 node requires `playersInHand >= 3` and enumerates **every active non-Hero opponent** with exact position and remaining stack, in addition to Hero stack, pot/SPR/to-call, board, action lines, aggressor and rake/cap when material.

A multiway HH decision may receive verified regret only when:

1. the HH state passes the exact-grading integrity audit;
2. every active player/stack/position is reconstructable;
3. exactly one verified immutable v4 context matches;
4. the exact Hero combo exists;
5. chosen and comparison EV are sourced.

Heads-up v3 truth must never be projected onto a multiway state, and v4 truth must never be simplified into a heads-up claim.

## Hand histories and automatic leak grading

Raw PokerStars/GGPoker HH establishes observations, not optimality. HH imports always create exposure evidence first.

### P13-C integrity gate

Before automatic grading, the product audits whether the current replay model can prove the material geometry. Unsupported or incomplete features remain exposure-only, including currently detected cases such as:

- straddle / dead blind
- run-it-twice or multiple board runouts
- side/main-pot geometry not represented by the current state model
- cash-out semantics
- raise action without exact raise-to amount
- missing Hero/button/blind/table geometry

The correct failure mode is `Unsupported` / exposure-only, not a guessed pot, stack or action line.

Verified real-game regret may influence Training-partition priority at a matching situation level. It never unlocks Sibling/Holdout and does not assert identity between PokerBench rows and imported solver nodes.

## Population evidence

A `population-exploit` profile requires external reference, methodology, named population, generated time, meaningful sample floor and an explicit exploit strategy supplied by that evidence source.

Measured local HH cohorts preserve raw numerator/denominator and remain observation evidence.

### P16 replicated population deviation

A population rate is not considered a replicated deviation merely because a large aggregate sample differs from solver baseline. P16 requires:

- predeclared metric/context
- solver baseline rate + reference
- population reference + methodology
- raw training numerator/denominator
- independent holdout numerator/denominator
- minimum sample gates
- practical-effect threshold
- same-direction replication
- 95% Wilson interval excluding the baseline in both splits

Current default gates are training >= 1,000, holdout >= 500 and minimum practical delta 3 percentage points unless the analysis explicitly declares another threshold.

A `validated-deviation` still does **not** synthesize an exploit. `exploitEligible` is true only when an already evidence-backed `population-exploit` Strategy Profile is linked and its strategy context matches exactly. This separates “the pool deviates” from “this external strategy is an evidence-backed response.”

## Reviewed teaching explanations

Human-reviewed explanations are interpretation records, not raw solver rationale. They require target, author, reviewer, review timestamp, reference, boundaries, common mistake, contrastive cue and disclaimer.

## Exact-math teaching

Exact-math scenarios are conditional on explicit inputs such as equity/fold rate. Displayed cards must not be represented as independently producing those supplied assumptions.

## Tournament HH / ICM / PKO / FGS

Ordinary tournament HH is a hand-level observation and does not reliably contain complete tournament utility state.

Explicit ICM/PKO/FGS evaluation still requires the necessary referenced state. FGS evaluates supplied finite branches/probabilities; it does not claim those probabilities are equilibrium strategy.

### P15 tournament automation

P15 may reduce manual entry through two conservative evidence adapters:

1. full-field lobby/snapshot CSV containing tournamentId, handId, playersRemaining, every player stack, optional bounty, payout vector, utility unit and provenance;
2. PokerStars-style summary parsing that accepts only **explicitly written finishing-place prize amounts**.

The summary parser must not infer player stacks or remaining field. A table HH must never be silently treated as full field. Summary and lobby metadata may be merged only when tournament IDs agree; provenance from both sources must remain visible.

Decision-specific inputs not proven by those sources—such as showdown equity or FGS future branch probabilities—remain explicit.

## Effectiveness, experimentation and P17 longitudinal claims

P5-C before/after reports are observational.

P10 randomized N-of-1 requires preregistration, explicit primary metric, balanced seeded blocks, washout, sample/block gates and non-overlap. Passing it supports an individual randomized-block comparison, not a population-wide claim.

P17 longitudinal outcomes use only verified-solver/exact-math Cash BB real-game utility for regret metrics. Raw exposure is excluded. Monthly/family trends, early-vs-recent regret and training prescriptions are **observational prioritization signals** unless a separate P10 randomized experiment supports a causal intervention comparison.

The P17 frequency-weighted leak score is a comparable signal derived from recorded spot-frequency evidence. It must not be presented as guaranteed bankroll win rate or expected future profit.

Training prescription priority may combine verified regret, encounter-frequency signal, recent training accuracy/delayed retention and evidence confidence. This ranks what to study next; it does not change the underlying solver truth.

## UI rule

When evidence is missing or incompatible, use one of:

- `Unavailable`
- `Unsupported`
- `Insufficient evidence`
- `Ambiguous truth version`
- explicit lower trust tier

Never substitute a plausible-looking number.
