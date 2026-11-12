# Training Trust and Cash/MTT Tracks Implementation Plan

> **For agentic workers:** Use the task ownership below, regression tests before fixes, and an independent whole-change review. The user authorized implementation of the preceding audit and both training tracks.

**Goal:** Remove misleading poker information and assessment, and make cash and tournament practice match the selected learning context.

**Architecture:** Keep the existing React/TypeScript application. Centralize visible solver context, preserve tournament payout state, use explicit practice-track constraints, and distinguish label agreement, authored teaching and verified arithmetic. Existing history remains readable; invalid legacy transfer claims are not counted as new evidence.

**Tech Stack:** React 19, TypeScript, Vite, node:test via tsx; no new runtime dependencies.

**Spec:** The six prioritized findings in the preceding chat, explicitly accepted by the user on 2026-11-12. Include overdue-review and revealed-reasoning-answer defects discovered in that audit.

## Global Constraints
- Preserve the current app and stored history. Do not fabricate solver frequencies, EVs, rake assumptions or tournament range solutions.
- Cash and MTT use separate candidate pools, review evidence and evaluation reporting. Unknown context must not silently pass a strict preference filter.
- Show only information available at the decision street everywhere: training, exam, fingerprints and analysis.
- Use exact mathematical teaching exercises only under displayed assumptions; authored heuristics must be labeled as such.
- User authorized changes and testing; prepare a reviewable branch and deliverable. No production deployment is included.

## Review Focus
- Source CSV includes future cards and historical cache keys/fingerprints may include them.
- Zero-stack tournament players can already have won a payout; simultaneous eliminations need a stated policy.
- Existing history can falsely label repeat solver practice as structural transfer.
- Strict filters can yield no questions; show a useful empty state, never silently substitute another track.
- Exams must not become practice, repeated exposure must not inflate unseen performance, and MTT $EV must not be reported as cash BB.

## Tasks
- [x] 1. Solver visibility and honest label grading (corpus worker): add regressions with the actual flop/turn source shapes; normalize visible boards at ingestion and on direct-row consumers; cover all analysis/fingerprint/exam uses; record label mismatches without unsupported severity; ordinary solver practice is not structural transfer.
- [x] 2. Tournament payouts and exercises (strategy worker): reproduce heads-up 60/40 prizes, equal stacks, 55% equity; preserve bust-out prizes and total payout through ICM/PKO/FGS, reject ambiguous elimination histories; add explicit-assumption cash-independent MTT arithmetic practice and held-out exercises.
- [x] 3. Cash/MTT tracks (learning worker): persist selected track, wire format/table/stack/focus preferences into candidates, repairs and exams; scope dashboard history; distinguish source context limits; show empty states and curriculum guidance.
- [x] 4. Teaching and learning integrity (root): fix scenario 81 ledger and concrete teaching errors; mark authored rules conditional; normalize accepted alternatives; fix latest-review scheduling and first-exposure transfer metrics; put unaided reasoning before its explanation; narrow metric labels to measured ability.
- [x] 5. Integrate and verify (root): run targeted regressions, npm run check, production build, browser flow checks and corpus probe; independent review, resolve important findings, create reviewable delivery.

## Validation Contracts
- Flop has exactly 3 visible board cards, turn 4, river 5; changing future cards cannot change a current decision fingerprint.
- Heads-up [10,10], payouts [60,40], risk10, equity0.55 => lose40, call51, fold50, threshold50%.
- Repeating a solver practice row never increases structural-transfer sample count; successful review clears old due state.
- Cash-only and MTT-only sessions cannot emit the opposite format; unavailable preferences are surfaced explicitly.
- Mathematical MTT results retain their proper utility unit and never enter cash-BB ROI.
- Full existing checks and meaningful new regression tests pass, with any changed expectations documented.


## Integration and review notes
- Independent review found and verified fixes for migrated-row exam exposure, legacy Cash history, all transfer consumers, strict effective-stack filters, reasoning answer cues, arithmetic skill attribution, non-pot analysis context, and unsupported label diagnoses.
- Stable dataset scheduling additionally prevents old fingerprint review dates from remaining overdue after a successful corrected-context review.
- Catalog expectations changed from 216 rendered scenarios / 152 families to 228 / 164 because of 12 MTT utility practice exercises. Eight MTT evaluation exercises remain outside practice inventory.
- Existing source-string assertions were updated to the new track-aware/atomic exam flow; behavior regressions exercise the actual exposure and commit helpers.
- Required CI dependency audit found vulnerable locked versions. Only compatible updates within the existing package.json constraints were applied; the final audit reports zero vulnerabilities.
- Final local runtime: Node 24.22.3 / npm 11.16.0. `npm run check`: 277 tests passed, including typecheck, validators, truth/surface/reachability audits and selector benchmark. Production build and bundle budget passed (largest chunk below 300 KiB).
- Pinned 10,000-row postflop corpus replay: zero future-board leaks in the active pool. Heads-up [10,10] / [60,40] / 55% regression: fold50, lose40, call51, threshold50%.
- Final Windows Chrome browser E2E passed using Node 24.22.1: Cash25 / MTT8 completed exam records retain their respective formats, MTT practice and track persistence pass, observed boards match streets, probe/tool gating and high-confidence label-mismatch diagnostics pass.
