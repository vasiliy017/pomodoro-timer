---
id: T12
title: "Add the useTimerState hook: subscribe, pull, keep the newest revision, count down while visible"
layer: "ui"
deps: ["T11"]
blocks: ["T13"]
acs: ["AC-04", "AC-13"]
files_hint: ["src/renderer/src/hooks/useTimerState.ts", "src/renderer/src/hooks/useTimerState.test.tsx"]
owner: "Vasiliy"
estimate: "S"
context_budget: "M"
status: "done"
step: "COMMIT"
---

<!-- To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous,
or contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T12 — Add the useTimerState hook: subscribe, pull, keep the newest revision, count down while visible

## Place in the sequence

- **Blocked by:** T11 — IPC timer contract (`window.api`) · **Blocks:** T13 — timer screen · **Wave:** 7 (parallel with T15).
- **Lane:** own lane.

## Why (user story)

> **As a** User
> **I want** closing the window to keep the timer running, and to reopen the window from the Dock
> **So that** the window is out of my way without stopping my session
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

This task makes the window show the true remaining time on its very first frame after it reappears.

## Inlined context

> A `useTimerState()` hook pulls a snapshot on mount, subscribes to `timer:state`, and counts down locally. No router and no state library.
>
> — `sad.md §4, UI architecture, abridged` · full text: [sad.md](../sad.md)

> **Chosen:** option 1. A snapshot with an absolute `endsAt` lets the window compute the correct remaining time at any instant, including the first frame after it is shown again.
>
> — `adr/0006-push-snapshots-on-change-and-count-down-in-the-window.md §Decision outcome, abridged` · full text: [ADR-0006](../adr/0006-push-snapshots-on-change-and-count-down-in-the-window.md)

> A hidden Chromium renderer is throttled and its countdown interval only runs while visible (ADR-0006)
>
> — `adr/0009-hide-the-single-timer-window-on-close.md §Decision outcome, abridged` · full text: [ADR-0009](../adr/0009-hide-the-single-timer-window-on-close.md)

> **Consumer rule.** A snapshot reaches the window two ways: the `timer:state` broadcast and the `snapshot` inside a `CommandOutcome`. [...] neither order is guaranteed. **Keep the snapshot with the highest `revision`, and drop any older one.** Send every command with that snapshot's `revision`. On mount: subscribe first, then call `timerGetState()`, then apply the same rule. A window displays `clamp(endsAt − Date.now(), 0, durationMs)` while running.
>
> — `contracts/public-api.md §4 Consumer rule + §1 invariants, abridged` · full text: [public-api.md](../contracts/public-api.md)

> [...] a jsdom test of `useTimerState()` showing the correct value on its first render after the window becomes visible.
>
> — `sad.md §10, QG-3 How verify, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read [public-api.md](../contracts/public-api.md) §4 and [ADR-0006](../adr/0006-push-snapshots-on-change-and-count-down-in-the-window.md). Do not guess.

## Data delta

No DB changes.

## API contract

Calls `window.api.onTimerState(listener) → unsubscribe`, `window.api.timerGetState() → Result<TimerSnapshot>`, `window.api.timerCommand(command) → Result<CommandOutcome>` (T11).

— `contracts/public-api.md §4, abridged` · full text: [public-api.md](../contracts/public-api.md)

## Acceptance criteria

### AC-04 — happy

> **Given** a focus session or a break is running with 12:34 left
> **When** the User pauses it and later resumes it
> **Then** while paused the remaining time stays at 12:34 and the screen shows the phase as paused; on resume it counts down from 12:34; a pause never expires on its own (only a new day clears it, AC-15)
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — happy

> **Then** [...] clicking the Dock icon (or the notification) reopens the window, which shows the current remaining time immediately, not an older value counting down
>
> — `spec.md §5, AC-13, abridged` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `useTimerState()` → `{ snapshot: TimerSnapshot | null, remainingMs: number, send(type, extra?) : Promise<CommandOutcome | null> }` — `src/renderer/src/hooks/useTimerState.ts`
- [ ] Mount: `onTimerState` first, then `timerGetState()`; accept a snapshot only if its `revision` ≥ the held one; unsubscribe on unmount — same file
- [ ] `remainingMs`: running → `clamp(endsAt − Date.now(), 0, durationMs)`, else `snapshot.remainingMs`; recompute on `visibilitychange` → visible and on a ~250 ms interval that runs only while `document.visibilityState === 'visible'` and status is running — same file
- [ ] `send`: builds the command with the held `revision`, applies the outcome's snapshot by the same rule, returns the outcome (T14 uses `needsConfirmation`) — same file
- [ ] jsdom tests with a fake `window.api` and fake timers — `src/renderer/src/hooks/useTimerState.test.tsx`

## Edge cases

| Case | Behaviour |
|---|---|
| Broadcast r+1 arrives before the `timerGetState` reply r | the r reply is dropped |
| Window hidden 18 min, then visible | first render after `visibilitychange` shows `endsAt − now`, not the pre-hide value |
| Paused snapshot | no interval runs; value is frozen |
| `timerGetState` returns `ok: false` | `snapshot` stays null; the hook does not throw |

## Definition of Done

- [ ] `src/renderer/src/hooks/useTimerState.test.tsx` passes: highest-revision rule both orders, correct value on the first render after becoming visible, no interval while hidden or paused, commands carry the held revision
- [ ] `npm run lint` + `npm run typecheck` clean
