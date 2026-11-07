---
id: T27
title: "Ignore held-key repeats on the controls and keep focus when a control removes itself"
layer: "ui"
deps: []
blocks: []
acs: ["AC-02"]
files_hint: ["src/renderer/src/screens/TimerScreen.tsx", "src/renderer/src/screens/TimerScreen.test.tsx"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---

# T27 — Ignore held-key repeats on the controls and keep focus when a control removes itself

Follow-up from the review: finding(s) N1, N5 (and the component part of N2) in [review-2026-11-07.md](../_review/review-2026-11-07.md). The finding states the problem and the agreed resolution; the ACs are in [spec.md](../spec.md) §5 and the test rows in [test-plan.md](../test-plan.md).

## Definition of Done

- [x] holding Enter or Space on a focused control sends one command, not one per auto-repeat (AC-02)
- [x] when Reset or Skip removes itself, keyboard focus moves to the primary button instead of `<body>`
- [x] the component double-click test covers Start, Pause, Resume, Reset and Skip
- [x] Unit tests, lint and typecheck are clean
