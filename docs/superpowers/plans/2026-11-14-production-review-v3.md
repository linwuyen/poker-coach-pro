# Production Review V3 Implementation Plan

**Goal:** Fix the eight confirmed production review issues, extend MTT turn and Cash 9-max/short/deep-stack curricula, and release after verification.

**Spec:** User-approved findings and fixes in `outputs/review-production-v3-2026-11-14.md` in the enclosing task workspace; user explicitly authorized implementation, merge, deployment and live acceptance.

**Architecture:** Preserve React/TypeScript training and evidence models. Validate numeric input without changing player identity; provide decision context; generate enough preference-compatible unseen assessments; reconnect drill reviews; scope skills by track; separate player/effective stacks; use answer-independent options. Add conditional coaching lessons with explicit assumptions, legal actions and audited pot/stack arithmetic.

**Execution:** Parallel ownership of independent subsystems in the existing dedicated task checkout on `codex/production-review-v3`; root integrates and obtains independent review. No additional design approval is needed for these already-authorized review fixes. No fabricated solver values or invented hidden metadata.

## Tasks

- [x] Input safety: reject an entire invalid ICM roster/payout list, preserve whitespace and player indices, validate finite bounded integer equity iterations in UI and engine. Add regression tests before fixes.
- [x] Decision context: show pot, preflop/postflop actions and known/unknown stacks before contrastive grading; test rendered context and evidence eligibility.
- [x] Assessment and learning: refill MTT exams under preferences, keep identity/exposure/model balancing, make due Range/Counterfactual reviews actionable, scope skill ranking by Cash/MTT. Test restrictive preferences, replay identity, persistence and track switches.
- [x] Curriculum: separate Hero/Villain/effective remaining stacks; remove answer-position dependence; add MTT turn second barrels/draw changes/SPR and Cash 9-max/20-40BB/>100BB lessons with contrasting decisions. Test coverage, legal cards/actions, arithmetic and reachable training.
- [x] Acceptance: run Node 24 check, build, bundle budget, audit and browser regressions; independent whole-branch review and resolve material findings.
- [ ] Release: push branch, create PR, await CI, merge expected head; monitor deploy and Pages; verify deployed assets and both live training flows including lessons/exam/history.

## Review Focus

- Invalid middle tokens must never silently shift player IDs; whitespace must not create zero-stack players.
- Restrictive supported table/depth combinations must fill exams, avoid exposed identities and remain bounded in runtime.
- Due drill attempts must remain review evidence, replay the same question and persist once across reload/track switches.
- Lesson pots, current player stacks and effective depth must agree; strategic grades must be qualified by visible assumptions.
- Numeric iteration validation must reject Infinity/NaN/fractions and unreasonable work before entering synchronous loops.

## Verification ledger

- Baseline: clean checkout at `2179e7b`; previous same-SHA review check passed 314 tests. Origin main matches baseline.

- Node 24 `npm run check`:342/342 tests passed; web build and bundle budget passed; dependency audit reported0 vulnerabilities.
- Independent review:47 targeted regression tests and30 restrictive MTT profile probes passed; no remaining material findings.
- Browser acceptance:20 selectable lessons (9 Cash/11MTT), four completed25-question exams (100decisions), restrictive6max/40-100BB exam refill, contrastive context, invalid ICM/Equity recovery, Cash/MTT practice and persistence passed.
- Runtime acceptance:held-history-lock context,14 initial drill records, original Range/Counterfactual replay on both tracks, delayed-review-only evidence, rescheduling and reload passed.
- Release results are recorded in the PR and enclosing workspace release report after remoteCI and live deployment verification.
