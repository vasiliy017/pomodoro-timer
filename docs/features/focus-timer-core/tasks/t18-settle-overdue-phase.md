---
id: T18
title: "Settle a phase that is already due before judging a command"
layer: "domain"
deps: []
blocks: []
acs: ["AC-05", "AC-07", "AC-14"]
files_hint: ["src/shared/timer.ts", "src/shared/timer.test.ts", "src/shared/timer.property.test.ts"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "todo"
step: "—"
---

# T18 — Settle a phase that is already due before judging a command

Follow-up from the review: finding(s) R2 in [review-2026-10-31.md](../_review/review-2026-10-31.md). The finding states the problem and the agreed resolution; the ACs are in [spec.md](../spec.md) §5 and the test rows in [test-plan.md](../test-plan.md).

## Definition of Done

- [ ] a command on an overdue running phase settles the phase first (notice, notification, Dock bounce) and is then ignored as stale; the property test tracks a session that ended asleep across steps
- [ ] Unit tests, lint and typecheck are clean
