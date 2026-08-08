# Learning Engine v3

## North-star objective

Minimize future decision EV regret per unit of training time.

The v3 loop is:

1. **Truth** — use a strategy source with an explicit trust tier.
2. **Decision** — record the player's choice, confidence, and EV evidence when available.
3. **Regret** — calculate `max(0, bestEV - chosenEV)` rather than treating all mistakes equally.
4. **Skill graph** — map the attempt to reusable capabilities rather than only a scenario id.
5. **Transfer** — require delayed retrieval plus a sibling/counterfactual attempt before a skill can become mastered.
6. **Scheduler** — rank available drills by Expected Learning Value.
7. **Real hands** — allow real-table leaks to feed the same skill model.

## History v4 extensions

All v3 fields are optional, so old History v4 data stays readable:

- `skillIds`
- `transferGroupId`
- `chosenEvBB`
- `bestEvBB`
- `evLossBB`
- `truthTier`
- `isTransferTest`
- additional training types: `counterfactual`, `transfer`, `real-hand`

## Skill mastery

A skill is not mastered merely because one exact question was repeated successfully.

`mastered` requires:

- high weighted performance,
- at least one delayed retrieval,
- and either an explicit transfer/counterfactual attempt or success across multiple distinct scenarios.

## Expected Learning Value

Drills are ranked using a weighted combination of:

- weakness,
- forgetting risk,
- uncertainty / sample confidence,
- transfer value,
- EV importance,
- player-profile relevance,
- and estimated time cost.

Due reviews and recent mistakes receive multiplicative boosts. The daily plan caps explicit transfer benchmark labeling so ordinary unseen exploration is still preserved.

## Counterfactual trainer

The Decision Boundary trainer keeps the baseline opponent range and Hero equity fixed while changing the opponent bet size. This isolates the causal variable and teaches where a Call/Fold decision reverses.

Each variant stores:

- pot odds,
- chosen action,
- best action,
- chosen EV,
- best EV,
- EV regret,
- truth tier,
- transfer-group identity.

## ICM workbench

The workbench implements the Independent Chip Model for arbitrary non-negative stacks and payout vectors. It can compare the Hero's current/fold tournament equity with win/lose all-in states and derive an ICM break-even equity and risk premium.

This is a structural ICM model, **not** FGS and not a replacement for a full tournament solver tree.

## Truth hierarchy

Existing Strategy Engine v2.1 trust tiers remain authoritative:

1. `verified-solver`
2. `expert-baseline`
3. `heuristic-estimate`

Unsupported strategy nodes must remain unsupported instead of silently substituting a different format, position, spot, stack depth, or ICM context.

## Real-hand feedback loop

Hand Lab can mark an analyzed hand as a real-table leak. The record is written into History v4 with inferred skill ids; subsequent Expected Learning Value calculations therefore raise the priority of sibling drills that exercise the same capability.
