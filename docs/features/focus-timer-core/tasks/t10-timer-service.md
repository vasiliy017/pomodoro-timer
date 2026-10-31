---
id: T10
title: "Build the timer service: hold state, run effects, arm one deadline, broadcast snapshots"
layer: "app"
deps: ["T4", "T6"]
blocks: ["T11", "T15"]
acs: ["AC-05", "AC-08", "AC-15"]
files_hint: ["src/main/timer-service.ts", "src/main/timer-service.test.ts"]
owner: "Vasiliy"
estimate: "M"
context_budget: "M"
status: "done"
step: "COMMIT"
---

<!-- To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous,
or contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T10 — Build the timer service: hold state, run effects, arm one deadline, broadcast snapshots

## Place in the sequence

- **Blocked by:** T4 — complete `transition()`, T6 — clock adapter · **Blocks:** T11 — IPC contract, T15 — main wiring · **Wave:** 5 (parallel with T5).
- **Lane:** own lane.

## Why (user story)

> **As a** User
> **I want** a system notification when any phase ends
> **So that** I notice it even with the window hidden
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

This task is main's imperative shell: it feeds time to the rules, carries out their effects and wakes up exactly when the next thing must happen.

## Inlined context

> `timer-service.ts` ✚ shell: holds TimerState, feeds inputs with now/localDate, runs effects, re-arms the one deadline timeout, broadcasts snapshots
>
> — `sad.md §5, internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> Main arms one timeout to `min(endsAt, next local midnight)`, and the bundle opts out of App Nap so that timeout fires on time with the window closed.
>
> — `sad.md §4, strategic choice 3, abridged` · full text: [sad.md](../sad.md)

> **Chosen:** option 1. It wakes the process at most twice per phase, once at the end and once at midnight, which is the least background work possible. [...] Option 2 [...] wakes the process 1,500 times per focus session for nothing
>
> — `adr/0003-arm-one-deadline-timeout-in-main.md §Decision outcome, abridged` · full text: [ADR-0003](../adr/0003-arm-one-deadline-timeout-in-main.md)

> 25 minutes later the armed timeout fires → transition with deadline, now and local date → short break ready, 1 of 4 completed, notify and bounce effects → posts the phase-end notification → bounces the Dock icon once → re-arms the timeout for the next local midnight → `timer:state` snapshot, ready short break, phase-end notice
>
> — `sad.md §6, Flow 1, abridged` · full text: [sad.md](../sad.md)

> A node-project test of `timer-service.ts` with fake timers checks that the timeout is armed at `endsAt` and that `notify` + `bounceDock` + the broadcast happen on fire. [...] A unit test also asserts that main arms at most one timeout and no interval (ADR-0003).
>
> — `sad.md §10, QG-1 + QG-5 How verify, abridged` · full text: [sad.md](../sad.md)

> `timerState` is sent on every state change: command applied, phase end, sleep/wake result, new day, clock change. Never while nothing changes (ADR-0006). A payload that fails `isTimerCommand` returns `{ kind: 'ignored', reason: 'malformed', snapshot }`. It is not a thrown error.
>
> — `contracts/public-api.md §2–§3, abridged` · full text: [public-api.md](../contracts/public-api.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([sad.md](../sad.md) · [public-api.md](../contracts/public-api.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. Holds the single in-memory `TimerState`; nothing is persisted (sad §8 *Persistence*).

## API contract

Internal — exposes to main (consumed by T11 and T15):
`createTimerService({ clock, signals, broadcast, config, timers? })` → `{ getSnapshot(): TimerSnapshot, command(payload: unknown): CommandOutcome, sleep(), wake(), clockChanged(), getRestartLoss(): RestartLoss, dispose() }`.

## Acceptance criteria

### AC-05 — happy

> **Given** a focus session is running and the timer window is hidden behind other apps or closed
> **When** the focus session's time runs out
> **Then** a system notification appears saying the focus session is complete and that a short break (or long break) is ready, and clicking it brings the timer window to the front; the same applies when a break ends («break over — focus session ready»)
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-08 — domain invariant

> **Given** a short break is the ready phase after a focus session ended
> **When** nobody touches the app for any length of time (10 minutes or 3 hours)
> **Then** the short break is still ready at its full 5:00 and no time has been counted against it — a phase never starts by itself; it starts only when the User starts it
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-15 — cross-context

> **Then** [...] the app checks for a new day at the Mac's local midnight, when the Mac wakes, at launch and when the Mac's time zone or clock changes, so the screen already shows the fresh cycle before the User can act on it (a Start pressed at 00:02 starts focus session 1 of 4, never yesterday's ready break), and a phase paused across midnight is cleared at midnight
>
> — `spec.md §5, AC-15, abridged` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `createTimerService(...)`: initial state from `createInitialState(clock.localDate(), config)`; arm the first deadline — `src/main/timer-service.ts`
- [ ] One private `apply(input)`: call `transition` with `clock.now()` / `clock.localDate()`, run effects in order (`notify` → `signals.notify`, `bounceDock` → `signals.bounceDock`), broadcast the snapshot only if `revision` changed, re-arm — `src/main/timer-service.ts`
- [ ] `command(payload)`: `isTimerCommand` false → `ignored/malformed` with the current snapshot; else map the transition result to `CommandOutcome` — `src/main/timer-service.ts`
- [ ] `rearm()`: clear the old timeout, set one to `min(endsAt ?? ∞, clock.nextLocalMidnight())`; fire → `apply({ kind: 'deadline' })` — `src/main/timer-service.ts`
- [ ] Log unexpected errors with `console.error('[timer] …')` — `src/main/timer-service.ts`
- [ ] Fake-timer tests with a fake clock and recording signals/broadcast — `src/main/timer-service.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Ready phase | only the midnight timeout is armed (no phase deadline) |
| Midnight fires with a paused phase from yesterday | fresh cycle broadcast, no notification |
| Timeout fires a few ms early | rules no-op; service re-arms for the remainder, no broadcast |
| `ignored` / `needsConfirmation` outcome | no broadcast (revision unchanged) |
| Many commands in a row | still exactly one pending timeout (asserted via fake timers' count) |
| An effect throws (e.g. notification) | logged with `[timer]`; remaining effects and the broadcast still run |

## Definition of Done

- [ ] `src/main/timer-service.test.ts` passes: deadline armed at `endsAt`, `notify` + `bounceDock` + broadcast on fire, ready phase never starts (AC-08 at +10 min / +3 h), midnight re-arm and fresh cycle, at most one timeout and no `setInterval`
- [ ] malformed payloads return `ignored/malformed` and never throw
- [ ] `npm run lint` + `npm run typecheck` clean
