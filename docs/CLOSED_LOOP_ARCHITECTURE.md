# Closed-loop Architecture

## North star

Poker Coach Pro is optimized for reducing future decision loss, not maximizing quiz completion.

```text
Real-game exposure
  ↓
P25 site adapter → canonical HH
  ↓
P18 geometry / integrity audit
  ├─ cannot prove material state → exposure-only / Unknown
  └─ exact replayable state
       ↓
Truth router
  ├─ Preflop → Strategy Engine v2
  ├─ Heads-up postflop → indexed Strategy Engine v3
  └─ Multiway postflop → indexed Strategy Engine v4
       ↓
unique verified truth + sourced chosen/comparison EV?
  ├─ no → Unknown / Ambiguous → P24 acquisition gap signal
  └─ yes → verified regret
       ↓
Decision-family identity
       ↓
Leak-aware curriculum / delayed retrieval / hidden holdout
       ↓
P17 longitudinal real-game outcomes
       ├─ observational leak priority
       └─ P22 randomized intervention link
             ↓
          P28 repeated personal intervention model
       ↓
Real-game exposure again
```

## P18 · Real-world geometry plane

Special HH features are converted into material exact-state dimensions when possible.

```text
straddle / dead blind → position + kind + amountBB → forcedBetKey → v2/v3/v4 exact key
multiway all-in → contribution tiers + eligible positions → potStructureKey → exact v4 only
```

Run-it-twice / cash-out that begins after all Hero decisions is settlement-only and does not retroactively block earlier decision grading. If Hero acts after settlement begins, the state remains Unsupported.

## P25 · Site normalization plane

PokerStars/GG remain native parsers. Winamax/WPN/Party/iPoker syntax is normalized into the same parser grammar.

```text
site export
  ↓
site detector / adapter
  ↓
canonical header / table / seat / actor syntax
+ retained source marker
  ↓
existing ParsedHandHistory
  ↓
P18 geometry + v2/v3/v4 replay
```

No adapter has a special truth path. Missing identity/geometry remains Unsupported.

## Truth ingestion and scale

v3 and v4 both use IndexedDB:

```text
solver pack / NDJSON
  ↓
immutable node validation
  ↓
nodes + context index + context metadata + pack manifests
  ↓
exact contextKey lookup
```

NDJSON imports persist true node/skipped/byte manifest values. `iterateNodes()` pages through stores rather than building one combined in-memory truth array.

## P19 → P24 coverage/acquisition plane

P19 computes actual uniquely usable truth and accepts an explicit target universe.

```text
v2/v3/v4 actual truth
+ versioned target envelope
  ↓
P19: usable/full-EV/ambiguous coverage
  ↓
P24 source inventory
  ├─ content-hash dedupe
  ├─ license gate
  └─ advertised exact contexts
  ↓
missing-context / insufficient-combo / insufficient-full-EV / ambiguous acquisition backlog
```

P24 never manufactures the missing solver nodes. Unknown-license sources remain inventory-only.

## P20 → P26 tournament evidence providers

```text
Tournament decision request
  ↓
P26 provider registry
  ├─ verified solver
  ├─ validated population source
  └─ user-supplied model
       ↓
exact response identity check
  ├─ 0 providers → unavailable
  ├─ 1 provider → P20 validation
  └─ >1 providers → ambiguous unless explicitly selected
       ↓
P20 range equity / FGS edge evidence
  ├─ exact enumeration → exact-eligible showdown equity
  └─ Monte Carlo → simulation-only
```

Provider ordering never acts as hidden material evidence priority.

## P16 → P21 → P27 population/exploit loop

```text
population raw counts
  ↓
P16 train/holdout replicated deviation
  ↓
verified-solver baseline
+ explicit population response model
+ bounded search constraints
  ↓
P27 derived-interpolation candidate
  ↓
independent paired holdout (different evidence reference)
  ↓
N ≥ 200 + practical gain + 95% interval > 0?
  ├─ no → candidate remains derived
  └─ yes → exact proposal promoted to population-exploit
```

