# P24–P30 Production Intelligence Loop

This layer turns the P18–P23 evidence system into a more operational product without weakening the Data Trust Contract. Automation reduces manual work; it does not manufacture data, provenance, causality, or conflict resolution.

## P24 — Solver Truth Acquisition Control Plane

P24 consumes an explicit P19 `TruthCoverageTargetEnvelope` and the actual v2/v3/v4 coverage report, then produces an acquisition backlog.

A `TruthAcquisitionSource` must declare:

- engine (`v2-preflop`, `v3-heads-up`, or `v4-multiway`)
- solver name/version
- source reference and generated time
- content hash
- license status
- license reference when the source is installable
- advertised exact context keys

Rules:

- identical content hashes are surfaced as duplicate payloads;
- `unknown` license sources stay inventory-only and are never recommended for installation;
- missing context, insufficient combo coverage, insufficient full-EV coverage, and ambiguous overlapping truth are separate gaps;
- a source advertisement is discovery metadata only. Imported nodes must still pass the existing immutable v2/v3/v4 validators.

P24 does **not** mean the repository owns a complete solver database. Actual truth still depends on licensed/owned/open data supplied to the application.

## P25 — Multi-site Hand History Normalization

All sites normalize into the same conservative replay grammar before P18 geometry and v2/v3/v4 grading.

Supported adapter families:

- PokerStars (native)
- GGPoker (native)
- Winamax
- WPN
- PartyPoker
- iPoker

The adapter may normalize syntax such as headers, seat stacks, button declarations, and actor action punctuation. It may not infer missing hand identity, blind geometry, player identity, action amounts, or material state.

Site provenance is retained. A normalized Winamax/WPN/Party/iPoker hand must not become a false PokerStars source claim.

The main `#hand-history` importer now uses this adapter facade before the existing P18 integrity, P2/v2/v3/v4 truth, population, tournament, and History pipelines.

## P26 — Tournament Evidence Provider Registry

P26 adds provider identity around P20 range and FGS evidence.

Provider descriptors declare:

- id/version
- kind (`verified-solver`, `validated-population`, or `user-supplied-model`)
- reference/generated time/methodology
- capabilities (`range`, `fgs-probabilities`)

A provider response is accepted only when it matches the exact request identity:

- range: hand id + Hero cards + board;
- FGS: hand id + exact tree edge set.

If multiple providers return valid material evidence, the result is `ambiguous` unless the caller explicitly selects one provider. Provider ordering is never used as a hidden truth priority.

Serializable static provider packages may be stored locally. They are still subject to the same P20 evidence validators.

## P27 — Constrained Exploit Candidate Discovery

P27 can propose a strategy; it cannot skip validation.

Inputs:

1. one exact `verified-solver` Strategy Profile baseline;
2. one P16 `validated-deviation` for the same context;
3. one referenced population response model with at least 1,000 observations and explicit per-action modeled utility;
4. explicit search constraints.

Search is bounded around the solver baseline (default maximum frequency shift 0.20 per hand; hard maximum 0.50). Missing modeled utility means that hand is not modified.

The initial proposal is always:

- source type `derived`;
- trust tier `derived-interpolation`;
- tagged as requiring independent holdout.

Promotion to `population-exploit` requires a separate P21-style paired holdout:

- exact proposal/deviation/context linkage;
- holdout reference distinct from the response-model training reference;
- at least 200 paired opportunities;
- practical improvement threshold;
- positive 95% mean-delta lower bound.

Failure leaves the proposal derived and unpromoted.

## P28 — Repeated Personal Intervention Model

P22 links one preregistered randomized N-of-1 result to one decision family. P28 learns only when the evidence repeats.

Aggregation key:

```text
decisionFamilyId + primary metric + intervention
```

Rules:

- the same experiment key is deduplicated;
- at least two distinct randomized experiments are required by default;
- different primary metrics are never numerically pooled;
- the model may recommend a training intervention, but does not alter solver truth, real-game leak magnitude, or the P17 priority score.

This is a personalized intervention-effect signal for this player, not a population-wide teaching claim.

## P29 — Full Portable Workspace and Sync Ancestry

P29 wraps portable `poker_*` browser state around the P23 streamed v3/v4 truth workspace.

Export structure:

```text
full-workspace-header
portable local-state records
embedded P23 truth lines
full-workspace-footer + rolling content hash
```

Security / integrity rules:

- credential-like keys (`api key`, token, secret, password, credential, authorization) are excluded from export;
- full workspace validates ordering, embedded truth completeness, record counts, and rolling content hash;
- local-state restore is conflict-safe by default and does not overwrite a different existing value unless explicitly requested;
- truth restore still uses P23 additive immutable checks;
- large truth export can write directly to a caller-owned `WritableStream` / File System Access handle.

Cross-device revisions use explicit ancestry. A direct descendant may fast-forward. Divergent histories are `conflict`; there is no silent last-write-wins.

## P30 — Local Reliability Telemetry

P30 records product reliability, not user content.

Allowed event dimensions are bounded machine labels only:

- operation
- outcome
- short reason code
- short dimension (for example a site/engine label)
- duration
- numeric value such as quota ratio

Raw HH, cards, player names, chat text, tokens, credentials, and free-form error payloads are not telemetry fields.

Current operation classes include:

- HH parse
- HH reconstruction
- truth lookup
- IndexedDB
- workspace
- sync
- experiment
- storage quota

The 30-day report exposes success/unsupported/unknown/error/conflict counts, p50/p95 latency, top machine reason codes, and actionable recommendations. Examples:

- parser success below 98% → improve the highest-frequency parser failure before adding unrelated features;
- truth Unknown above 25% → use P24/P19 acquisition gaps, never relax exact matching;
- truth lookup p95 above 100 ms → inspect context indexes/pack overlap;
- storage quota above 80% → export P29 workspace/prune replaceable solver packs;
- sync conflicts → preserve explicit reconciliation instead of last-write-wins.

## Product Surface

`#production-intelligence` is the P24–P30 operations surface. The main `#hand-history` path is also part of P25/P30 because it now uses multi-site normalization and records content-free reliability events.

## Regression Invariants

P24–P30 must preserve:

- truth hierarchy and exact matching;
- no fake solver data or fake license status;
- no hidden provider priority for material tournament inputs;
- exploit proposal ≠ validated exploit;
- observational leak ≠ randomized causal effect;
- Training/Sibling/Holdout isolation;
- no credential export in full workspace;
- no last-write-wins for divergent workspace revisions;
- no raw poker/user content in reliability telemetry;
- 500 KiB minified JS chunk budget;
- production Chrome E2E and repository validators.
