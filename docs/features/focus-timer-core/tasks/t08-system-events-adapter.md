---
id: T8
title: "Map powerMonitor and macOS clock / time-zone notifications to timer callbacks"
layer: "infra"
deps: []
blocks: ["T15"]
acs: ["AC-14", "AC-15"]
files_hint: ["src/main/system-events.ts", "src/main/system-events.test.ts"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---

<!-- To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous,
or contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T8 — Map powerMonitor and macOS clock / time-zone notifications to timer callbacks

## Place in the sequence

- **Blocked by:** — · **Blocks:** T15 — main wiring · **Wave:** 1 (parallel with T1, T6, T17).
- **Lane:** own lane. Takes plain callbacks, so it needs neither the rules nor the service.

## Why (user story)

> **As a** User
> **I want** the timer to keep real time while the Mac sleeps, without counting a focus session that ended while it slept
> **So that** the time is right when I come back and the cycle stays honest
>
> — `spec.md §4, US-09, verbatim` · full text: [spec.md](../spec.md)

This task turns the OS events into the inputs the rules need.

## Inlined context

> `system-events.ts` ✚ powerMonitor suspend/resume/shutdown → service inputs and the quit flag; systemPreferences clock / time-zone notifications → clockChanged
>
> — `sad.md §5, internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> The macOS notifications `NSSystemClockDidChangeNotification` (via `systemPreferences.subscribeLocalNotification`) and `NSSystemTimeZoneDidChangeDistributedNotification` (via `subscribeNotification`) feed a `clockChanged` input: new-day check plus deadline re-arm (AC-15)
>
> — `sad.md §8, Time row, abridged` · full text: [sad.md](../sad.md)

> macOS quits the app for logout, restart or shutdown → reports shutdown before the quit request → sets the OS-quit flag → quits at once, never asks and never blocks
>
> — `sad.md §6, Flow 8 last branch, abridged` · full text: [sad.md](../sad.md)

> **Risk:** `powerMonitor` `suspend` arrives late or not at all before the Mac sleeps. [...] The macOS clock / time-zone notifications may not reach Electron's main process [...]. Fallback: the new-day check still runs on every command, wake, launch and deadline.
>
> — `sad.md §11, risks 1 and 3, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read [sad.md](../sad.md) §8/§11 and [ADR-0005](../adr/0005-feed-sleep-and-wake-into-the-rules-from-powermonitor.md). Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-14 — cross-context

> **Then** [...] «asleep» means system sleep only (lid closed, Sleep from the menu, automatic sleep, including Power Nap's brief background wakes) — a locked screen, a sleeping display or a screen saver is not sleep, and a phase ends as usual during them
>
> — `spec.md §5, AC-14, abridged` · full text: [spec.md](../spec.md)

### AC-15 — cross-context

> **Then** [...] the app checks for a new day at the Mac's local midnight, when the Mac wakes, at launch and when the Mac's time zone or clock changes
>
> — `spec.md §5, AC-15, abridged` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `subscribeSystemEvents(handlers: { onSleep, onWake, onShutdown, onClockChanged }, deps = { powerMonitor, systemPreferences })` → `unsubscribe()` — `src/main/system-events.ts`
- [ ] `suspend` → `onSleep`, `resume` → `onWake`, `shutdown` → `onShutdown`; the two clock/time-zone notifications → `onClockChanged`; ignore `lock-screen` / display sleep — `src/main/system-events.ts`
- [ ] Tests with `EventEmitter` fakes for `powerMonitor` and a recording fake for `systemPreferences`; unsubscribe removes every listener — `src/main/system-events.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| `lock-screen` / `unlock-screen` | no callback (not sleep) |
| `subscribe*Notification` unavailable (non-macOS test env) | skipped without throwing |
| `resume` without a preceding `suspend` | `onWake` still fires (the rules handle it) |

## Definition of Done

- [ ] `src/main/system-events.test.ts` passes in the node project
- [ ] no timer logic in this file — only event → callback mapping (review)
- [ ] `npm run lint` + `npm run typecheck` clean
