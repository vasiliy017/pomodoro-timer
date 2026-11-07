---
id: T28
title: "Document that an ignored command can first settle a phase that is already due"
layer: "docs"
deps: []
blocks: []
acs: ["AC-02", "AC-05", "AC-07"]
files_hint: ["docs/features/focus-timer-core/contracts/public-api.md", "docs/features/focus-timer-core/sad.md", "src/shared/timer.ts"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---

# T28 — Document that an ignored command can first settle a phase that is already due

Follow-up from the review: finding(s) N3 in [review-2026-11-07.md](../_review/review-2026-11-07.md). The finding states the problem and the agreed resolution; the ACs are in [spec.md](../spec.md) §5 and the test rows in [test-plan.md](../test-plan.md).

## Definition of Done

- [x] `public-api.md` §1 (invariants) and §2 (return table) say an ignored command can first settle a phase that is already due, or start the new day, and that its snapshot then carries a newer revision
- [x] `sad.md` Flow 4 (and Flow 6 where it applies) has an `alt` branch: the phase was already due, so it ends first, with its signals, and the command is stale
- [x] the effects comment at `src/shared/timer.ts:241` matches the behaviour
- [x] Unit tests, lint and typecheck are clean
