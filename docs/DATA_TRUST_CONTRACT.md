# Data Trust Contract

Poker Coach Pro must fail toward **unknown**, not toward fabricated precision.

## Trust tiers

1. `verified-solver` — solver output with source/provenance.
2. `exact-math` — result recomputable from stated mathematical inputs.
3. `population-exploit` — evidence-backed external population exploit profile with provenance and sample gate.
4. `expert-baseline` — reviewed teaching strategy, not solver truth.
5. `derived-interpolation` — explicit derivation between supported nodes.
6. `heuristic-estimate` — transparent teaching/ranking heuristic.

Storage, indexing, caching, migration, UI convenience, sample size, simulation reproducibility or agreement with an expected answer never upgrades a truth tier.

## Solver truth

### Preflop Strategy Profile v2

A `verified-solver` v2 profile requires solver name, source reference, generated time, frequency data and immutable `id@version`. Automated grading is exact-context only. P18 adds optional `forcedBetKey`; a straddle/dead-blind hand cannot match a standard node.

### Heads-up Postflop Truth Pack v3

A v3 node represents one exact heads-up Flop/Turn/River state: format/table, street, positions, player count, effective stack, pot, SPR, to-call, exact board, preflop/street action lines and sizing, aggressor, rake/cap when material, exact Hero combo, and P18 forced-bet geometry when present.

Automatic regret requires exactly one verified immutable node plus sourced chosen/comparison EV. Zero exact nodes is Unknown; multiple exact versions is Ambiguous/Unknown.

### Multiway Truth Pack v4

v4 is separate from v3. A v4 context requires every active non-Hero opponent position + remaining stack, Hero stack, player count, pot/SPR/to-call, exact board/action lines, aggressor, rake/cap when material, exact combo, and optional P18 `forcedBetKey` / `potStructureKey`.

Heads-up truth must never be projected onto multiway; multiway truth must never be simplified into a heads-up claim.

### Indexed storage / streaming

v3/v4 IndexedDB, context indexes, pack manifests, NDJSON streaming and portable workspace change storage scale only. Every node still passes the same immutable/provenance validation. P18 fixes streaming manifests so counts/bytes reflect actual streamed nodes rather than an empty final batch.

## P18 real-world HH geometry

Raw HH is observation first. Special markers do not automatically prove or disprove gradeability; the question is whether the **decision-time material state** can be uniquely reconstructed.

### Straddle / dead blind

- A non-standard forced post is gradeable only when player position, kind and amount in BB can be canonicalized.
- Straddle is a live preflop commitment and therefore affects to-call/current commitment.
- Dead blind is dead pot money and does not offset a later call.
- Canonical geometry enters v2/v3/v4 exact context matching.
- Marker present but unresolved geometry → `Unsupported`.

### Side pot / all-in

When an active all-in player makes pot eligibility material, v4 records contribution tiers and eligible positions in `potStructureKey`. Folded contributions remain in pot amounts but folded players are not eligible. A truth node without the same tier geometry cannot grade the decision.

### Run-it-twice / multiple boards and cash-out

If settlement begins only **after all Hero decisions are complete**, it does not retroactively change the earlier decision state and does not block those earlier decisions. If Hero acts after multi-board/cash-out settlement begins, current grading remains Unsupported.

Missing exact raise/all-in amount, Hero identity, button/blind/table geometry or other required material state remains fail-closed.

## P19 coverage claims

Coverage means actual usable truth, not importer capability.

Unified v2/v3/v4 coverage counts:

- unique exact contexts
- unique usable combos
- full per-action-EV combos
- ambiguous combo overlap
- source references
- persisted pack metadata

A combo owned by multiple exact truth versions is ambiguous and does not count as usable automatic-grading coverage.

A percentage such as “80% truth coverage” is allowed only against an explicit versioned `TruthCoverageTargetEnvelope` that defines the denominator/weights/minimum combo requirements. Without a target envelope, report absolute actual coverage only.

## Population evidence / P16 / P21

Measured HH cohorts preserve raw numerator/denominator and remain observation evidence.

P16 `validated-deviation` requires predeclared context/metric, baseline provenance, independent train/holdout raw counts, sample floors, practical delta, same-direction replication and Wilson 95% intervals excluding baseline. It still does **not** synthesize an exploit.

P21 validates an already supplied candidate strategy only when:

1. P16 deviation is validated for the exact strategy context;
2. candidate is already an evidence-backed `population-exploit` Strategy Profile;
3. candidate context exactly matches;
4. independent paired candidate-minus-baseline utility samples have provenance;
5. holdout sample count is at least 200;
6. mean improvement clears the declared practical threshold (default 0.01 BB/opportunity);
7. 95% mean-delta interval lower bound is above zero.

Passing P21 validates **that candidate in that declared population/context**. It does not synthesize a range or generalize to another pool.

## Tournament evidence / P15 / P20

Ordinary tournament HH does not reliably contain complete field state. P15 full-field lobby/snapshot and conservative summary adapters only establish values explicitly supplied by those sources.

P20 allows showdown equity to be computed from explicit `TournamentRangeEvidence` containing exact cards/board, weighted villain range and provenance. Only **exact enumeration** is `exact-eligible` for automatic attachment to exact ICM/PKO utility. Seeded Monte Carlo is reproducible `simulation-only`; it does not become `exact-math`.

FGS future branch probabilities may be attached only from explicit referenced parent→child probability evidence that covers every supplied tree edge and sums to one at each parent. Missing or extra edges are rejected. HH is never used to guess future strategy probabilities.

## Effectiveness / P10 / P17 / P22

P5/P17 before-after and longitudinal trends are observational prioritization signals. P17 real-game regret uses verified/exact compatible utility and does not treat raw HH exposure as loss truth.

P10 randomized N-of-1 supports an individual causal comparison only after preregistration, balanced seeded blocks, washout, minimum sample/block gates and one explicit primary metric.

P22 may feed a P10 result back into P17 only when the target `decisionFamilyId` was registered no later than the experiment preregistration and the experiment actually returns `randomized-n-of-1` with a winning arm. The result may select a **recommended intervention** for that leak family. It does not change solver truth, observed leak magnitude, or population-wide claims.

## P23 portable truth workspace

Large v3/v4 truth uses streaming NDJSON workspace records rather than ordinary history JSON backup.

Required invariants:

- header precedes data records;
- manifests/nodes validate independently;
- footer counts exactly match streamed records;
- validate-only pass is available before mutation;
- restore is additive and immutable; existing truth is never silently overwritten or cleared;
- export iterates stores incrementally rather than materializing one combined node array.

A truncated or count-mismatched workspace is invalid. A partially imported corrupted stream may leave only already-validated immutable additions; it cannot overwrite established truth.

## PokerBench and reviewed explanations

PokerBench supplies solver-labelled decisions, not a complete mixed-frequency/per-action-EV surface. Missing frequencies/EV/rationale must not be invented.

Human-reviewed explanations are interpretation records, not raw solver rationale. Author/reviewer/reference/boundary metadata remain distinct from solver evidence.

## UI rule

When evidence is missing or incompatible, use one of:

- `Unavailable`
- `Unsupported`
- `Insufficient evidence`
- `Ambiguous truth version`
- `Simulation only`
- explicit lower trust tier

Never substitute a plausible-looking number.
