---
id: T26
title: "Fill in the missing end-to-end rows of the test plan"
layer: "tests"
deps: ["T22", "T23", "T24", "T25"]
blocks: []
acs: ["AC-01", "AC-03", "AC-12", "AC-13"]
files_hint: ["e2e/timer.spec.ts", "e2e/boot.spec.ts"]
owner: "Vasiliy"
estimate: "M"
context_budget: "M"
status: "todo"
step: "—"
---

# T26 — Fill in the missing end-to-end rows of the test plan

Follow-up from the review: finding(s) R5, R6, R7, R8, R11 in [review-2026-10-31.md](../_review/review-2026-10-31.md). The finding states the problem and the agreed resolution; the ACs are in [spec.md](../spec.md) §5 and the test rows in [test-plan.md](../test-plan.md).

## Definition of Done

- [ ] the test-plan e2e rows for AC-01, AC-03, AC-12, AC-13 and the spec §6 scenarios exist and pass; the latency check stops on the expected change
- [ ] Unit tests, lint and typecheck are clean
