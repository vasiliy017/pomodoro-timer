---
status: Accepted
owner: "Vasiliy"
reviewers: []
updated_at: "2026-10-31"
feature_size: "M"
ticket: ""
---

# 0006 — Push a full timer snapshot only on change, and count down locally in the window

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Vasiliy (owner), with Claude during the `design` pass (easy depth, assumptions ledger A9)

## Context

The renderer shows a countdown, the phase, «focus session N of 4», the phase-end message (AC-06,
AC-14) and the allowed controls (AC-02b). Main owns the truth
([repo ADR-0002](../../../adr/0002-run-the-timer-engine-in-the-main-process.md)). When the window
is reopened, it must show the current remaining time immediately, "not an older value counting
down" (AC-13). Main and the renderer run on the same Mac, so they read the same wall clock.

## Decision drivers

- Spec §6 NFR *Background resource use*: ≤ 1% average CPU over 10 minutes, window hidden or closed.
- Spec §6 NFR *Timing accuracy*: never more than 1 s off wall-clock time, including after
  reopening the window.
- Spec §6 NFR *Control responsiveness*: ≤ 100 ms from a click to the visible change.
- AC-13: reopening shows the current remaining time immediately.

## Considered options

1. **Snapshot on change, local countdown.** Main broadcasts a `TimerSnapshot` only when the state
   changes. The snapshot carries `revision`, `phase`, `status`, `durationMs`, `remainingMs`,
   `endsAt`, `completedInCycle`, `focusNumber`, `notice` and `controls`. The renderer also pulls
   one snapshot on mount (`timerGetState`). It displays `clamp(endsAt − Date.now(), 0, durationMs)`
   on a local interval, only while the document is visible.
2. **Main pushes the remaining time every second.** The renderer displays whatever value arrives
   last. Main runs a 1 s interval while a phase runs.

## Decision outcome

**Chosen:** option 1. A snapshot with an absolute `endsAt` lets the window compute the correct
remaining time at any instant, including the first frame after it is shown again. Main stays
idle between deadlines (ADR-0003). Option 2 makes main tick 1,500 times per focus session even
with no window open, and a reopened window shows the last pushed value until the next push.

## Consequences

**Positive**
- Zero IPC traffic while nothing changes, and no main-process tick.
- The countdown is correct on the first frame after reopening, since `endsAt` is absolute.
- The renderer never re-derives rules: `controls`, `focusNumber` and `notice` come precomputed
  from `src/shared/timer.ts` helpers.

**Negative**
- The renderer's local countdown can reach 0:00 slightly before main's phase-end snapshot arrives
  (≤ 1 s by the detection NFR). The screen holds at 0:00 until it does, and never guesses the next
  phase.
- The snapshot type is a cross-process contract in `src/shared`. Changing it touches main,
  preload and renderer together.

**Neutral**
- A future session-end ritual window (roadmap step 5) subscribes to the same snapshots with no
  change to main.

## Links

- Spec: [[../spec.md]] AC-01, AC-02b, AC-06, AC-13, §6 Background resource use, Timing accuracy, Control responsiveness
- SAD: [[../sad.md]] §5, §6
- Related ADR: [[0003-arm-one-deadline-timeout-in-main]], [[0007-add-a-typed-main-to-renderer-event-contract]], [[0008-target-each-command-at-the-revision-the-user-saw]]
