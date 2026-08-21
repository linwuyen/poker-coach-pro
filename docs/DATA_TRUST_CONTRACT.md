# Data Trust Contract

Poker Coach Pro must fail toward **unknown**, not toward fabricated precision.

## Trust tiers

1. `verified-solver` — solver output with source/provenance.
2. `exact-math` — result recomputable from stated mathematical inputs.
3. `population-exploit` — evidence-backed population exploit profile with provenance and validation gates.
4. `expert-baseline` — reviewed teaching strategy, not solver truth.
5. `derived-interpolation` — explicit derivation between supported nodes.
6. `heuristic-estimate` — transparent teaching/ranking heuristic.

Storage, indexing, caching, migration, UI convenience, sample size, simulation reproducibility, automation, provider availability, telemetry, or agreement with an expected answer never upgrades a truth tier.

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

Unified v2/v3/v4 coverage counts unique exact contexts, unique usable combos, full per-action-EV combos, ambiguous combo overlap, source references and persisted pack metadata.

A combo owned by multiple exact truth versions is ambiguous and does not count as usable automatic-grading coverage.

A percentage such as “80% truth coverage” is allowed only against an explicit versioned `TruthCoverageTargetEnvelope` that defines denominator/weights/minimum combo requirements. Without a target envelope, report absolute actual coverage only.

## P24 solver acquisition claims

P24 may plan how to close a P19 target gap. It must not imply missing solver truth already exists in the repository.

A `TruthAcquisitionSource` requires engine, solver identity/version, reference, generated time, content hash, license status and advertised exact contexts. Rules:

- duplicate content hashes are surfaced instead of counted as independent data;
- `unknown` license status is inventory-only and must never be recommended for installation;
- `owned`, `licensed`, or `open` sources require an explicit license reference before being considered installable;
- an advertised context is discovery metadata, not verified truth. Imported data still passes v2/v3/v4 immutable/provenance validation;
- missing context, insufficient combos, insufficient full-EV coverage and ambiguous overlaps remain distinct gap states.

P24 is an acquisition **control plane**, not a bundled solver database.

## P25 multi-site HH adapters

Site adapters may normalize syntax but do not receive a weaker evidence path.

PokerStars/GGPoker remain native. Winamax/WPN/PartyPoker/iPoker adapters may normalize supported headers, table/button statements, seat stacks and action punctuation into the existing conservative grammar. They must retain site provenance.

Adapters must not invent a hand id, blinds, player identity, action amount or missing geometry. If the normalized hand cannot pass the same P18 audit and v2/v3/v4 exact requirements, it remains exposure-only/Unsupported/Unknown.

## Population evidence / P16 / P21 / P27

Measured HH cohorts preserve raw numerator/denominator and remain observation evidence.

P16 `validated-deviation` requires predeclared context/metric, baseline provenance, independent train/holdout raw counts, sample floors, practical delta, same-direction replication and Wilson 95% intervals excluding baseline. It still does **not** synthesize an exploit.

P21 validates an already supplied candidate strategy only when the exact context/deviation/profile linkage and independent paired holdout pass the declared sample, practical-effect and positive-interval gates.

### P27 discovered candidates

P27 may search for a candidate only from:

- one exact `verified-solver` baseline;
- one P16 validated deviation for the same context;
- one explicit referenced population response model with at least 1,000 observations and per-action modeled utility;
- explicit bounded search constraints.

The generated strategy is always `derived-interpolation` first. It is **not** a validated exploit merely because its training-model EV is positive.

Promotion to `population-exploit` requires an independent P21-style paired holdout for that exact proposal/context. The holdout reference must differ from the response-model training reference, use at least 200 paired opportunities, clear the practical threshold and have a positive 95% mean-delta lower bound. Failed candidates remain derived proposals.

## Tournament evidence / P15 / P20 / P26

Ordinary tournament HH does not reliably contain complete field state. P15 full-field lobby/snapshot and conservative summary adapters only establish values explicitly supplied by those sources.

P20 allows showdown equity to be computed from explicit `TournamentRangeEvidence` containing exact cards/board, weighted villain range and provenance. Only **exact enumeration** is `exact-eligible` for automatic attachment to exact ICM/PKO utility. Seeded Monte Carlo is reproducible `simulation-only`; it does not become `exact-math`.

FGS future branch probabilities may be attached only from explicit referenced parent→child probability evidence that covers every supplied tree edge and sums to one at each parent. Missing or extra edges are rejected. HH is never used to guess future strategy probabilities.

### P26 provider automation

A provider descriptor requires id/version, kind, reference, generated time, methodology and declared capabilities. Provider responses still pass the P20 validators and must match the exact hand/cards/board or exact FGS edge set requested.

If multiple providers return valid material evidence, resolution is `Ambiguous` unless one provider is explicitly selected. Array order, provider insertion order or implicit priority must never select a material tournament input.

## Effectiveness / P10 / P17 / P22 / P28

P5/P17 before-after and longitudinal trends are observational prioritization signals. P17 real-game regret uses verified/exact compatible utility and does not treat raw HH exposure as loss truth.

P10 randomized N-of-1 supports an individual causal comparison only after preregistration, balanced seeded blocks, washout, minimum sample/block gates and one explicit primary metric.

P22 may feed a P10 result back into P17 only when the target `decisionFamilyId` was registered no later than experiment preregistration and the experiment actually returns `randomized-n-of-1` with a winning arm. The result may select a **recommended intervention** for that leak family. It does not change solver truth, observed leak magnitude, or population-wide claims.

### P28 repeated personal intervention learning

P28 aggregates only distinct P22 randomized experiment keys within the same `decisionFamilyId + primary metric + intervention`. A recommendation requires at least two experiments by default. Duplicate ingestion of one experiment does not increase evidence.

Different primary metrics are never pooled into one numeric effect. P28 learns which training intervention has repeated evidence for this player; it does not alter the P17 leak priority, solver strategy, or make a population-wide teaching claim.

## P23 / P29 workspace portability

P23 streams large v3/v4 truth with header/manifests/nodes/footer and additive immutable restore.

P29 adds portable browser state around that truth stream. Required invariants:

- only `poker_*` local state is eligible;
- credential-like keys (`api key`, token, secret, password, credential, authorization) are excluded;
- full-workspace ordering, embedded truth completeness, record counts and rolling content hash must validate before trust is claimed;
- local-state conflicts are not overwritten by default;
- truth import still follows P23 immutable checks;
- cross-device sync fast-forwards only with explicit direct ancestry. Divergent revisions are conflicts; there is no silent last-write-wins.

## P30 local reliability telemetry

Reliability telemetry is local product diagnostics, not poker evidence.

Allowed records contain only bounded machine labels and numeric values such as operation, outcome, reason code, site/engine dimension, duration and quota ratio. Raw HH, cards, player names, chat text, tokens, credentials and free-form error payloads are not allowed telemetry fields.

Telemetry may identify parser failure rates, reconstruction failures, truth Unknown rates, lookup latency, workspace/sync problems and quota pressure. It must never change a truth tier. In particular, a high truth-Unknown rate should drive P24 acquisition work, **not** approximate matching.

## P23 portable truth workspace

Large v3/v4 truth uses streaming NDJSON workspace records rather than ordinary history JSON backup. Header precedes data, footer counts must match, validate-only is available before mutation, restore is additive/immutable, and export iterates stores incrementally.

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
- `Ambiguous provider evidence`
- `Simulation only`
- `Derived candidate — holdout required`
- `Sync conflict`
- explicit lower trust tier

Never substitute a plausible-looking number.
