# Training Review and Curriculum Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans and test-driven-development for each owned subsystem. User has authorized implementation, merge and deployment after verification.

**Goal:** Resolve the confirmed November 14 review findings and provide usable Cash and MTT curricula with repeatable, unseen assessments.

**Architecture:** Preserve explicit provenance and distinguish conditional coaching from exact arithmetic. Fix independent math, persistence and learning subsystems in parallel; integrate curriculum and assessment changes against the same track filters.

**Tech Stack:** TypeScript, React, Vite, Node 24, npm 11.16.0, GitHub Pages.

**Spec:** Confirmed review in the task's `outputs/review-2026-11-14.md` and user instruction to fix in priority order, complete both curricula, test, merge and deploy.

## Global Constraints

- Never invent solver EV, frequencies, ranges or unknown table metadata.
- Keep unseen holdout data out of practice; exposed holdouts may be reviewed without becoming new assessment evidence.
- Preserve earned payouts and distinguish chip EV, prize EV, seat probability and immediate PKO bounty value.
- No production deployment before tests and independent review pass.

## Review Focus

- Board-only made hands and draws that fail to improve Hero's best five cards.
- Delayed persistence, reload and generic drill histories across track switches.
- Failed delayed/transfer validation hidden by repeated rehearsal successes.
- Exhausted assessments and preference combinations that silently produce no lessons.
- Complete ICM rosters and long histories freezing the browser.

## Tasks

### 1. Hand math and ICM scalability
- [x] Reproduce board-only pair, made-flush phantom outs and 11-player ICM cases in regression tests.
- [x] Correct best-five comparisons and bound/memoize exact ICM computation.
- [x] Verify payout, PKO and FGS regressions.

### 2. Context and drill records
- [x] Reproduce delayed-storage solver context mismatch and missing range/counterfactual track histories.
- [x] Pass immutable solver context and explicit intrinsic format when storing drills.
- [x] Verify real browser persistence and reload behavior.

### 3. Learning evidence and selector
- [x] Reproduce exposed holdout review starvation and false advanced mastery.
- [x] Keep exposed holdouts reachable only for review; require successful independent validation for mastery.
- [x] Index history once per selection and verify selection semantics and large-history performance.

### 4. Cash/MTT curriculum and assessment continuity
- [x] Add regression tests for usable preflop, postflop, short-stack and bluff-catching lessons on both tracks.
- [x] Add explicit, audited conditional lessons with correct table/effective-stack metadata and truthful grading.
- [x] Repair authored multi-street branches and use effective stack in preferences.
- [x] Generate balanced new MTT numerical assessments with stable unique identities and exposure filtering.
- [x] Display curriculum coverage and unsupported filter combinations honestly.

### 5. Release
- [x] Run Node 24 checks, build, bundle budget, dependency audit and browser regression tests.
- [x] Obtain independent whole-branch review and resolve actionable findings.
- [ ] Open PR, verify CI, merge with expected head SHA and monitor both deployment workflows.
- [ ] Confirm live HTML/assets match the deployed commit and complete Cash/MTT production flows.

## Review and verification record

Independent review resolved hidden preconditions, stale later-street stack context, residual authored feedback contradictions, ante accounting, FGS composed runtime, and exposed sibling-review starvation. Cash arithmetic is derived from the displayed quantized inputs. The catalog retains stable legacy IDs and reports48 distinct cash math inputs separately from64 rendered lessons.

Local acceptance includes3Cash and6MTT selected courses, one25-question Cash exam, two25-question MTT exams with50distinct identities and6–7questions per utility model, and14persisted range/counterfactual records partitioned7Cash/7MTT afterreload. Held-Web-Lock solver contexts remain tied to the submitted row.

Deployment completion is recorded in the PR and release report after remoteCI/Pagesverification, rather than presumed here.
