---
id: T19
title: "Keep a waiting phase-end notice through the new-day reset"
layer: "domain"
deps: ["T18"]
blocks: []
acs: ["AC-06", "AC-15"]
files_hint: ["src/shared/timer.ts", "src/shared/timer.test.ts"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "todo"
step: "—"
---

# T19 — Keep a waiting phase-end notice through the new-day reset

Follow-up from the review: finding(s) R3 in [review-2026-10-31.md](../_review/review-2026-10-31.md). The finding states the problem and the agreed resolution; the ACs are in [spec.md](../spec.md) §5 and the test rows in [test-plan.md](../test-plan.md).

## Definition of Done

- [ ] a new-day reset leaves a waiting notice in place; only the next command or phase end clears it
- [ ] Unit tests, lint and typecheck are clean
