---
id: T15
title: "Wire main: single-instance lock, timer window, system events, quit guard, test config and App Nap opt-out"
layer: "wiring"
deps: ["T7", "T8", "T9", "T10", "T11"]
blocks: ["T16"]
acs: ["AC-03", "AC-13"]
files_hint: ["src/main/index.ts", "electron-builder.yml"]
owner: "Vasiliy"
estimate: "M"
context_budget: "M"
status: "todo"
step: ""
---

<!-- To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous,
or contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T15 — Wire main: single-instance lock, timer window, system events, quit guard, test config and App Nap opt-out

## Place in the sequence

- **Blocked by:** T7 — signals/window, T8 — system events, T9 — quit guard, T10 — timer service, T11 — IPC contract · **Blocks:** T16 — end-to-end tests · **Wave:** 7 (parallel with T12).
- **Lane:** shares `src/main/index.ts` with T11 — serialized by `deps`.

## Why (user story)

> **As a** User
> **I want** closing the window to keep the timer running, and to reopen the window from the Dock
> **So that** the window is out of my way without stopping my session
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

This task composes every main-process piece into the running app.

## Inlined context

> `index.ts` ✎ wiring: single-instance lock, window, timer service, quit guard, test-only timer config from POMODORO_TEST_TIMER_CONFIG when !app.isPackaged. `electron-builder.yml` ✎ mac.extendInfo: NSAppSleepDisabled: true (ADR-0004)
>
> — `sad.md §5, internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> Each macOS user account runs its own app process with its own in-memory timer, which is how AC-03 is satisfied. Within an account, `app.requestSingleInstanceLock()` keeps it to one process. A second launch quits immediately, and the first instance shows its existing window on `second-instance`.
>
> — `sad.md §7, Deployment view, verbatim` · full text: [sad.md](../sad.md)

> In an unpackaged build only (`app.isPackaged === false`, which covers the Playwright run of `out/` and `npm run dev`), main reads `POMODORO_TEST_TIMER_CONFIG`, a JSON object of phase lengths in ms. If set, it is passed to the rules as `config`. The packaged `.dmg` ignores it and always uses `DEFAULT_TIMER_CONFIG`
>
> — `sad.md §8, Test seams row, verbatim` · full text: [sad.md](../sad.md)

> **Chosen:** option 1. It removes the throttling that would break the 1 s target. It needs no start/stop logic in code, and unlike option 2 it never holds the Mac awake.
>
> — `adr/0004-disable-app-nap-in-the-app-bundle.md §Decision outcome, abridged` · full text: [ADR-0004](../adr/0004-disable-app-nap-in-the-app-bundle.md)

> Launch: takes the single-instance lock → reads now and the local date → fresh state, ready focus session 1 of 4 at 25:00, cycle 0 → arms one deadline at the next local midnight → opens the single timer window.
>
> — `sad.md §6, Flow 3, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read [sad.md](../sad.md) §5–§8 in full. Do not guess.

## Data delta

No DB changes. `createSettingsStore(...).load()` stays as it is.

## API contract

Internal — no API surface (uses `registerIpcHandlers({ timer })` and `broadcast` from T11).

## Acceptance criteria

### AC-03 — authorization

> **Given** a second person uses a different macOS account on the same Mac
> **When** they open the app
> **Then** they get their own timer, at a ready focus session with their own cycle, and cannot see or affect the User's running phase
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — happy

> **Then** the focus session keeps running and its phase-end notification still arrives; clicking the Dock icon (or the notification) reopens the window [...]; there is only ever one timer window — reopening shows that same window, never a second one; if instead the User quits the app [...] while something would be lost [...] the app first asks for confirmation [...]; on confirm, or when macOS quits the app for logout, shutdown or restart (never asked, never blocked), the running phase ends uncounted and the next launch shows focus session 1 of 4 as the ready phase with the cycle at 0
>
> — `spec.md §5, AC-13, abridged` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `requestSingleInstanceLock()`; false → `app.quit()` and return; `second-instance` → `timerWindow.show()` — `src/main/index.ts`
- [ ] Replace `createMainWindow` with `createTimerWindow()` (T7); `activate` and notification click → `timerWindow.show()` — `src/main/index.ts`
- [ ] Config: `!app.isPackaged && process.env.POMODORO_TEST_TIMER_CONFIG` → parse and merge over `DEFAULT_TIMER_CONFIG` (invalid JSON → log `[timer]` and use the default) — `src/main/index.ts`
- [ ] `subscribeSystemEvents({ onSleep: timer.sleep, onWake: timer.wake, onClockChanged: timer.clockChanged, onShutdown: guard.markOsInitiatedQuit })` — `src/main/index.ts`
- [ ] `installQuitGuard({ app, getLoss: timer.getRestartLoss, showConfirm, onQuitAllowed: timerWindow.allowClose })` — `src/main/index.ts`
- [ ] `mac.extendInfo.NSAppSleepDisabled: true` — `electron-builder.yml`

## Edge cases

| Case | Behaviour |
|---|---|
| Second launch in the same account | second process quits; the first shows its existing window |
| Window closed, then ⌘Q with nothing to lose | quits at once; the window close is allowed |
| `POMODORO_TEST_TIMER_CONFIG` set in a packaged build | ignored |
| `window-all-closed` on macOS | the app keeps running (unchanged) |

## Definition of Done

- [ ] `npm run build` succeeds and the app launches with `npm run dev` showing focus session 1 of 4 ready
- [ ] `npm run dist:mac` then `plutil -extract NSAppSleepDisabled raw "dist/mac-arm64/Pomodoro Timer.app/Contents/Info.plist"` prints `true`
- [ ] existing unit tests and `npm run test:e2e` still pass
- [ ] `npm run lint` + `npm run typecheck` clean
