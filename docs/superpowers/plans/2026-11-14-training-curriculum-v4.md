# Training curriculum v4 implementation plan

> For agentic workers: use subagent-driven-development with focused file ownership and an independent final review.

Goal: Fix the five production-review defects, add connected practice and unseen assessments, then test, merge, deploy and verify both formats.

Architecture: Extend the current Scenario/ScenarioStep and separate training/holdout catalog. Give each presentation independent lifecycle identity; give each decision explicit validated skill attribution. Keep conditional coaching separate from exact-math or verified solver evidence.

Tech stack: existing React 19, TypeScript, Node 24, tsx tests, Vite and GitHub Pages.

Spec: User-approved findings and recommendations in the external outputs/review-production-v4-2026-11-14.md. User explicitly authorized implementation, merge and production deployment after passing checks. Existing repository is a clean dedicated checkout; work on fix/training-curriculum-v4.

Constraints: No fabricated solver EV. Keep legacy course IDs/history usable. Use current-street cards and audited pot/stack accounting. Never admit holdout families into practice. Do not change unrelated settings or services.

Review focus: repeated same candidate; alternative answer followed by a continuation; old skill history; short/deep strict profile assessments; hidden future cards/answer information before a decision.

## Task 1: Session lifecycle and answer information
- [ ] Add a failing lifecycle regression that completes the same selected candidate twice and verifies a new playable decision.
- [ ] Increment presentation identity on every selection (scenario and solver), keep an accessible exit, remove pre-answer best-action class from UI.
- [ ] Verify multi-step continuation state resets while preserving per-step attempt identity and persistence. Only show current step's board/state/actions.
- [ ] Test and report. Ownership: training sessions/InfiniteTrainingTable plus dedicated regression tests.

## Task 2: Curriculum and explanations
- [ ] Reproduce contradictory accepted alternatives and missing known call price in tests.
- [ ] Fix actual-premise scoring; preserve changed-premise alternatives as distinct teaching context. Derive potOdds from audited positive call costs; do not render a red error for a correct answer.
- [ ] Add explicit ScenarioStep.skillIds (root supplies type and mapping), including precise skills for all practical lessons.
- [ ] Add MTT Turn-to-River practice (at least value and draw/changed river cases), 9-max multiway responses after opponent action, and paired short/deep-stack decisions with audited state and explicit conditions. Use valid multi-step continuations; never imply the learner selected an action they did not select.
- [ ] Verify ledger, card legality, prompt/answer premise agreement, reachability and per-step skills. Ownership: practicalLesson/practicalCurriculum/expandedPracticalLessons, new teaching modules and dedicated curriculum tests.

## Task 3: Unseen assessment coverage
- [ ] Add failing strict-profile coverage tests for Cash 6max/9max short and deep stacks and MTT Turn.
- [ ] Add genuinely held-out decision families, with no practice equivalents or answer-revealing titles. Grade only according to available evidence; conditional coaching must not be presented as solver truth or inflate exact EV metrics.
- [ ] Preserve exam exposure filtering, no feedback until completion, track separation and fallback honesty. Integrate new assessments into real user-facing exam entry points.
- [ ] Test disjointness, supported preference combinations, changed-context decisions and scoring. Ownership: assessment/catalog components and dedicated tests; coordinate shared catalog changes.

## Task 4: Skill attribution and compatibility (root)
- [ ] Reproduce Cash 9max 3bet misattribution and Cash push-fold contamination.
- [ ] Add optional explicit step skillIds with validation, street/format constraints and careful legacy fallback.
- [ ] Ensure persisted practical-course attempts are reassigned from current step definitions where safely identifiable; preserve history/schedules and avoid granting unseen evidence.
- [ ] Verify correct skill evidence and format isolation for new and existing records.

## Task 5: Integration and release
- [ ] Independent review of curriculum/math, flow and held-out evidence; resolve actionable issues.
- [ ] Run npm run check, production build, bundle budget, audit and required browser/runtime checks under Node24.
- [ ] Create PR with final scope and validation, wait for all required remote checks, merge exact reviewed head and await Pages deployment.
- [ ] Verify deployed SHA/assets and real production Cash/MTT flows, repeated same candidate, new connected lessons, feedback prices and hidden exams.
- [ ] Record final results, limitations and links in release report.
