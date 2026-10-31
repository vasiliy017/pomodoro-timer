---
id: T16
title: "Add Playwright end-to-end tests for launch time, control latency and hidden-window phase end"
layer: "tests"
deps: ["T14", "T15"]
blocks: []
acs: ["AC-01", "AC-05", "AC-13"]
files_hint: ["e2e/boot.spec.ts", "e2e/timer.spec.ts"]
owner: "Vasiliy"
estimate: "M"
context_budget: "M"
status: "done"
step: "COMMIT"
---

<!-- To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous,
or contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T16 — Add Playwright end-to-end tests for launch time, control latency and hidden-window phase end

## Place in the sequence

- **Blocked by:** T14 — Restart-cycle dialog, T15 — main wiring · **Blocks:** — · **Wave:** 10 (last).
- **Lane:** shares `e2e/boot.spec.ts` with T13 — serialized by `deps`.

## Why (user story)

> **As a** User
> **I want** a system notification when any phase ends
> **So that** I notice it even with the window hidden
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

This task proves the assembled app meets the timing NFRs end to end.

## Inlined context

> | Phase-end detection latency | ≤ 1 s from a phase's scheduled end to its notification and on-screen change, window hidden or closed, Mac awake |
> | Control responsiveness | ≤ 100 ms from a click on Start, Pause, Reset, Skip or Restart cycle to the visible change |
> | Launch time | ≤ 2 s from a cold launch to the timer screen showing a ready focus session |
>
> — `spec.md §6, NFR table, abridged` · full text: [spec.md](../spec.md)

> A Playwright `_electron` test launched with `POMODORO_TEST_TIMER_CONFIG` (phases of a few seconds) and the window hidden checks the snapshot change within 1 s. [...] QG-4: an end-to-end Playwright test timing click → screen change for each of the five controls. [...] QG-6: the end-to-end boot test (`e2e/boot.spec.ts`, extended) timing launch to the first window showing «focus session 1 of 4» ready.
>
> — `sad.md §10, QG-1, QG-4, QG-6 How verify, abridged` · full text: [sad.md](../sad.md)

> Inside VS Code (or any Electron-based host) `ELECTRON_RUN_AS_NODE=1` may be set in the shell [...]. The e2e test strips it itself.
>
> — `CLAUDE.md §Commands, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** insufficient or contradicted by the code → read [sad.md](../sad.md) §8 *Test seams* and §10. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface (drives the UI; may read `window.api.onTimerState` from the page to timestamp snapshot arrival).

## Acceptance criteria

### AC-01 — happy

> **Given** the User has a ready focus session and the cycle is at 0 of 4
> **When** the User starts it
> **Then** the focus session runs, counting down from 25:00, and the screen shows that it is a focus session and that it is focus session 1 of 4 in the cycle [...]
>
> — `spec.md §5, AC-01, abridged` · full text: [spec.md](../spec.md)

### AC-05 — happy

> **Given** a focus session is running and the timer window is hidden behind other apps or closed
> **When** the focus session's time runs out
> **Then** a system notification appears saying the focus session is complete and that a short break (or long break) is ready [...]
>
> — `spec.md §5, AC-05, abridged` · full text: [spec.md](../spec.md)

### AC-13 — happy

> **Given** a focus session is running with 18:00 left
> **When** the User closes the timer window
> **Then** the focus session keeps running [...]; clicking the Dock icon (or the notification) reopens the window, which shows the current remaining time immediately, not an older value counting down; there is only ever one timer window [...]
>
> — `spec.md §5, AC-13, abridged` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Boot test: time `electron.launch` → «Focus session 1 of 4» + `25:00` visible, assert ≤ 2 000 ms — `e2e/boot.spec.ts`
- [ ] Shared launch helper with `POMODORO_TEST_TIMER_CONFIG` (e.g. focus 3 s, breaks 2 s) and the `ELECTRON_RUN_AS_NODE` strip — `e2e/timer.spec.ts`
- [ ] Control latency: for Start, Pause, Resume, Reset, Skip, Restart cycle (+ dialog confirm) assert click → visible change ≤ 100 ms — `e2e/timer.spec.ts`
- [ ] Hidden phase end: start, close the window (hides it), record snapshot arrival time in the page, assert ≤ 1 000 ms after `endsAt`; reshow via `app.evaluate` and assert the ready short break + notice, and `BrowserWindow.getAllWindows().length === 1` — `e2e/timer.spec.ts`
- [ ] Teardown that does not hang on the quit guard (quit with nothing to lose, or confirm) — `e2e/timer.spec.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| CI machine slow on first launch | measure from `launch` resolve to visible text; keep the 2 s bound, do not retry-loop it away |
| Quit guard on teardown with progress | restart the cycle first, or stub `dialog.showMessageBox` via `app.evaluate` |
| Notification cannot be observed by Playwright | assert the snapshot + notice instead; the OS notification is covered by the manual check (T17) |

## Definition of Done

- [ ] `npm run test:e2e` passes locally with launch ≤ 2 s, every control ≤ 100 ms, hidden-window phase end ≤ 1 s, single window after reopen
- [ ] no hard-coded channel strings in the tests
- [ ] `npm run lint` + `npm run typecheck` clean