P27 search cannot jump directly to `population-exploit`; the independent holdout is the promotion boundary.

## P17 → P22 → P28 learning/causal loop

P17 determines **what leak matters**. P22 links one preregistered randomized N-of-1 result to one leak family. P28 learns which intervention repeats for this player.

```text
P22 causal evidence records
  ↓
group by decisionFamilyId + primary metric + intervention
  ↓
dedupe experiment keys
  ↓
≥ 2 distinct randomized experiments?
  ├─ no → no learned intervention
  └─ yes → personal intervention recommendation
```

Different primary metrics are never pooled. P28 does not rewrite solver truth or P17 leak priority.

## P23 → P29 workspace plane

P23 truth transport remains incremental and immutable. P29 wraps portable browser state around it.

```text
full-workspace-header
portable poker_* local-state records
  ↓ (credential-like keys excluded)
embedded P23 truth stream
full-workspace-footer + rolling content hash
```

Restore flow:

```text
validate full workspace
  ↓
validate embedded P23 truth
  ↓
additive immutable truth restore
+ conflict-safe local-state restore
```

Cross-device revisions require explicit ancestry:

- same revision/hash → same;
- remote direct descendant → accept remote;
- local direct descendant → keep local;
- otherwise → conflict.

There is no last-write-wins for divergent histories.

## P30 reliability feedback plane

The reliability loop is deliberately separate from poker truth.

```text
HH parse / reconstruct
truth lookup / IndexedDB
workspace / sync / experiment / quota
  ↓
local bounded machine-label events only
  ↓
30-day operation rates + p50/p95 + top reason codes
  ↓
engineering recommendation
```

Examples:

- high parser failure → improve P25 adapter coverage;
- high truth Unknown → use P24 acquisition gaps;
- high truth lookup p95 → inspect context indexes/overlap;
- high quota → export P29 workspace/prune replaceable packs;
- sync conflict → explicit reconciliation.

Raw HH, cards, player names, secrets and free-text payloads are excluded. Telemetry never changes a truth tier.

## Daily and evaluation partitions

Verified v2/v3/v4 real-game regret may affect only matching Training priority. PokerBench Sibling/Holdout remain evaluation-only. Raw HH exposure is never converted into regret without exact truth.

## Product surfaces

```text
#hand-history             P25 multi-site HH → P18 replay → v2/v3/v4 strict grading + P30 reliability events
#postflop-truth           indexed v3 truth
#production-ops           P13–P17 operations
#evidence-ops             P18–P23 geometry, coverage, tournament, exploit validation, causal link, truth workspace
#production-intelligence  P24–P30 acquisition, site smoke, providers, candidate search, personal model, full workspace, reliability
#truth-ops                v2 coverage / population cohorts / reviewed explanations
#experiment               preregistered randomized N-of-1
#tournament-context       explicit ICM/PKO/FGS evaluation
```

## Runtime / persistence

- Heavy labs remain `React.lazy` routes.
- CI enforces a 500 KiB minified JavaScript chunk budget.
- real Chrome E2E loads `#production-ops`, `#evidence-ops`, and `#production-intelligence`.
- History: `poker_training_history_v6`.
- v2 custom profiles: `poker_strategy_profiles_v2`.
- v3 truth: IndexedDB `poker-coach-truth-v3`.
- v4 truth: IndexedDB `poker-coach-truth-v4`.
- Active P10 spec: `poker_learning_experiment_v1`.
- Static P26 provider envelopes: `poker_tournament_evidence_providers_v1`.
- P28 causal evidence registry: `poker_causal_prescription_evidence_v1`.
- P30 local reliability events: `poker_reliability_events_v1`.
- P29 full workspace export/import is explicit/local; credential-like keys are excluded and no data is uploaded automatically.
