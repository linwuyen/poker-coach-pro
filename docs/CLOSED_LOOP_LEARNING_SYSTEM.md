# Closed-Loop Learning System

## North Star

The product is not optimized for answer count or training accuracy. The primary measurable target is:

`verified hidden / transfer EV loss per decision`, divided by actual training time when a before/after comparison is available.

Only evaluation attempts with exact-math or verified-solver truth, cash-game BB utility, and real `evLossBB` evidence enter this metric. PokerBench rows that contain only an optimal action label remain accuracy evidence; they never receive invented EV. Hidden Exam / holdout time is evaluation cost, not training time, and is excluded from the Learning ROI denominator.

Training time has a strict evidence contract. `durationMs` is decision latency only: question shown → action submitted. Learning ROI does **not** use or fall back to it. The denominator uses `trainingDwellMs`, measured from the question becoming active until the player explicitly chooses **Next**, so explanation reading and any required reasoning probe are included. An incomplete hand without explicit Next has no complete dwell sample and contributes no invented training time.

## Control loop

1. **Hidden Exam / holdout** measures performance without immediate feedback.
2. **Knowledge State** estimates understanding, delayed retention, transfer, reasoning evidence, sample uncertainty, and data gaps per skill.
3. **Active Learning** chooses the next truth-backed candidate from uncertainty, EV severity, due pressure, transfer gap, reasoning gap, spot frequency, and coverage novelty.
4. **Decision + explanation** keeps the player-facing action loop low-friction.
5. **Reasoning probe** is occasional, post-answer, and only appears when an exact-math reversal can support an objective answer. A correct action with a failed reversal check is marked fragile knowledge.
6. **Minimal Flip** shows where the decision changes, but only from scenario-owned exact reversal evidence or a PokerBench pair where exactly one semantic dimension changes and the pinned optimal label flips. If an exact scenario has multiple alternative actions but the evidence does not identify which one owns the reversal, the engine does not guess a target action.
7. **Targeted repair** schedules up to three truth-gated structural siblings after either a wrong action or a failed reasoning probe.
8. **Delayed retrieval / transfer** feeds the knowledge state again.
9. **Calibration** compares the active selector's predicted action-success probability with actual decisions using Brier score and reliability bins; reasoning weakness is tracked separately as a priority signal.
10. Repeat with another hidden exam.

## Coverage

Two complementary coverage views remain visible:

- **Skill Knowledge State** tracks understanding, retention, transfer, reasoning, uncertainty, evidence count, and priority across the skill graph.
- **Poker State-Space Coverage** compares catalog supply and player evidence across situation ids such as format, position, stack, street, board/sizing/boundary contexts, including zero-evidence and zero-training-bank data gaps.

Skill attribution is decision-local. A scenario attempt receives only the skills implied by the **current step's** concepts and street. A multi-street scenario must never credit a preflop answer with skills that appear only on a later flop/turn/river step. The same rule applies to Hidden Exam evidence.

## Evidence boundaries

- Missing per-action EV stays missing.
- Missing mixed solver frequencies stay missing.
- Missing solver rationale stays missing.
- No approximate board, range, or sizing similarity is promoted to a decision boundary.
- A raw percentage is not a call threshold unless the decision semantics establish a facing-call price.
- Holdout questions never enter the normal infinite training pool.
- Exam mode waits for its full mixed holdout pool before question one, then keeps the sequence stable for that exam.
- Exam mode withholds correctness, explanation, and analysis tools until the exam ends.

## Product interpretation

Training accuracy is a diagnostic signal, not the objective. A skill is most valuable to train when the system is uncertain about it, the decision can carry meaningful utility loss, transfer or reasoning is weak, or a review is due. A skill or state-space context with no evidence remains visible as a data gap rather than being assigned fake mastery.