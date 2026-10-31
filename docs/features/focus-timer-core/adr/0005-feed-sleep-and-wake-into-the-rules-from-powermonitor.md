---
status: Accepted
owner: "Vasiliy"
reviewers: []
updated_at: "2026-10-31"
feature_size: "M"
ticket: ""
---

# 0005 — Feed system sleep, wake and clock changes into the timer rules as events

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Vasiliy (owner), with Claude during the `design` pass (easy depth, assumptions ledger A8)

## Context

AC-14 makes sleep a first-class rule. A focus session counts as completed only when its scheduled
end came no later than the moment the Mac went to sleep. A focus session whose end passed while
the Mac slept ends uncounted. A break whose end passed during sleep ends as usual. A paused phase
is untouched. Power Nap's brief background wakes are still sleep. A locked screen or a sleeping
display is not sleep. The rules therefore need to know *when the Mac went to sleep*, not just
that time passed. AC-15 adds a second system signal: the new-day check also runs "when the Mac's
time zone or clock changes", so the screen shows the fresh cycle before the User can act.

## Decision drivers

- AC-14 and the glossary's *completed focus session*: "ran out while the Mac was awake".
- Spec goal: the cycle count is honest.
- Spec §6 NFR *Command safety*: the property test must cover sleep gaps.
- [ADR-0001](0001-model-timer-rules-as-a-pure-transition-function.md): all inputs reach the pure
  rules as data.

## Considered options

1. **Explicit `sleep` and `wake` inputs from Electron `powerMonitor`.** `suspend` → `sleep(at)`,
   `resume` → `wake`. The rules record `sleptAt` on a running phase, and ignore `deadline` inputs
   while `sleptAt` is set, which covers timeouts firing during Power Nap. On `wake` they settle the
   phase by comparing `endsAt` with `sleptAt` and `now`. `lock-screen` is ignored. Clock and
   time-zone changes follow the same pattern. Main subscribes to
   `NSSystemClockDidChangeNotification` (`systemPreferences.subscribeLocalNotification`) and
   `NSSystemTimeZoneDidChangeDistributedNotification` (`systemPreferences.subscribeNotification`),
   and feeds a `clockChanged` input that runs the new-day check and re-arms the deadline.
2. **Infer sleep from lateness.** No OS events. If a timeout fires, or an input arrives, more
   than N seconds after `endsAt`, assume the Mac slept through the end.

## Decision outcome

**Chosen:** option 1. Only the real suspend moment can separate "ended before sleep (counts)" from
"ended during sleep (doesn't count)". Lateness cannot tell a 10-second scheduling hiccup from a
2-hour sleep. It also cannot tell sleep from a locked screen, which AC-14 says is not sleep.

## Consequences

**Positive**
- Every AC-14 branch is a pure, testable transition: ended before sleep, ended during sleep (focus,
  short break, long break), still ahead, paused, and sleep across midnight.
- Power Nap is handled by construction: deadlines are ignored while `sleptAt` is set.
- Exactly one notification on wake, because the sleep result and the new-day rule run in the same
  transition.
- AC-15's time-zone and clock triggers have an explicit input, so the screen refreshes as soon as
  macOS reports the change.

**Negative**
- Correctness depends on `suspend` being delivered before the Mac sleeps. If it is missed, a focus
  session that ended during sleep is settled on the next deadline as completed (SAD §11 risk).
- The wall-clock time of `suspend` is taken by main when the event arrives, not from the kernel,
  so it can be slightly late.
- Delivery of the two clock / time-zone notifications to Electron's main process is unverified.
  It needs an on-device spike during `implement` (SAD §11). Until then, the fallback is the
  new-day check that runs on every command, wake, launch and deadline.

**Neutral**
- A lateness heuristic (option 2) can be added later as a fallback for a missed `suspend`,
  without changing the input vocabulary.

## Links

- Spec: [[../spec.md]] AC-14, AC-15, §6 Command safety
- SAD: [[../sad.md]] §4, §6 (flow 2), §8 *Time*, §11
- Related ADR: [[0001-model-timer-rules-as-a-pure-transition-function]], [[0002-trust-the-wall-clock-with-clamps]], [[0003-arm-one-deadline-timeout-in-main]]
