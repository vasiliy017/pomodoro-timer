---
id: T34
title: "Keep the remembered control when the window loses focus"
layer: "ui"
deps: []
blocks: []
acs: []
files_hint: ["src/renderer/src/screens/TimerScreen.tsx", "src/renderer/src/screens/TimerScreen.test.tsx"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "todo"
step: "—"
---

# T34 — Keep the remembered control when the window loses focus

Follow-up from the review: finding F1 in [review-2026-11-08-2.md](../_review/review-2026-11-08-2.md). The finding states the problem and the agreed resolution.

## Definition of Done

- [ ] a blur on Reset that leaves it `document.activeElement` (a window blur), then Reset removes itself: the primary button gets focus
- [ ] focus moved off the controls (`blur()`), then Reset removes itself: `<body>` keeps focus (the T32 test stays green)
- [ ] the comment on the `onBlur` handler says why the check runs after the commit, without overstating it
- [ ] Unit tests, lint and typecheck are clean
