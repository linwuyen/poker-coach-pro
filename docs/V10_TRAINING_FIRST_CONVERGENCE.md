# V10 — Training-first convergence

## Product decision

Poker Coach Pro is a training system, not a live poker assistant.

The primary user loop is:

1. The coach selects or the user chooses a training scenario.
2. `TrainingSession` presents that scenario as a poker-table decision, not a generic quiz card.
3. The current scenario is synchronized through `HandStateBus`.
4. Before the user answers, the training assistant may preserve context and retrieval prompts but must not reveal the strategy answer.
5. After the user answers, feedback, strategy, EV context and the most relevant follow-up instrument may be shown.
6. The result feeds history, weakness detection and future session planning.
7. The next scenario is presented as the next training hand, preserving a continuous-session mental model.

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

The learning/history/scheduling path also remains intact:

`Decision -> HistoryItem -> Review Schedule -> Weakness / Mastery -> Future Session Plan`

The convergence changes the interaction surface without replacing already-tested learning logic.

### 6. Do not fabricate poker state

The table may visualize only state supported by the scenario schema or existing parsers. Hero stack, effective stack, pot, board, positions and parsed actions come from existing data. Unknown opponent stacks are not invented merely to make the table look realistic.

## User-facing contract

The previous “開啟牌局 Companion” concept becomes “開啟訓練助手”.

The user-facing promise is:

- starting training visibly opens a poker-table training environment;
- 6-max and 9-max scenarios use the existing seat geometry;
- the table shows Hero position/cards, board, pot, effective stack, action history, SPR/pot odds when available, and parsed opponent actions;
- the learner selects confidence before committing an action;
- the answer remains hidden until commitment;
- after commitment, the same session shows the learner's action versus the best action, explanation, conceptual leak, memory rule, EV leak when available, and relevant evidence;
- Range, Equity, Boundary, ICM, Contrastive and Solver become post-decision deep-dive tools;
- `下一手` continues the training session rather than implying navigation to an unrelated quiz;
- session completion reports accuracy, unseen accuracy, delayed retention, queued reviews, EV leak, top leak and strongest concept;
- if no training question is active, the assistant directs the user back to training rather than simulating an external game.

## Development-only diagnostics

The manual HandState adapter is rendered only in Vite development mode. This preserves adapter and safety-gate diagnostics without exposing implementation modes in production.

## Acceptance criteria

- A user who starts a training session can immediately distinguish the experience from the old generic quiz-card UI.
- The primary decision surface is a poker table with 6-max/9-max seats, Hero cards, board and pot.
- Existing seat-action parsing and folded-state logic are reused rather than duplicated.
- No production navigation labels describe the assistant as a live or real-money game companion.
- The assistant empty state directs the user back to training.
- Unanswered training decisions do not reveal strategy frequencies or EV.
- Answered training decisions unlock explanation and optional analysis instruments.
- Session history, spaced review, mastery, weakness detection and player-model writes remain unchanged in semantics.
- Existing real-money safety-gate logic remains intact for compatibility and tests.
- `npm run check` and `npm run build:web` must pass before this convergence is considered complete.
