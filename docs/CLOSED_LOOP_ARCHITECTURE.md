# Closed-loop Architecture

## North star

Poker Coach Pro is optimized for reducing future decision loss, not maximizing quiz completion.

```text
Real-game exposure
  ↓
HH geometry / integrity audit
  ├─ cannot prove material state → exposure-only / Unknown
  └─ exact replayable state
       ↓
Truth router
  ├─ Preflop → Strategy Engine v2
  ├─ Heads-up postflop → indexed Strategy Engine v3
  └─ Multiway postflop → indexed Strategy Engine v4
       ↓
unique verified truth + sourced chosen/comparison EV?
  ├─ no → Unknown / Ambiguous
  └─ yes → verified regret
       ↓
Decision-family identity
       ↓
Leak-aware curriculum / delayed retrieval / hidden holdout
       ↓
P17 longitudinal real-game outcomes
       ├─ observational leak priority
       └─ P22 preregistered P10 evidence → recommended intervention
       ↓
Real-game exposure again
```

## P18 · Real-world geometry plane

Special HH features are no longer blanket rejected. They are converted into material exact-state dimensions when possible.

```text
straddle / dead blind
  ↓
position + kind + amountBB
  ↓
forcedBetKey
  ↓
v2 / v3 / v4 exact truth key
```

Straddle is live commitment; dead blind is dead pot money.

For multiway all-in decisions:

```text
player contributions + active set
  ↓
main/side contribution tiers
+ eligible positions per tier
  ↓
potStructureKey
  ↓
exact v4 node only
```

Run-it-twice / cash-out that begins after all Hero decisions is settlement-only and does not retroactively block earlier decision grading. If Hero acts after settlement begins, the state remains Unsupported.

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

## P19 · Coverage plane

Coverage is computed from **actual uniquely usable truth**:

```text
v2 profiles + v3 nodes + v4 nodes
  ↓
exact context
  ↓
combo ownership
  ├─ one owner → usable
  └─ >1 owners → ambiguous
       ↓
unique combos / full-EV combos / source refs
```

Coverage percentages are only produced against an explicit versioned target universe. Without it, absolute coverage is reported.

## P20 · Tournament decision evidence

```text
full-field tournament context
+ Hero cards / board
+ referenced weighted villain range
  ↓
equity engine
  ├─ exact enumeration → exact-eligible showdown equity
  └─ Monte Carlo → simulation-only
```

Only exact enumeration may auto-attach equity to exact ICM/PKO utility.

FGS probabilities remain a separate referenced evidence plane:

```text
external/model edge probabilities
  ↓
complete parent→child coverage
+ children sum to 1
  ↓
FGS tree
```

No future branch probability is inferred from HH.

## P16 → P21 population/exploit loop

```text
population raw counts
  ↓
P16 train/holdout replicated deviation
  ↓
external evidence-backed exploit candidate
  ↓
P21 independent paired candidate-minus-baseline EV holdout
  ↓
N ≥ 200 + practical gain + 95% interval > 0?
  ├─ no → insufficient / not-beneficial
  └─ yes → validated-exploit candidate
```

The system validates supplied strategies; it does not synthesize exploit ranges from a deviation.

## P17 → P22 learning/causal loop

P17 determines **what leak matters** from verified real-game outcomes. P10 determines **which intervention worked better for this player** under a preregistered randomized design.

```text
P17 prescription
  +
P10 experiment
  +
preregistered decisionFamily target
  ↓
P22
  ├─ insufficient experiment → no intervention link
  └─ randomized-n-of-1 winner → recommendedIntervention
```

The intervention link does not change solver truth, real-game regret magnitude, or population claims.

## P23 · Portable truth workspace

```text
header
pack manifests
v3 nodes (stream)
v4 nodes (stream)
footer counts
```

Export is incremental. Restore is additive and immutable. User-supplied files should run `validateOnly` first, then reopen the file stream for import. Footer count mismatch/truncation is rejected.

## Daily and evaluation partitions

Verified v2/v3/v4 real-game regret may affect only matching Training priority. PokerBench Sibling/Holdout remain evaluation-only. Raw HH exposure is never converted into regret without exact truth.

## Product surfaces

```text
#hand-history        HH replay + v2/v3/v4 strict grading
#postflop-truth      indexed v3 truth
#production-ops      P13–P17 operations
#evidence-ops        P18–P23 geometry, coverage, tournament, exploit, causal, workspace
#truth-ops           v2 coverage / population cohorts / reviewed explanations
#experiment          preregistered randomized N-of-1
#tournament-context  explicit ICM/PKO/FGS evaluation
```

## Runtime / persistence

- Heavy labs remain `React.lazy` routes.
- CI enforces a 500 KiB minified JavaScript chunk budget.
- real Chrome E2E loads both `#production-ops` and `#evidence-ops`.
- History: `poker_training_history_v6`.
- v2 custom profiles: `poker_strategy_profiles_v2`.
- v3 truth: IndexedDB `poker-coach-truth-v3`.
- v4 truth: IndexedDB `poker-coach-truth-v4`.
- Active P10 spec: `poker_learning_experiment_v1`.
- P23 workspace export/import is explicit and local; truth is not uploaded automatically.
