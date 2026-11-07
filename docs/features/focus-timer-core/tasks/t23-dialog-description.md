---
id: T23
title: "Link the Restart-cycle loss text to the dialog"
layer: "ui"
deps: []
blocks: []
acs: ["AC-12"]
files_hint: ["src/renderer/src/components/ui/Dialog.tsx", "src/renderer/src/components/ui/Dialog.test.tsx"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---

# T23 — Link the Restart-cycle loss text to the dialog

Follow-up from the review: finding(s) R12 in [review-2026-10-31.md](../_review/review-2026-10-31.md). The finding states the problem and the agreed resolution; the ACs are in [spec.md](../spec.md) §5 and the test rows in [test-plan.md](../test-plan.md).

## Definition of Done

- [ ] the dialog has an accessible description holding its body text
- [ ] Unit tests, lint and typecheck are clean
