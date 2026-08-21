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
next decision
  ↓
repeat
```

The player is not expected to operate truth ingestion, solver diagnostics, randomized experiment controls, workspace diagnostics, or any real-game / Hand History workflow during normal training.

## Player surface

The primary shell exposes only:

1. **Today** — start/continue and a compact current-leak summary.
2. **Train** — one truth-constrained Infinite Hand Generator.
3. **Progress** — improvement, current leak, retention/transfer and recent decisions.

## One action is enough

A normal decision must not require auxiliary forms before the poker action. Confidence is optional evidence rather than a mandatory gate.

```text
spot shown
  ↓
player chooses action
  ↓
history is recorded automatically
```

If confidence was not collected, the system leaves it absent. It must never synthesize a default value.

## Feedback policy

- Correct decisions show compact confirmation and auto-advance.
- Meaningful mistakes pause the table and show the portable rule first.
- Deep range / EV / truth evidence remains optional disclosure.
- A mistake automatically changes future sampling; the player does not choose a repair tool.

## Infinite curriculum

The current live table draws from three evidence-safe mechanisms without exposing separate modes:

```text
216 scenario inventory
+ 528 strategy-equivalent variant inventory
+ PokerBench training-partition solver rows
            ↓
truth + holdout gate
            ↓
exact presentation dedupe
            ↓
recent-repeat cooldown
            ↓
leak / review adaptive sampling
            ↓
next decision
```

Truth provenance remains distinct even when the UI presents everything as one table.

## Real-game retirement

The product is no longer a real-game tracker. It does not require PokerStars/GGPoker/other client integration or Hand History import.

Old real-game runtime routes have been retired. Historical modules may temporarily remain as isolated testable code until dead-code cleanup, but they are not dependencies of the player runtime or the Infinite Hand Generator.

## P0→P30 relationship

Earlier P0→P30 work produced useful learning/truth primitives. The product now reuses only the pieces that improve a self-contained training table, such as:

- truth hierarchy and fail-closed behavior;
- hidden benchmark isolation;
- solver corpus partitioning;
- semantic counterfactual logic;
- due review and expected learning value;
- History v6 mastery / retention / transfer evidence;
- immutable solver provenance.

Mechanisms that existed specifically to ingest or interpret external real-game evidence are not part of the player workflow.

## First-run rule

First run must be playable without a questionnaire. Player preferences are optional filters/settings, not prerequisites to start training.

## Non-goals

Volume-first does not mean:

- reward raw hand count regardless of learning value;
- auto-grade unsupported states;
- manufacture solver EV/frequencies;
- mutate stack/position/sizing/range/board and inherit an old answer without truth;
- leak sibling/holdout data into training;
- infer confidence that was never supplied;
- reconnect to real poker clients.

The target is **maximum high-quality decision volume with minimum player input and evidence-safe ground truth**.
