# V10 — Training-first convergence

## Product decision

Poker Coach Pro is a training system, not a live poker assistant.

The primary user loop is:

1. The coach selects or the user chooses a training scenario.
2. `TrainingSession` presents one decision at a time.
3. The current scenario is synchronized through `HandStateBus`.
4. Before the user answers, the training assistant may preserve context and retrieval prompts but must not reveal the strategy answer.
5. After the user answers, feedback, strategy, EV context and the most relevant follow-up instrument may be shown.
6. The result feeds history, weakness detection and future session planning.

## First-principles constraints

### 1. One primary job

The application exists to improve future poker decisions through deliberate practice. Features that do not improve the training loop are secondary implementation tools, not primary navigation concepts.

### 2. Retrieval before revelation

A training question has value only if the learner must retrieve a decision before seeing the answer. Therefore the assistant keeps strategy frequencies and EV locked while the current training decision is unanswered.

### 3. Tools are downstream of a decision

Range, Equity, Boundary, ICM, Contrastive and Solver surfaces are instruments for explaining or correcting a training decision. They are not competing top-level products.

### 4. Real-game adapters are infrastructure

`play-money`, `replay`, `completed-real-hand`, `live-real-money` and the manual adapter remain available to the underlying architecture and safety tests, but they are not part of the normal production training UX.

### 5. Preserve the proven data path

This convergence deliberately keeps the existing data flow:

`TrainingSession -> HandStateBus -> Advice Gate -> Strategy / Intervention`

The change is primarily a product-contract and presentation convergence, minimizing regression risk while making the intended use unambiguous.

## User-facing contract

The previous “開啟牌局 Companion” concept becomes “開啟訓練助手”.

The user-facing promise is:

- synchronize the current training question;
- do not reveal the answer before the learner commits;
- after the answer, explain the decision and expose only the analysis tools that help repair that specific leak;
- if no training question is active, instruct the user to start a training session rather than simulate an external game.

## Development-only diagnostics

The manual HandState adapter is rendered only in Vite development mode. This preserves adapter and safety-gate diagnostics without exposing implementation modes in production.

## Acceptance criteria

- No production navigation labels describe the assistant as a live or real-money game companion.
- The assistant empty state directs the user back to training.
- Unanswered training decisions do not reveal strategy frequencies or EV.
- Answered training decisions can unlock analysis and follow-up instruments.
- Existing real-money safety-gate logic remains intact for compatibility and tests.
