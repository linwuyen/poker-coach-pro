# Closed-loop Architecture

## North star

Poker Coach Pro is optimized for reducing future decision loss, not maximizing quiz completion.

```text
Real-game exposure
  ↓
Observed decision context
  ↓
Exact truth join? ── no ──→ exposure-only / Unknown
  │ yes
  ↓
Verified / exact regret evidence
  ↓
Context / decision-family identity
  ↓
Expected-learning-value + leak-aware scheduling
  ↓
Curated explanation + solver-backed transfer
  ↓
Delayed retrieval
  ↓
Hidden holdout / unseen generalization
  ↓
Observational report + preregistered randomized N-of-1
  ↓
Real-game exposure again
```

## Identity layers

A concrete question is not automatically a new knowledge node.

```text
question instance
  └─ decisionFamilyId
       ├─ skillIds
       └─ situationIds / contextFamilyId
```

Suit-isomorphic variants share a decision family. Semantic exact-math scenarios and verified one-variable solver pairs get distinct families only when their decision boundary is genuinely different.

## Real-game evidence planes

### Observation layer

Hand histories always establish observation first: exposure frequency, chosen action, source/hand identity, board/actions and other fields the HH actually contains. Raw HH does not establish optimality.

### Preflop exact grading — Strategy Engine v2

```text
HH preflop decision
  ↓
derive hand / positions / effective stack / action line
  ↓
exactly one immutable verified v2 profile?
  ├─ no → exposure-only
  └─ yes
       ↓
chosen action + comparison action have sourced EV?
  ├─ no → exposure-only
  └─ yes → verified regret evidence
```

### Postflop exact grading — Strategy Engine v3

P12 adds a separate state model rather than stretching v2.

```text
HH Flop / Turn / River
  ↓ replay actions to the instant BEFORE Hero acts
active players / pot / street commitments / remaining stacks
  ↓
require heads-up state
  ↓
exact board + Hero/Villain positions
+ effective stack + pot + SPR + to-call
+ canonical preflop line + current-street line
+ last aggressor + rake/cap + exact Hero combo
  ↓
exactly one immutable verified v3 node?
  ├─ no → exposure-only / Unknown
  └─ yes
       ↓
chosen action + comparison action have sourced EV?
  ├─ no → exposure-only
  └─ yes → Flop/Turn/River verified regret
```

Automatic v2/v3 grading never uses approximate truth. Multiway postflop is intentionally unsupported until all player ranges/state can be represented.

## Strategy truth

### v2

Preflop Strategy Profile v2 contains context, action frequencies, optional per-action EV, source provenance and immutable version/hash.

### v3

Postflop Truth Pack v3 contains exact heads-up nodes with:

- board/street
- positions
- pot geometry / SPR / to-call
- preflop and current-street action lines
- exact Hero combos
- mixed action frequencies
- optional per-action EV and sizing surface
- verified solver provenance

Coverage is computed from actually imported data. The engine never treats importer capability as proof that a complete solver database exists.

## Population evidence

Three objects are distinct:

1. **Measured local cohort** — P12 direct HH numerator/denominator aggregation; proves only what was observed.
2. **External population cohort** — P9-B site/stake/window/sample/provenance registry.
3. **Population exploit profile** — explicit exploit strategy supported by an evidence source.

A measured tendency does not automatically synthesize exploit strategy or solver EV.

## Daily curriculum

Default sequence remains:

1. due / high-value curated repair
2. one-variable solver semantic counterfactual
3. unseen solver generalization

Verified real-game regret from either preflop v2 or postflop v3 may multiply Training-row priority using same position/street. This is situation-level routing only. Sibling/Holdout remain evaluation-only.

## Tournament reconstruction and utility

```text
MTT HH
  ├─ auto-extract hand/tournament identity + table/Hero state
  ↓
Tournament metadata registry
  ├─ payout vector + utility unit
  └─ handId → full-field stack snapshot
  ↓
reconstruction completeness check
  ├─ missing → incomplete draft, list missing fields
  └─ complete → reusable tournament state
       ↓
explicit decision-specific ICM / PKO / FGS inputs
       ↓
exact-math tournament utility evidence
```

P12-E reduces repeated manual state entry, but a table snapshot is never treated as the entire tournament field. Showdown equity, bounty semantics and FGS probabilities remain explicit traceable inputs when ordinary HH cannot prove them.

## Effectiveness and experimentation

P5-C remains observational before/training/follow-up analysis. P10 adds preregistered seeded balanced randomized-block N-of-1 comparisons with washout and sample/block gates. Neither layer permits stronger causal claims than its design supports.

## Product surfaces

```text
#hand-history        real-game observation + strict preflop v2 / postflop v3 grading
#postflop-truth      v3 truth pack import + coverage + tournament metadata + local cohort status
#truth-ops           v2 truth coverage + external population cohorts + reviewed explanations
#strategy-surface    Strategy Profile v2 import/inspection
#tournament-context  explicit ICM/PKO/FGS context evaluation
#effectiveness       observational longitudinal report
#experiment          preregistered randomized N-of-1
```

## Runtime / performance

P11 route-level `React.lazy` remains the production loading model. P12 adds `#postflop-truth` as another lazy route, and real-Chrome E2E must load it successfully. The 500 KiB minified JavaScript chunk budget remains a hard CI gate.

## Persistence

- History: `poker_training_history_v6`
- Preflop full solver surfaces: `poker_strategy_profiles_v2`
- Postflop v3 truth: `poker_postflop_truth_nodes_v3`
- External population cohorts: `poker_population_cohorts_v1`
- Measured local HH cohorts: `poker_observed_population_cohorts_v1`
- Tournament metadata registry: `poker_tournament_metadata_v1`
- Reviewed explanations: `poker_reviewed_explanations_v1`
- Active N-of-1 spec: `poker_learning_experiment_v1`

Imported evidence remains local unless explicitly exported/synchronized through supported workflows.
