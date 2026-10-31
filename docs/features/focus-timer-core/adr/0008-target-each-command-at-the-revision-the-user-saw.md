---
status: Accepted
owner: "Vasiliy"
reviewers: []
updated_at: "2026-10-31"
feature_size: "M"
ticket: ""
---

# 0008 — Target each timer command at the snapshot revision the User saw

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Vasiliy (owner), with Claude during the `design` pass (easy depth, assumptions ledger A11)

## Context

AC-02 requires that a repeated click on any control has the same effect as one click, because
"each command acts only on the phase the User saw". A second Skip that lands after the first must
not also skip the break that is now ready. AC-12 requires that a Restart cycle which would lose
progress "never takes effect without the User's confirmation, whichever window sends it".
Spec §6.1 assumes a compromised or buggy window may send crafted or repeated commands. Commands
cross IPC asynchronously, so the renderer's view can be stale when a command arrives.

## Decision drivers

- AC-02, AC-02b, AC-12 and spec §6.1 abuse cases.
- Spec §6 NFR *Command safety*: 0 double counts or unwanted transitions across 10,000 random
  sequences, including late commands from a window that was closed and reopened.
- Repo convention: expected failures are values, not exceptions (`src/shared/result.ts`).

## Considered options

1. **Revision-targeted command envelope.** Every snapshot carries a `revision` that increments on
   each state change. Every command carries the `revision` it was issued against:
   `{ type, revision, confirmed? }`. The rules ignore a command whose `revision` is not current,
   or that is not allowed in the current state. The outcome is
   `{ kind: 'applied' | 'ignored' | 'needsConfirmation', snapshot, loss? }`. An unconfirmed
   Restart cycle that would lose progress returns `needsConfirmation` with the loss summary, and
   only a repeat with `confirmed: true` at the same revision applies it.
2. **Main-side time debounce plus main-owned confirmation.** Main drops a repeat of the same
   command type that arrives within a short window (for example 500 ms) of the previous one.
   Restart cycle always goes through a native `dialog.showMessageBox` that main shows itself
   whenever progress would be lost. Commands carry no revision.

## Decision outcome

**Chosen:** option 1. Only a revision ties a command to the phase the User actually saw. Option 2
meets AC-12, because main owns the confirmation. But a time window cannot tell a double-click from
a deliberate second click, and it does not catch a late Skip from a reopened window that arrives
after the window has passed. That Skip would skip the next break, which AC-02 forbids. A native
dialog for Restart cycle also breaks the calm in-window design that the renderer owns.

## Consequences

**Positive**
- Repeats, double-clicks and late commands are no-ops by construction, and the property test can
  generate them freely.
- The confirmation rule lives in the pure rules, so the renderer's dialog is presentation only,
  and so is any future window.
- The renderer gets a typed outcome (no thrown errors) and can show the loss summary it was given.

**Negative**
- Every command call site must pass the current `revision`. Forgetting it makes every command a
  no-op, which tests catch quickly.
- A Restart cycle confirmation goes stale if the state changes while the dialog is open (for
  example, a phase ends). The confirmed command is then ignored and the User must confirm again
  against the new loss.

**Neutral**
- `revision` is an in-memory integer. It resets on launch together with the rest of the state
  (nothing is persisted).

## Links

- Spec: [[../spec.md]] AC-02, AC-02b, AC-12, AC-13, §6 Command safety, §6.1
- SAD: [[../sad.md]] §5, §8
- Related ADR: [[0001-model-timer-rules-as-a-pure-transition-function]], [[0006-push-snapshots-on-change-and-count-down-in-the-window]], [[0007-add-a-typed-main-to-renderer-event-contract]]
