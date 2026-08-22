# Volume-first Automatic Coach

## Product contract

Poker Coach Pro is a self-contained poker decision practice table. The normal loop is deliberately small:

```text
Today
  ↓
Start / Continue
  ↓
Infinite Hand Generator
  ↓
Fold / Check / Call / Bet / Raise / Jam
  ↓
automatic History + scheduling
  ↓
answer explanation + evidence
  ↓
player explicitly chooses Next
  ↓
next decision
  ↓
repeat
```

The player is not expected to operate truth ingestion, solver diagnostics, randomized experiment controls, workspace diagnostics, population/exploit imports, or any real-game / Hand History workflow during normal training.

## Player surface

The primary shell exposes only:

1. **Today** — start/continue and a compact current-leak summary.
2. **Train** — one truth-constrained Infinite Hand Generator.
3. **Progress** — improvement, current leak, retention/transfer and recent decisions.

Advanced training tools remain separate routes, but after a decision they are discoverable from the explanation surface and open in a new tab so the current hand is preserved.

## One action is enough

A normal decision must not require auxiliary forms before the poker action. Confidence is optional evidence rather than a mandatory gate.

```text
spot shown
  ↓
player chooses action
  ↓
history is recorded automatically
  ↓
explanation is shown
```

If confidence was not collected, the system leaves it absent. It must never synthesize a default value.

## Feedback policy

- Correct and incorrect decisions both stop on the current hand and show an explanation.
- The trainer never auto-advances away from an answer explanation; only an explicit **Next** action advances.
- Scenario feedback shows the core reason, misconception, portable rule, local hand/math context, available range/EV/truth evidence, and why alternative options differ.
- PokerBench feedback shows the exact optimal label for every answer, including correct answers, plus card visuals, local hand/math context, option-by-option label comparison and provenance limits.
- PokerBench does **not** infer a node-specific strategic rationale from the action label. If the dataset provides only an optimal label, the explanation stays at label comparison and provenance.
- Local draw math counts only draws in which Hero contributes to the relevant flush/straight structure; a four-flush or four-straight entirely on the board is not presented as Hero outs.
- Missing per-action EV, mixed frequency, range evidence or solver rationale remains explicitly missing; the UI never fabricates solver precision.
- Advanced Range / Boundary / Equity / Solver tools are discoverable after the answer and open separately without destroying the current explanation.
- The answer surface captures a portable **Analysis Context** containing only observed or already-validated fields such as hole cards, board, street, position, pot, effective stack, chosen/best action and truth provenance. Context-aware tools prefill those exact fields; missing villain range, Hero equity, solver EV or frequency remains missing.
- A mistake queues up to three structurally related repair decisions from the same already truth-gated Infinite pool before normal sampling resumes. If fewer safe siblings exist, the repair queue is shorter; no new answer is synthesized.
- Semantic counterfactual / understanding-check reveals also stop for explicit review. Even when both A/B decisions are correct, the user chooses when to continue.

## Infinite curriculum

The live table draws from three evidence-safe mechanisms without exposing separate modes:

```text
216 scenario inventory
+ 528 strategy-equivalent variant inventory
+ PokerBench training-partition solver rows
            ↓
truth + holdout gate
            ↓
exact presentation dedupe
            ↓
64-hand exact cooldown
+ decision-family cooldown
            ↓
street / position / action / stack / format novelty
            ↓
trainer leak / due-review adaptive weighting
            ↓
next decision

mistake
  ↓
up to 3 structurally related candidates
from the same truth-gated pool
  ↓
resume normal Infinite sampling
```

The novelty layer prevents apparent volume from collapsing into repeated versions of the same strategic situation. It changes sampling only; it never changes or interpolates the correct answer.

Truth provenance remains distinct even when the UI presents everything as one table:

- curated scenario: validated teaching truth;
- safe variant: strategy-equivalent truth only;
- PokerBench: pinned training-partition solver optimal label.

If a candidate cannot prove one of those truth paths, it is not eligible for the live table or the targeted repair queue.

## Real-game retirement

The product is not a real-game tracker. It does not require PokerStars/GGPoker/other client integration or Hand History import.

The real-game subsystem, companion hand-state bus and real-money coaching path are retired. Training History stores decisions made inside this product only. Learning priority and longitudinal coaching therefore describe trainer performance, not bankroll win rate or observed live-table BB/100.

## Exploit boundary

The primary product teaches best play from validated theory / solver truth. Manual Population Exploit JSON import is not a player workflow and the old exploit workbench route is retired.

Research code may model theory-vs-exploit evidence internally, but it cannot alter a live training answer without its own valid truth contract. The Infinite Hand Generator never invents an exploit answer from player mistakes or heuristics.

## P0→P30 relationship

Earlier P0→P30 work produced useful learning/truth primitives. The product now reuses the pieces that improve a self-contained training table, such as:

- truth hierarchy and fail-closed behavior;
- hidden benchmark isolation;
- solver corpus partitioning;
- semantic counterfactual logic;
- due review and expected learning value;
- History mastery / retention / transfer evidence;
- immutable solver provenance;
- local Hero-contributing hand-strength / draw math;
- portable per-decision Analysis Context;
- contextual range / equity / decision-boundary / solver workbenches;
- immediate truth-backed targeted repair after mistakes;
- local generator/truth reliability telemetry.

Mechanisms that existed specifically to ingest or interpret external real-game evidence are not part of the product architecture.

## First-run rule

First run must be playable without a questionnaire. Player preferences are optional filters/settings, not prerequisites to start training.

## Non-goals

Volume-first does not mean:

- reward raw hand count regardless of learning value;
- skip explanation just because the answer was correct;
- auto-advance semantic/counterfactual reveals before the player reads them;
- auto-grade unsupported states;
- manufacture solver EV/frequencies or action-type rationale;
- treat board-only draws as Hero outs;
- inject a default villain range merely to make an equity calculator return a number;
- mutate stack/position/sizing/range/board and inherit an old answer without truth;
- leak sibling/holdout data into training or repair queues;
- infer confidence that was never supplied;
- reconnect to real poker clients;
- report trainer frequency priors as real-world win rate.

The target is **maximum high-quality decision volume with minimum pre-decision friction, explicit post-decision learning, and evidence-safe ground truth**.
