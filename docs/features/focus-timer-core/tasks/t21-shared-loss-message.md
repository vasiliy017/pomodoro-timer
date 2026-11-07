---
id: T21
title: "Share one loss sentence between the quit dialog and Restart cycle"
layer: "domain"
deps: ["T20"]
blocks: []
acs: ["AC-12", "AC-13"]
files_hint: ["src/shared/timer.ts", "src/shared/timer.test.ts", "src/main/quit-guard.ts", "src/main/quit-guard.test.ts", "src/renderer/src/screens/TimerScreen.tsx"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "todo"
step: "—"
---

# T21 — Share one loss sentence between the quit dialog and Restart cycle

Follow-up from the review: finding(s) R9 in [review-2026-10-31.md](../_review/review-2026-10-31.md). The finding states the problem and the agreed resolution; the ACs are in [spec.md](../spec.md) §5 and the test rows in [test-plan.md](../test-plan.md).

## Definition of Done

- [ ] one pure lossMessage in src/shared/timer.ts, used by main and the renderer, with its tests alongside
- [ ] Unit tests, lint and typecheck are clean
