# v7 Converged Coach

## Product objective

Poker Coach Pro optimizes future decision quality, not feature usage or raw quiz accuracy.

The default user loop is now intentionally small:

1. **今天** — show the next highest-value action and start immediately.
2. **訓練** — choose only a broad training direction; advanced tools are secondary instruments.
3. **進度** — review due material, inspect leaks, record real hands, and use diagnostics when needed.

Solver, Range, Equity, Boundary, ICM, Contrastive, Holdout and Strategy Surface remain available, but no longer compete for top-level navigation.

## Evidence contract

`Expected EV Gain` is only user-visible when evidence is strong enough to support a numeric claim.

- **Priority estimate** may use heuristic priors for ranking.
- **Observed frequency** comes from real-hand/session observations (`spotFrequencyPer100Hands`).
- **Observed regret** requires actual recorded EV loss.
- **Verified gain** requires both observed real-world frequency and regret backed by `verified-solver` or `exact-math` evidence.
- Tournament spots remain priority-ranked until the product has a compatible `$EV` utility; chip `BB/100` is not presented as tournament `$EV`.

This keeps useful priors for scheduling without turning them into false precision.

## Real-game feedback loop

The manual Hand Lab now accepts:

- session hand count
- number of similar spots observed

and stores empirical spot frequency with the `real-hand` history item. The scheduler prefers this observation over static spot-frequency priors when related skills are ranked.

The intended loop is:

`Real Hands -> Observed Leak -> Training -> Delayed Recall / Transfer -> Real Hands`

A future hand-history importer can feed the same history contract without replacing the learning engine.

## Holdout isolation

PokerBench corpus roles are assigned by deterministic **context family**, not row ID. Rows that share the same observable decision context stay in the same partition even if the exact holding or row ID differs.

This reduces interpolation leakage between training and holdout and makes the benchmark closer to a transfer test.

## Improvement probability

The error model keeps diagnostic priors for sparse data, but begins updating repair probability from observed wrong-to-next-attempt transitions. A beta prior prevents unstable estimates when sample size is small.

## Rollback boundary

The change is isolated to the v7 branch. Existing advanced lab routes remain intact and can be accessed through the consolidated toolboxes. Reverting the branch restores the v6 navigation and scheduler presentation without requiring history migration.
