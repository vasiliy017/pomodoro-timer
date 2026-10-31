---
status: Accepted
owner: "Vasiliy"
reviewers: []
updated_at: "2026-10-31"
feature_size: "M"
ticket: ""
---

# 0003 — Arm one deadline timeout in main instead of ticking every second

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Vasiliy (owner), with Claude during the `design` pass (easy depth, assumptions ledger A7)

## Context

Main must notice two kinds of deadline: a running phase's `endsAt`, and the Mac's next local
midnight (the new-day rule, AC-15). It must do so within the spec's latency target while the
window is hidden or closed, and without spending CPU in the background. The renderer's visible
countdown is a separate concern ([ADR-0006](0006-push-snapshots-on-change-and-count-down-in-the-window.md)).

## Decision drivers

- Spec §6 NFR *Phase-end detection latency*: ≤ 1 s from a phase's scheduled end to its
  notification and on-screen change, window hidden or closed, Mac awake.
- Spec §6 NFR *Background resource use*: ≤ 1% average CPU over 10 minutes and Energy Impact «Low»
  while a phase runs with the window hidden or closed.
- AC-15: the new-day check runs at the Mac's local midnight.

## Considered options

1. **One timeout to the next deadline.** Main keeps a single `setTimeout` armed for
   `min(endsAt, nextLocalMidnight)`. It re-arms after every transition, on wake, at launch and on
   a macOS clock or time-zone change (ADR-0005).
   When the timeout fires, main feeds a `deadline` input to the rules. If nothing is due yet
   (the timeout fired early, or the clock moved back), main just re-arms.
2. **A 1-second interval in main.** A `setInterval` feeds a check input to the rules every second
   while a phase runs or a midnight is pending.

## Decision outcome

**Chosen:** option 1. It wakes the process at most twice per phase, once at the end and once at
midnight, which is the least background work possible. It meets the 1 s target as long as the
process is not throttled, which [ADR-0004](0004-disable-app-nap-in-the-app-bundle.md) ensures.
Option 2 is simpler to reason about, but it wakes the process 1,500 times per focus session for
nothing, and it does not help if macOS throttles the app anyway.

## Consequences

**Positive**
- Near-zero background cost: no timers fire between deadlines.
- One code path for every deadline: arm → fire → `deadline` input → re-arm from the new state.

**Negative**
- Every state change must re-arm the timeout. A forgotten re-arm is a missed phase end, so the
  shell has to re-arm in one place (after every `transition`), with a test for it.
- After a forward wall-clock jump, detection depends on the clock-change notification re-arming
  the timeout. Without it, detection waits for the armed timeout
  ([ADR-0002](0002-trust-the-wall-clock-with-clamps.md), consequences).

**Neutral**
- The longest delay ever armed is about 24 h (to midnight), well under the timer limit of
  2³¹ − 1 ms.

## Links

- Spec: [[../spec.md]] §6 Phase-end detection latency, Background resource use, AC-05, AC-15
- SAD: [[../sad.md]] §4, §6
- Related ADR: [[0002-trust-the-wall-clock-with-clamps]], [[0004-disable-app-nap-in-the-app-bundle]], [[0006-push-snapshots-on-change-and-count-down-in-the-window]]
