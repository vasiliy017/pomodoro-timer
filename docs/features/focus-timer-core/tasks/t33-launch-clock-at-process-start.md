---
id: T33
title: "Start the launch clock at main's process start"
layer: "tests"
deps: []
blocks: []
acs: []
files_hint: ["e2e/boot.spec.ts"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---

# T33 — Start the launch clock at main's process start

Follow-up from the review: finding P2 in [review-2026-11-08.md](../_review/review-2026-11-08.md). Spec §6 (launch ≤ 2 s); test row in [test-plan.md](../test-plan.md).

## Definition of Done

- [x] the cold-launch test starts its clock at main's `performance.timeOrigin`, not at `Date.now() - process.uptime()`
- [x] the comment says what the clock measures; the 2 s budget stays
- [x] `npm run test:e2e`, lint and typecheck are clean
