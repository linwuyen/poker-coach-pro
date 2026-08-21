# Closed-loop Architecture

## North star

Poker Coach Pro is optimized for reducing future decision loss, not maximizing quiz completion.

```text
Real-game exposure
  ↓
Context / decision-family identity
  ↓
Expected-learning-value scheduling
  ↓
Curated explanation + solver-backed transfer
  ↓
Delayed retrieval
  ↓
Hidden holdout / unseen generalization
  ↓
Before–after observational report
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

### Real-game evidence

Hand histories and normalized post-session imports create `trainingType: real-hand` records. These can establish:

- exposure frequency
- context
- chosen action / action pattern when available
- observed session metadata

A raw hand history cannot establish GTO correctness by itself. Utility regret is reportable only when it is separately backed by verified solver or exact-math evidence.

### Strategy truth

Full solver surfaces use immutable Strategy Profile v2 records. Frequency and EV are independent capabilities: a profile may contain frequencies without per-action EV, and the UI must then leave EV regret unavailable.

### Population evidence

Population exploit profiles are external, immutable records with provenance and a minimum sample gate. Heuristic archetypes stay separate and never inherit `population-exploit` trust merely because their recommendation looks plausible.

## Daily curriculum

The default Daily sequence is:

1. due / high-value curated repair
2. one-variable solver semantic counterfactual
3. unseen solver generalization

Due reviews consume the budget before new transfer work. Solver Daily selection only reads the Training partition. Sibling and Holdout are evaluation surfaces, not training supply.

## Effectiveness evaluation

The effectiveness dashboard compares fixed baseline/training/follow-up windows. It reports holdout, transfer, delayed retention and verified real-game leak when available.

It is observational. There is no causal claim unless a future experimental design supplies one.

## Tournament stack

```text
Chip EV
  ↓
ICM
  ├─ PKO bounty extension
  ├─ Satellite equal-seat payouts
  └─ FGS explicit future-state tree
```

FGS does not infer a future equilibrium. It evaluates a supplied finite chance/state tree by applying exact ICM at leaves and probability-weighted backward induction.

## Persistence

History schema v6 is the current browser storage format. v5/v4/v3/v2 are migrated on read. Backup version is v6.
