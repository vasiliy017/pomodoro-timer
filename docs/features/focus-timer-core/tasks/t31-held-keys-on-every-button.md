---
id: T31
title: "Ignore held-key repeats on every button, the dialog's included"
layer: "ui"
deps: []
blocks: ["T32"]
acs: ["AC-02", "AC-12"]
files_hint: ["src/renderer/src/components/ui/Button.tsx", "src/renderer/src/components/ui/Button.test.tsx", "src/renderer/src/components/ui/Dialog.test.tsx", "src/renderer/src/screens/TimerScreen.tsx", "src/renderer/src/screens/TimerScreen.test.tsx"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---

# T31 — Ignore held-key repeats on every button, the dialog's included

Follow-up from the review: finding P1 in [review-2026-11-08.md](../_review/review-2026-11-08.md). The finding states the problem and the agreed resolution; the ACs are in [spec.md](../spec.md) §5 and the test rows in [test-plan.md](../test-plan.md).

## Definition of Done

- [x] the `Button` primitive drops repeated Enter/Space keydowns (`event.repeat`) and still calls a caller's own `onKeyDown`
- [x] holding Enter on Restart cycle opens the confirmation dialog once and leaves it open: a repeated Enter on Cancel does not close it (AC-02, AC-12)
- [x] `TimerScreen` no longer carries its own `dropHeldKeys`; its held-key tests still pass
- [x] Unit tests, lint and typecheck are clean
