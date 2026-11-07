---
id: T29
title: "Make the double-click, held-key, second-launch and relaunch e2e tests able to fail"
layer: "tests"
deps: ["T27"]
blocks: []
acs: ["AC-02", "AC-13"]
files_hint: ["e2e/timer.spec.ts"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---

# T29 — Make the double-click, held-key, second-launch and relaunch e2e tests able to fail

Follow-up from the review: finding(s) N1 (e2e), N2, N6, N7 in [review-2026-11-07.md](../_review/review-2026-11-07.md). The finding states the problem and the agreed resolution; the ACs are in [spec.md](../spec.md) §5 and the test rows in [test-plan.md](../test-plan.md).

## Definition of Done

- [x] each double-click step asserts that `document.elementFromPoint` at the pointer is a control button before the second press; a Skip double-click lands on the control that replaced it
- [x] a held-Enter test on Start (keydown plus auto-repeats) asserts the revision went up by exactly 1
- [x] `launchSecondInstance` races the exit against a ~10 s timeout that kills the child and rejects
- [x] the relaunch test closes the first app in its own try/finally and asserts `completedInCycle === 0` and `revision === 0` through `timerGetState()`
- [x] Unit tests, lint and typecheck are clean
