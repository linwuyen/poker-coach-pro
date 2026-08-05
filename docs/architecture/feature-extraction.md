# Incremental feature extraction

`src/App.tsx` currently coordinates training, GTO quiz, custom-hand review, analytics, AI coaching, settings, sound, table rendering, and responsive panels. A full rewrite would create unnecessary regression risk, so extraction proceeds through tested seams.

## First seam: persistent settings

`src/features/settings/persistence.ts` owns:

- safe localStorage access;
- parse/serialize contracts;
- fallback behavior for corrupted values;
- typed enum, boolean, number, JSON, and session-size codecs;
- persistence for functional React state updates.

The App remains the UI coordinator, but it no longer owns repeated storage try/catch and unchecked type casts for shuffle, AI mode, table size, session size, mute, volume, and bookmarks.

## Next seams

1. `features/ai-coach/` — analysis state, loading phrases, follow-up conversation, online/offline provider boundary.
2. `features/gto-quiz/` — quiz generation, score/streak/stat persistence, and quiz view.
3. `features/custom-hand/` — card-picker state, validation, API request, and result panel.
4. `features/training-session/` — scenario queue, current step, scoring, review schedule, and history recording.
5. `features/table/` — seat derivation and table rendering.

## Extraction gate

Every extraction must:

- preserve existing storage keys and user data;
- add tests for pure state/codec behavior;
- pass TypeScript, scenario validation, unit tests, and production build;
- avoid mixing visual redesign with state ownership changes;
- reduce App responsibility rather than only moving code into an unused file.
