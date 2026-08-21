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

The player is not expected to operate truth ingestion, solver diagnostics, randomized experiment controls, workspace diagnostics, population/exploit imports, or any real-game / Hand History workflow during normal training.

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
```

The novelty layer prevents apparent volume from collapsing into repeated versions of the same strategic situation. It changes sampling only; it never changes or interpolates the correct answer.

Truth provenance remains distinct even when the UI presents everything as one table:

- curated scenario: validated teaching truth;
- safe variant: strategy-equivalent truth only;
- PokerBench: pinned training-partition solver optimal label.

If a candidate cannot prove one of those truth paths, it is not eligible for the live table.

## Real-game retirement

The product is not a real-game tracker. It does not require PokerStars/GGPoker/other client integration or Hand History import.

The real-game subsystem, companion hand-state bus and real-money coaching path are retired. Training History stores decisions made inside this product only. Learning priority and longitudinal coaching therefore describe trainer performance, not bankroll win rate or observed live-table BB/100.

## Exploit boundary

The primary product teaches best play from validated theory / solver truth. Manual Population Exploit JSON import is not a player workflow and the old exploit workbench route is retired.

Research code may model theory-vs-exploit evidence internally, but it cannot alter a live training answer without its own valid truth contract. The Infinite Hand Generator never invents an exploit answer from player mistakes or heuristics.

## P0→P30 relationship

Earlier P0→P30 work produced useful learning/truth primitives. The product now reuses only the pieces that improve a self-contained training table, such as:

- truth hierarchy and fail-closed behavior;
- hidden benchmark isolation;
- solver corpus partitioning;
- semantic counterfactual logic;
- due review and expected learning value;
- History mastery / retention / transfer evidence;
- immutable solver provenance;
- local generator/truth reliability telemetry.

Mechanisms that existed specifically to ingest or interpret external real-game evidence are not part of the product architecture.

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
- reconnect to real poker clients;
- report trainer frequency priors as real-world win rate.

The target is **maximum high-quality decision volume with minimum player input and evidence-safe ground truth**.
