---
id: T25
title: "Stop the timer window going full screen"
layer: "infra"
deps: []
blocks: []
acs: ["AC-13"]
files_hint: ["src/main/window.ts", "src/main/window.test.ts"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "todo"
step: "—"
---

# T25 — Stop the timer window going full screen

Follow-up from the review: finding(s) R14 in [review-2026-10-31.md](../_review/review-2026-10-31.md). The finding states the problem and the agreed resolution; the ACs are in [spec.md](../spec.md) §5 and the test rows in [test-plan.md](../test-plan.md).

## Definition of Done

- [ ] the timer window is created with fullscreenable false, so hide-on-close cannot leave an empty Space
- [ ] Unit tests, lint and typecheck are clean
