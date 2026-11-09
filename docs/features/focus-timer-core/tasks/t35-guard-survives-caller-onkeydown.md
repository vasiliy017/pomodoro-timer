---
id: T35
title: "Pin the held-key guard against a caller's onKeyDown"
layer: "tests"
deps: []
blocks: []
acs: ["AC-02", "AC-12"]
files_hint: ["src/renderer/src/components/ui/Button.test.tsx"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "todo"
step: "—"
---

# T35 — Pin the held-key guard against a caller's onKeyDown

Follow-up from the review: finding F2 in [review-2026-11-08-2.md](../_review/review-2026-11-08-2.md). The finding states the problem and the agreed resolution.

## Definition of Done

- [ ] the "still calls the caller's onKeyDown" test also asserts that the auto-repeated Enter is prevented
- [ ] the test fails against a Button whose caller's `onKeyDown` replaces the guard
- [ ] Unit tests, lint and typecheck are clean
