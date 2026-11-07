---
id: T20
title: "Refuse timer commands that carry extra fields"
layer: "domain"
deps: ["T19"]
blocks: []
acs: ["AC-02"]
files_hint: ["src/shared/timer.ts", "src/shared/timer.test.ts"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "todo"
step: "—"
---

# T20 — Refuse timer commands that carry extra fields

Follow-up from the review: finding(s) R4 in [review-2026-10-31.md](../_review/review-2026-10-31.md). The finding states the problem and the agreed resolution; the ACs are in [spec.md](../spec.md) §5 and the test rows in [test-plan.md](../test-plan.md).

## Definition of Done

- [ ] isTimerCommand rejects any unknown key, including confirmed on a simple command
- [ ] Unit tests, lint and typecheck are clean
