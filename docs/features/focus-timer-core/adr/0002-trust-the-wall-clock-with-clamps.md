---
status: Accepted
owner: "Vasiliy"
reviewers: []
updated_at: "2026-10-31"
feature_size: "M"
ticket: ""
---

# 0002 — Trust the wall clock for remaining time, clamped to the phase length

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Vasiliy (owner), with Claude during the `design` pass (resolves spec §8 Q1)

## Context

Spec §8 Q1 asks which time the timer trusts when the Mac's clock is changed or corrected
mid-phase: a manual change, a network time correction, or a time-zone change. A time-zone change
does not move epoch milliseconds, so it never affects remaining time. It only moves the local
date that the new-day rule (AC-15) reads. A manual change or a network correction does move the
wall clock. [repo ADR-0002](../../../adr/0002-run-the-timer-engine-in-the-main-process.md) claims
that "clock jumps do not cause drift". That holds for drift from counted ticks, but not for the
jumps themselves, so this ADR supersedes that sentence.

## Decision drivers

- Spec §6 NFR *Timing accuracy*: remaining time never more than 1 s off wall-clock time over a
  25-minute focus session, including after reopening the window or waking the Mac.
- Spec §6 NFR *Command safety*: clock changes are checked against the §8 Q1 default in the
  10,000-sequence property test.
- AC-09 and AC-14: the Mac's sleep must count against a running phase ("keep real time while the
  Mac sleeps"), and macOS's monotonic clock stops during sleep.
- Repo convention: remaining time is derived from stored timestamps, never from counting ticks.

## Considered options

1. **Wall clock with clamps.** A running phase stores `endsAt`, a wall-clock epoch in ms.
   Remaining time is `clamp(endsAt − now, 0, durationMs)`. A phase end is a transition, so a
   later backward jump cannot resurrect an ended phase.
2. **Monotonic awake time plus wall-clock sleep time.** Elapsed time accumulates on the monotonic
   clock while the Mac is awake. Sleep duration is added as the wall-clock gap between suspend
   and resume. Manual clock changes while awake are ignored.

## Decision outcome

**Chosen:** option 1, the spec's default. It meets the *Timing accuracy* NFR as written, because
it is measured against the system clock. It counts sleep without a second time source, and it
keeps `transition` to a single `now` input. Option 2 is more resistant to a hand-moved clock. But
it doubles the time inputs of every transition, it disagrees with the system clock by design
after a change, and it depends on the suspend event arriving to count sleep at all.

## Consequences

**Positive**
- One time source (`Date.now()` in main, passed in as `now`), so tests and the property test only
  vary one number.
- Sleep counts against a running phase automatically. The sleep rules (ADR-0005) only decide
  *whether it counts*, not *how much time passed*.
- A phase never shows more than its full length, and a phase that has ended stays ended.

**Negative**
- A manual forward jump past `endsAt` ends the phase. For a focus session, that phase counts as
  completed. This is rare, and it is accepted debt in SAD §11.
- A backward jump gives a running phase back time, up to its full length.
- Main's `setTimeout` runs on the monotonic clock, so a clock jump leaves the armed timeout at the
  wrong wall time. Main re-arms when macOS posts `NSSystemClockDidChangeNotification`
  ([ADR-0005](0005-feed-sleep-and-wake-into-the-rules-from-powermonitor.md)). If that notification
  turns out not to arrive (SAD §11), the phase end is noticed only when the armed timeout fires or
  the next input arrives, so it can be late by up to the size of the jump.

**Neutral**
- Moving to option 2 later changes only the time inputs and the stored timestamps inside the
  rules (ADR-0001). The IPC snapshot keeps carrying `endsAt` for the renderer.

## Links

- Spec: [[../spec.md]] §8 Q1, §6 Timing accuracy, Command safety, AC-14, AC-15
- SAD: [[../sad.md]] §4, §8, §11
- Supersedes (in part): [repo ADR-0002](../../../adr/0002-run-the-timer-engine-in-the-main-process.md), the sentence "clock jumps do not cause drift"
- Related ADR: [[0001-model-timer-rules-as-a-pure-transition-function]], [[0003-arm-one-deadline-timeout-in-main]], [[0005-feed-sleep-and-wake-into-the-rules-from-powermonitor]]
