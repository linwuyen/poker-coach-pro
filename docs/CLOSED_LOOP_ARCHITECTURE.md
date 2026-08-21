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

## Evidence planes

### Training evidence

Scenario, transfer, counterfactual, solver-corpus and benchmark attempts carry correctness, confidence, review interval and optional regret.

### Real-game observation

Hand histories and normalized post-session imports create `trainingType: real-hand` records that can establish:

- exposure frequency
- observed context
- chosen action / action pattern
- session/hand provenance

Raw HH does not establish optimality.

### Exact real-game grading

P9-C adds a second real-game layer. For automated HH grading:

```text
HH preflop decision
  ↓
derive hand / positions / effective stack / action line
  ↓
require every material Strategy Profile v2 dimension
  ↓
exactly one immutable verified-solver profile?
  ├─ no → stop at exposure
  └─ yes
       ↓
chosen action has sourced per-action EV?
  ├─ no → stop at exposure
  └─ yes → write verified regret evidence
```

Interactive approximate lookup and automated grading are intentionally different contracts. Automated grading never uses approximate solver nodes.

Current automatic grading is preflop-only because the current Strategy Context does not fully encode postflop board + action tree state.

### Strategy truth

Full solver surfaces use immutable Strategy Profile v2 records. Frequency and EV are independent capabilities.

P9-A coverage is computed from the profiles actually present in storage/runtime:

```text
verified contexts
frequency hand rows
mixed hand rows
EV hand rows
full per-action-EV hand rows
```

The coverage layer does not imply bundled complete solver data.

### Population evidence

There are two related but separate objects:

1. **Population cohort** — site/stake/window/sample/raw measured counts/provenance.
2. **Population exploit profile** — explicit exploit ranges and optional modeled EV.

Cohorts may link to exploit profiles, but a measured tendency does not automatically synthesize an exploit strategy.

Heuristic archetypes remain separate.

### Reviewed explanation evidence

Human-reviewed teaching explanations are immutable interpretation records linked to a decision family or profile+hand. They contain why/boundaries/common mistake/contrastive cue plus author/reviewer/reference.

They can explain a solver-backed decision without being relabelled as solver output.

## Daily curriculum

Default sequence remains:

1. due / high-value curated repair
2. one-variable solver semantic counterfactual
3. unseen solver generalization

Due reviews consume the budget first. Solver Daily selection only reads PokerBench Training partition.

P9-C may multiply Training-row priority using verified real-game regret from the same position/street. This is a routing heuristic grounded in verified regret, not an identity claim between two solver datasets. Sibling and Holdout remain evaluation-only.

## Effectiveness and experimentation

### Observational plane

P5-C compares fixed baseline/training/follow-up windows for holdout, transfer, delayed retention and verified real-game leak. This remains observational.

### Randomized N-of-1 plane

P10 adds a separate preregistered design:

```text
preregister hypothesis + primary metric
  ↓
seeded balanced randomized blocks
  ↓
washout at each block start
  ↓
collect only primary-metric evidence
  ↓
require >=2 evidence blocks per arm + sample floor
  ↓
individual randomized-block comparison
```

An N-of-1 result can strengthen an intervention comparison for this player. It is not a population-wide causal result.

## Tournament stack

```text
Tournament HH (observation / handId)
  ↓ join explicit referenced state
ICM
  ├─ PKO bounty extension
  ├─ Satellite equal-seat payouts
  └─ FGS explicit future-state trees
```

Tournament utility context is never reconstructed from ordinary HH when payouts/stacks/bounties/probabilities are absent. FGS evaluates supplied action trees; it does not infer equilibrium future strategy.

## Product surfaces

```text
#hand-history        real-game observation + strict verified preflop grading
#truth-ops           solver coverage + population cohorts + reviewed explanations
#strategy-surface    Strategy Profile v2 import/inspection
#tournament-context  HH handId + explicit ICM/PKO/FGS context join
#effectiveness       observational longitudinal report
#experiment          preregistered randomized N-of-1
```

## Runtime / performance

P11 uses route-level `React.lazy` for heavyweight analysis, solver, training and tournament labs. The default application shell no longer imports every workbench into the entry chunk.

Real Chrome E2E validates production lazy-chunk navigation across the critical surfaces as well as HH controlled input/history persistence and randomized-experiment persistence.

## Persistence

- History schema v6 is the current browser history format; v5/v4/v3/v2 migrate on read.
- Full solver surfaces: `poker_strategy_profiles_v2`.
- Population cohorts: `poker_population_cohorts_v1`.
- Reviewed explanations: `poker_reviewed_explanations_v1`.
- Active randomized N-of-1 spec: `poker_learning_experiment_v1`.

Imported evidence registries remain local unless the user explicitly exports/synchronizes them through supported data workflows.
