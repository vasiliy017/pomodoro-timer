---
id: T22
title: "Ignore repeat clicks on the controls and keep focus on the primary button"
layer: "ui"
deps: ["T21"]
blocks: []
acs: ["AC-02"]
files_hint: ["src/renderer/src/screens/TimerScreen.tsx", "src/renderer/src/screens/TimerScreen.test.tsx", "e2e/timer.spec.ts"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "todo"
step: "—"
---

# T22 — Ignore repeat clicks on the controls and keep focus on the primary button

Follow-up from the review: finding(s) R1, R10 in [review-2026-10-31.md](../_review/review-2026-10-31.md). The finding states the problem and the agreed resolution; the ACs are in [spec.md](../spec.md) §5 and the test rows in [test-plan.md](../test-plan.md).

## Definition of Done

- [ ] a double-click on any control has the effect of one click in the real window; keyboard focus stays on the primary button across Start, Pause and Resume
- [ ] Unit tests, lint and typecheck are clean
