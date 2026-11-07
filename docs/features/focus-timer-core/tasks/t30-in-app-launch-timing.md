---
id: T30
title: "Measure launch time inside the app"
layer: "tests"
deps: ["T29"]
blocks: []
acs: []
files_hint: ["e2e/boot.spec.ts", "src/renderer/src/screens/TimerScreen.tsx"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---

# T30 — Measure launch time inside the app

Follow-up from the review: finding(s) N4 in [review-2026-11-07.md](../_review/review-2026-11-07.md). The finding states the problem and the agreed resolution; the ACs are in [spec.md](../spec.md) §5 and the test rows in [test-plan.md](../test-plan.md).

## Definition of Done

- [x] launch time is measured from main process start (`Date.now() - process.uptime() * 1000` in main) to the first render of the ready heading in the renderer (for example the Element Timing API through an `elementtiming` attribute on the heading), not from before `electron.launch`
- [x] the 2 s budget (spec §6) stays; all three cold launches pass
- [x] Unit tests, lint and typecheck are clean
