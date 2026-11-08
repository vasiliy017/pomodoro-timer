---
id: T32
title: "Forget the focused control when focus leaves the controls"
layer: "ui"
deps: ["T31"]
blocks: []
acs: []
files_hint: ["src/renderer/src/screens/TimerScreen.tsx", "src/renderer/src/screens/TimerScreen.test.tsx"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "todo"
step: "—"
---

# T32 — Forget the focused control when focus leaves the controls

Follow-up from the review: finding P3 in [review-2026-11-08.md](../_review/review-2026-11-08.md). The finding states the problem and the agreed resolution.

## Definition of Done

- [ ] focus on Reset, then `blur()`, then Reset removes itself: `<body>` keeps focus and the primary button is not focused
- [ ] focus on a control that removes itself still moves to the primary button (the N5 tests stay green)
- [ ] Unit tests, lint and typecheck are clean
