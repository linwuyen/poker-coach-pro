# Closed-loop Architecture

## North star

Poker Coach Pro is optimized for reducing future decision loss, not maximizing quiz completion.

```text
Real-game exposure
  ↓
HH integrity audit
  ├─ unsupported geometry → exposure-only / Unknown
  └─ reconstructable state
       ↓
Exact truth router
  ├─ Preflop → Strategy Engine v2
  ├─ Heads-up Flop/Turn/River → indexed Strategy Engine v3
  └─ 3-way+ Flop/Turn/River → indexed Strategy Engine v4
       ↓
unique verified truth + sourced action EV?
  ├─ no → exposure-only / Unknown
  └─ yes → verified regret evidence
       ↓
Context / decision-family identity
       ↓
Expected-learning-value + leak-aware scheduling
       ↓
Teaching / solver transfer / delayed retrieval / holdout
       ↓
Observational effectiveness + preregistered randomized N-of-1
       ↓
P17 longitudinal real-game recheck + next prescription
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

Suit-isomorphic variants share a family. Semantic exact-math or solver-backed distinctions become separate families only when the decision boundary is materially different.

## Real-game evidence planes

### Observation

HH first proves only what happened. Raw hand history never establishes GTO optimality, population tendency or training causality.

### P13-C integrity gate

Before exact grading, an integrity audit rejects currently unmodeled or incomplete geometry such as straddle/dead blind, multiple runouts, side-pot semantics, cash-out state, missing raise-to geometry, or missing Hero/button/blind/table identity. Rejected hands remain useful as exposure evidence.

### Preflop v2

Observed preflop state must map to exactly one verified immutable v2 profile and sourced action EV.

### Heads-up postflop v3

P12 v3 exact state includes board, positions, effective stack, pot/SPR/to-call, action lines, aggressor, rake/cap and exact Hero combo.

P13 changes the runtime path:

```text
v3 solver export
  ↓ validate immutable node
IndexedDB node store
  ├─ contextKey index
  ├─ context metadata
  └─ pack manifests
       ↓
HH reconstructed v3 contextKey
       ↓
indexed exact candidate lookup
       ↓
0 / >1 match → Unknown
1 verified node + sourced EV → regret
```

Large truth lookup is no longer a full-array `filter()` operation. Legacy localStorage truth is migrated once into the indexed store.

### Multiway postflop v4

P14 uses a separate schema rather than weakening v3:

```text
Hero
+ every active opponent {position, remainingStack}
+ player count
+ board / pot / SPR / to-call
+ preflop line / street line
+ aggressor / rake context
+ exact Hero combo
```

Only a unique verified immutable v4 node can grade a 3-way+ decision. Heads-up v3 never acts as fallback.

## Truth ingestion and observability

### P13-A

- IndexedDB v3 store, context index, pack manifest.
- streaming NDJSON import.
- memory fallback for deterministic unit tests.
- diagnostics use counts/manifests instead of loading all nodes.

### P13-B

A configurable CSV adapter maps explicit solver-export columns into v3 truth. Missing material fields stay unavailable; vendor semantics are not guessed.

### P13-D

`#production-ops` reports bounded v3/v4 node/context/pack diagnostics. Observability never upgrades evidence.

## Population evidence and P16

The system keeps four concepts separate:

1. measured local HH cohort;
2. external population cohort;
3. replicated population deviation;
4. evidence-backed population exploit profile.

P16 adds independent train/holdout validation:

```text
solver baseline + reference
training raw counts
holdout raw counts
  ↓
sample floor + practical delta + Wilson 95% intervals
  ↓
validated-deviation?
  ├─ no → insufficient / not-replicated
  └─ yes
       ↓
matching evidence-backed population-exploit profile exists?
       ├─ no → deviation only
       └─ yes → exploitEligible
```

The engine never constructs an exploit range from a deviation alone.

## Tournament stack and P15

```text
Tournament summary
  └─ explicit finishing-place payouts only
Full-field lobby/snapshot CSV
  └─ tournamentId / handId / playersRemaining / every stack / optional bounty
        ↓
Tournament metadata registry
        ↓
MTT HH tournamentId + handId join
        ↓
full-field completeness check
        ↓
explicit ICM / PKO / FGS decision inputs
```

A table HH is never promoted to full-field state. Summary payout parsing does not infer stacks. FGS future probabilities remain explicit.

## Daily and training routing

Default curriculum still preserves due repair, solver semantic transfer and unseen generalization. Verified v2/v3/v4 real-game regret may influence **Training** priority at matching situation level; Sibling/Holdout remain evaluation-only.

## P17 longitudinal loop

P17 closes the multi-month feedback path using only verified-solver/exact-math Cash BB utility:

```text
verified real-game decisions
  ↓
monthly regret / aligned rate / street breakdown
  ↓
decision-family early vs recent regret
  ↓
join recent training accuracy + delayed retention
  ↓
priority = loss signal × frequency signal × repair need × evidence confidence
  ↓
next training prescription
```

These trends are observational. A separate P10 preregistered randomized N-of-1 result is required for a stronger individual intervention-causality statement.

## Product surfaces

```text
#hand-history        HH integrity + Preflop v2 + heads-up v3 + multiway v4 grading
#postflop-truth      indexed v3 truth + legacy migration
#production-ops      P13–P17 imports, scale diagnostics, multiway, tournament, population, longitudinal coach
#truth-ops           v2 coverage + population cohorts + reviewed explanations
#strategy-surface    v2 profile import/inspection
#tournament-context  explicit ICM/PKO/FGS evaluation
#effectiveness       observational windows
#experiment          preregistered randomized N-of-1
```

## Runtime / performance

- Heavy labs use route-level `React.lazy`.
- CI keeps a 500 KiB minified JS chunk hard budget.
- real Chrome E2E must load `#hand-history`, indexed `#postflop-truth`, and `#production-ops` in production build.
- v3/v4 exact lookup is indexed by material context; diagnostics do not require whole-store scans.

## Persistence

- History: `poker_training_history_v6`
- Preflop v2 profiles: `poker_strategy_profiles_v2`
- Heads-up v3 truth: IndexedDB `poker-coach-truth-v3`
- Multiway v4 truth: IndexedDB `poker-coach-truth-v4`
- Legacy v3 localStorage key is migration-only
- External population cohorts: `poker_population_cohorts_v1`
- Measured local HH cohorts: `poker_observed_population_cohorts_v1`
- Tournament metadata: `poker_tournament_metadata_v1`
- Reviewed explanations: `poker_reviewed_explanations_v1`
- Active randomized N-of-1: `poker_learning_experiment_v1`

Imported evidence remains local unless explicitly exported/synchronized through supported workflows.
