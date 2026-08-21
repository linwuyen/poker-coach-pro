# Volume-first Automatic Coach

## Product contract

Poker Coach Pro is a poker decision practice table first. The normal player loop is deliberately small:

```text
Today
  ↓
Start / Continue
  ↓
Poker decision
  ↓
Fold / Check / Call / Bet / Raise / Jam
  ↓
next decision
  ↓
repeat
```

The player is not expected to operate Truth Ops, Evidence Ops, Production Intelligence, solver ingestion, population validation, randomized experiment controls, or workspace diagnostics during normal training.

## Player surface

The primary shell exposes only:

1. **Today** — one button to start/continue and a compact summary of the highest-value leak.
2. **Train** — one continuous adaptive training table.
3. **Progress** — improvement, current leak, retention/transfer and recent decisions.

Advanced diagnostic routes remain available for engineering and evidence inspection, but they are not part of the normal player navigation.

## One action is enough

A normal training decision must not require auxiliary forms before the poker action. In particular, confidence is optional evidence rather than a mandatory gate.

```text
spot shown
  ↓
player chooses action
  ↓
history is recorded automatically
```

If confidence was not collected, the system leaves it absent. It must never synthesize a default confidence value merely to preserve a downstream metric.

## Feedback policy

High-volume training depends on keeping low-information friction small.

- Correct decisions show compact confirmation and auto-advance.
- Meaningful mistakes pause the table and show one portable rule first.
- Deep range / EV / truth evidence is optional disclosure.
- A mistake automatically changes future scheduling; the player does not need to select a repair tool.

The intended loop is:

```text
play
  ↓
error detected
  ↓
record leak
  ↓
automatically increase matching review / transfer / boundary work
  ↓
play again
```

## Hidden curriculum

The training table may internally transition among several evidence-safe mechanisms without exposing them as separate player workflows:

```text
curated / due decision
      ↓
verified semantic counterfactual
      ↓
unseen training-partition solver decision
      ↓
continuous adaptive table
```

These phases remain distinct in storage and truth provenance even when the UI presents them as one table.

## P0→P30 relationship

P0→P30 are the internal learning and evidence control plane, not a list of tasks the player must perform.

Examples:

- truth lookup and ambiguity handling run in the background;
- due review and expected learning value affect scheduling automatically;
- semantic counterfactuals are inserted automatically when useful;
- population/exploit evidence remains separately validated;
- tournament evidence providers remain provenance-gated;
- workspace/reliability functions remain operational infrastructure;
- missing truth remains `Unknown` / `Unsupported`, never a plausible-looking answer.

Automation removes manual workflow. It **does not lower evidence requirements**.

## First-run rule

First run must be playable without a questionnaire. The default profile is intentionally broad across Cash/MTT, 6-max/9-max and stack bands. These values mean “do not filter yet”, not “the player told us these are preferences”. More specific preferences are optional settings.

## Non-goals

Volume-first does not mean:

- reward raw hand count regardless of learning value;
- auto-grade unsupported states;
- manufacture solver EV/frequencies;
- infer confidence that was never supplied;
- silently choose among ambiguous truth/evidence providers;
- remove advanced diagnostics needed to audit the system.

The target is **minimum player input with maximum evidence-safe automatic coaching**.
