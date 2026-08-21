# P18–P23 Real-world Evidence Loop

This document is the operational contract for the P18→P23 layer. It does not grant higher truth status than `docs/DATA_TRUST_CONTRACT.md`.

## P18 — decision-time geometry

### Forced bets

`forcedBetKey` is canonicalized from non-standard forced posts using position, kind (`straddle` / `dead-blind`) and amount in BB. Player names are excluded from the key.

- straddle: live preflop commitment + pot contribution;
- dead blind: pot contribution only.

If a marker exists but exact geometry cannot be derived, the hand remains Unsupported.

### Side pots

`potStructureKey` is emitted only when an active all-in player makes tier eligibility material. The key represents contribution-tier amounts and eligible positions. Standard multiway pots without an active all-in do not acquire an unnecessary key.

### Settlement after decisions

Multiple runouts and cash-out are settlement features. If they begin after all Hero betting decisions, earlier decisions may still be graded. Any Hero decision after those settlement semantics begin remains Unsupported.

## P18-E — scalable v4 truth

v4 matches v3 production storage primitives: IndexedDB context index, manifests, true streamed node/byte counts, NDJSON ingestion, paged iteration, immutable writes and deterministic memory fallback.

## P19 — coverage denominator discipline

A truth cell is engine + exact context. Combo ownership is counted across all verified nodes:

- one owner → usable combo;
- multiple owners → ambiguous combo;
- at least two sourced finite action EV values → full-EV combo.

`TruthCoverageTargetEnvelope` is the only mechanism that introduces a weighted denominator. Targets are versioned, referenced and explicit.

## P20 — tournament decision evidence

`TournamentRangeEvidence` is accepted only with identity, handId, exact Hero cards/board, explicit weighted villain range and provenance.

The existing equity engine decides whether enumeration is exact. Monte Carlo output is retained as simulation-only and cannot be attached as exact showdown equity.

`FgsProbabilityEvidence` supplies probabilities for explicit tree edges. Every supplied edge must be used exactly once and every parent distribution must sum to one.

## P21 — exploit candidate validation

P21 never creates a strategy. It validates a supplied evidence-backed population profile after P16 has already established the population deviation.

Independent holdout evidence contains paired `candidate EV - baseline EV` deltas. Validation requires:

- exact deviation/profile/context linkage;
- at least 200 paired observations;
- mean gain above the declared practical threshold;
- normal-theory 95% mean interval lower bound > 0.

The result is scoped to the supplied profile/population/context.

## P22 — causal intervention routing

A `PreregisteredExperimentTarget` binds one P10 experiment version to one decision family before experiment preregistration. After P10 passes its randomized N-of-1 gate, the winning arm can become the `recommendedIntervention` for that family.

This linkage selects a training method. It does not modify the leak magnitude, truth tier or solver strategy.

## P23 — portable truth workspace

Workspace NDJSON is a local transport format:

1. one header;
2. v3/v4 manifests;
3. streamed v3 nodes;
4. streamed v4 nodes;
5. one footer with record counts.

Recommended user-file flow:

1. open file stream and run `validateOnly`;
2. reopen the file;
3. additive immutable import.

Existing truth is never cleared by workspace import. Node-level immutable conflicts still throw.

## Regression gates

P18–P23 changes must preserve:

- exact matching; no nearest-node fallback;
- Training/Sibling/Holdout isolation;
- tournament utility unit separation;
- P10 preregistration semantics;
- 500 KiB minified JS chunk budget;
- real Chrome production E2E;
- all repository scenario/range validators.
