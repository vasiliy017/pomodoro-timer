---
id: T24
title: "Expire the OS-initiated-quit flag after a cancelled logout"
layer: "app"
deps: []
blocks: []
acs: ["AC-13"]
files_hint: ["src/main/quit-guard.ts", "src/main/quit-guard.test.ts"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---

# T24 — Expire the OS-initiated-quit flag after a cancelled logout

Follow-up from the review: finding(s) R13 in [review-2026-10-31.md](../_review/review-2026-10-31.md). The finding states the problem and the agreed resolution; the ACs are in [spec.md](../spec.md) §5 and the test rows in [test-plan.md](../test-plan.md).

## Definition of Done

- [ ] after a cancelled logout or shutdown the guard asks again; a quit right after the system signal is still never asked about
- [ ] Unit tests, lint and typecheck are clean
