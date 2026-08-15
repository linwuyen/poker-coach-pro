# V11 — Unified adaptive training

## Product contract

Poker Coach Pro has one normal learning loop:

`看牌 -> 自己決策 -> 原地深挖 -> 更新玩家模型 -> 自適應下一手`

The user should not have to understand or manually coordinate Companion, Range, Equity, Boundary, Solver or ICM surfaces during a normal training session.

## Zero-refill hand context

The simulated hand is the source of truth. After the learner commits a decision, the same scenario must directly feed analysis with every field already known by the trainer:

- Hero cards / starting-hand code
- board
- street
- Hero position
- inferred villain position when available
- effective stack
- pot
- structured action history when available
- inferred strategy spot
- open size when available
- tournament model when available
- learner confidence
- learner selected action
- best action
- feedback and evidence

The learner must not be asked to re-enter these values in a second form.

When a datum is genuinely missing, the UI must say that it is unknown or unsupported. It must not fabricate a value merely to make a workbench look complete.

## Integrated deep dive

Post-decision analysis is rendered inside `TrainingSession`, not as a popup-based tool chooser.

The integrated analysis may expose:

- Range / blocker evidence
- Math / EV / SPR / pot-odds context
- verified preflop strategy frequencies when an exact supported node exists
- decision boundary / reversal conditions
- conceptual diagnosis and memory rule
- recommended intervention emphasis

Legacy specialist routes may remain for development, diagnostics and independent research, but they are not the normal training path.

## Adaptive next hand

A session is no longer semantically a frozen queue. After each completed hand, the remaining scenarios are re-ranked from the updated history.

When the latest decision is wrong or low-confidence, the scheduler adds a transfer preference for remaining scenarios that overlap the current concept and/or street, while still using Expected Learning Value as the baseline rank.

For multi-step scenarios, adaptation happens only after the hand reaches `next_hand`; intra-hand decisions remain in their authored sequence.

## Safety / truthfulness

- Retrieval stays locked before the learner answers.
- Exact strategy is shown only when the existing strategy engine returns a supported node.
- Postflop solver frequencies are not invented.
- Exact EV/equity is not invented when the scenario does not provide trustworthy evidence.
- Existing real-money safety policy and HandStateBus infrastructure remain intact.

## Acceptance criteria

1. Normal training has no separate Companion button.
2. Clicking through a normal hand never requires retyping data already present in the simulation.
3. After answering, deep-dive context includes the learner's actual selected action.
4. Range/Math/Strategy/Boundary analysis is presented inline when trustworthy data exists.
5. Missing data is labelled as missing rather than requested again or fabricated.
6. A wrong or low-confidence completed hand can change the ordering of the remaining hands.
7. Existing history, spaced review, learning metrics and safety gates continue to work without schema migration.
