# v8 Real-Game Measurement Engine

## Product objective

Poker Coach Pro is not optimized for quiz completion or feature usage. The objective is to reduce future real-game decision loss per unit of training time.

The v8 value model is conceptually:

`Training Value = Real Spot Exposure × Context-Matched Utility Regret × Probability Training Changes Policy × Retention × Transfer / Training Time`

## Evidence identity

v8 no longer joins evidence merely because two records share a skill label. Frequency and regret may be multiplied only when they resolve to the same structured context family and compatible game format.

New History v5 fields include:

- `gameFormat`
- `sessionId`
- `handsObserved`
- `spotExposureCount`
- `contextFamilyId`
- `evidenceFamilyId`
- `utilityLoss`
- `utilityUnit`
- `utilityModel`
- `transferLevel`

Legacy evidence without a context family may support only its exact original scenario.

## Utility contract

Cash utility is measured in BB when the source supports chip EV.

Tournament utility is deliberately separate. A tournament observation may use `$EV`, prize-pool share, or seat equity with an explicit utility model such as ICM, PKO, or satellite. Tournament chip-BB evidence is not silently converted into tournament utility.

A numeric gain is reportable only when:

1. real-game exposure is observed,
2. regret is context-matched,
3. the utility unit is compatible with the game format, and
4. the regret source is verified solver or exact math.

Everything else may still influence priority, but remains an estimate.

## Real-game ingestion

The Hand Lab writes structured History v5 evidence. It records session identity, context family, exposure denominator and utility unit rather than hiding these values in notes.

A post-session JSON importer provides a stable adapter boundary for future hand-history parsers and trackers. Platform-specific parsers should normalize into this contract instead of coupling directly to the scheduler.

The importer is intended for completed hands/sessions and study workflows. It is not a real-time assistance or automated live-table decision system.

## Learner model

Immediate repair is not treated as learning by itself. v8 separates:

- immediate repair,
- delayed retention,
- transfer success.

Retention and transfer receive stronger weight when estimating whether training will change future policy.

## Effective sample size

Repeated drilling of the same context has diminishing information value. Skill confidence uses effective sample size based on context diversity, temporal diversity, delayed review, transfer and truth quality rather than raw attempt count alone.

## Skill vs situation

Skill nodes model capabilities such as BB defense, pot odds, blockers, bluff catching or ICM.

Situation nodes model where the decision occurs: format, stack, position, street, pot type, sizing and texture. This allows diagnoses such as “River OOP paired-board bluff catch” rather than collapsing everything into one broad skill score.

## Transfer benchmark

Transfer is stratified into:

1. `near` — same underlying context with a nearby variation,
2. `context` — meaningful context change while preserving the concept,
3. `structural` — a new decision family / holdout regime.

This avoids treating all unseen questions as equally difficult generalization tests.

## Tools as interventions

The daily planner now attaches an intervention recommendation. Examples:

- due memory → delayed retrieval,
- sizing/action boundary error → Boundary Drill,
- high-confidence mental-model error → Contrastive Drill,
- tournament utility problem → ICM / $EV,
- range problem → Range Drill,
- math problem → Equity / Pot Odds,
- otherwise → Solver Curriculum.

The user should normally choose the training goal; the system chooses the diagnostic tool.

## Strategy Explorer and live play

Strategy Explorer remains a study and replay instrument for inspecting ranges, mixed frequencies, solver profiles and imported strategy data.

It may be placed beside a practice, replay or play-money environment as a study companion. v8 does not add screen scraping, automatic table-state detection, hotkey action advice or an overlay that tells a player what to do during an active real-money hand.
