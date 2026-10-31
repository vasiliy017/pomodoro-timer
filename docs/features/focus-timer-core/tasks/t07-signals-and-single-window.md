---
id: T7
title: "Add the phase-end signals adapter and the single hide-on-close timer window"
layer: "infra"
deps: ["T1"]
blocks: ["T11", "T15"]
acs: ["AC-05", "AC-06", "AC-13"]
files_hint: ["src/main/signals.ts", "src/main/signals.test.ts", "src/main/window.ts", "src/main/window.test.ts"]
owner: "Vasiliy"
estimate: "M"
context_budget: "M"
status: "done"
step: "COMMIT"
---

<!-- To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous,
or contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T7 — Add the phase-end signals adapter and the single hide-on-close timer window

## Place in the sequence

- **Blocked by:** T1 — timer types · **Blocks:** T11 — IPC contract (constructs the service with signals), T15 — main wiring · **Wave:** 2 (parallel with T2, T9).
- **Lane:** own lane (new files only; `src/main/index.ts` is rewired later by T15).

## Why (user story)

> **As a** User
> **I want** closing the window to keep the timer running, and to reopen the window from the Dock
> **So that** the window is out of my way without stopping my session
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

This task builds the two Electron adapters that tell the User about a phase end and keep exactly one window alive.

## Inlined context

> `signals.ts` ✚ phase-end Notification (kept referenced until closed) + app.dock.bounce('informational')
> `window.ts` ✚ the single timer BrowserWindow: hide on close, show() for every reopen path
>
> — `sad.md §5, internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> On every phase end, in this order: one Notification (kept referenced until closed so its click handler survives garbage collection; a click → `window.show()`), one `app.dock.bounce('informational')`, and a `notice` in the state. [...] The app never raises the window by itself
>
> — `sad.md §8, Phase-end signalling row, abridged` · full text: [sad.md](../sad.md)

> **Chosen:** option 1. A single long-lived window makes "only ever one timer window" trivially true and makes reopening instant. [...] Option 2 [...] needs guards against two windows being created by racing `activate` and notification clicks.
>
> — `adr/0009-hide-the-single-timer-window-on-close.md §Decision outcome, abridged` · full text: [ADR-0009](../adr/0009-hide-the-single-timer-window-on-close.md)

> **Hard rule:** Renderer hardening is fixed: `contextIsolation: true`, `nodeIntegration: false` and `sandbox: true`.
>
> — `sad.md §2, Technical constraints, verbatim` · full text: [sad.md](../sad.md)

> Notifications only name the phase that ended and the ready phase; there is no user-entered text in this step.
>
> — `spec.md §6.1, abuse cases, abridged` · full text: [spec.md](../spec.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. Consumes the shared `Notice` and `PhaseKind` (T1) to word the notification.

## Acceptance criteria

### AC-05 — happy

> **Given** a focus session is running and the timer window is hidden behind other apps or closed
> **When** the focus session's time runs out
> **Then** a system notification appears saying the focus session is complete and that a short break (or long break) is ready, and clicking it brings the timer window to the front; the same applies when a break ends («break over — focus session ready»)
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-06 — cross-context

> **Then** [...] the app's Dock icon bounces once (it does not keep bouncing), so the phase end is never completely silent; because the app cannot tell whether the Mac hid its notification, the Dock icon does this on every phase end; the app never opens or raises the timer window by itself
>
> — `spec.md §5, AC-06, abridged` · full text: [spec.md](../spec.md)

### AC-13 — happy

> **Then** the focus session keeps running and its phase-end notification still arrives; clicking the Dock icon (or the notification) reopens the window, which shows the current remaining time immediately, not an older value counting down; there is only ever one timer window — reopening shows that same window, never a second one
>
> — `spec.md §5, AC-13, abridged (quit part → T9/T15)` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `phaseEndMessage(notice, ready: { phase, focusNumber })` → `{ title, body }`: «Focus session complete — short break ready», «… long break ready», «Break over — focus session N ready», «Focus session ended while the Mac was asleep (not counted) — …», «Break ended while the Mac was asleep — …» — `src/main/signals.ts`
- [ ] `createSignals({ onClick })` → `{ notify(notice, ready), bounceDock() }`; keep each `Notification` in a Set until `close`/`click`, `click` → `onClick()`; `bounceDock` → `app.dock?.bounce('informational')` — `src/main/signals.ts`
- [ ] `createTimerWindow()` → `{ show(), allowClose(), window }`: one `BrowserWindow` with the existing size/title/hardened `webPreferences` and dev-URL/file loading moved from `src/main/index.ts`; `close` → `preventDefault()` + `hide()` unless `allowClose()` was called; `show()` → `show()` + `focus()` — `src/main/window.ts`
- [ ] Node-project tests with `vi.mock('electron')`: one notification per `notify`, retained until closed, click calls `onClick`; one `bounce('informational')`; close hides; after `allowClose()` close is not prevented; `show()` never creates a second window — `src/main/signals.test.ts`, `src/main/window.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| `Notification.isSupported()` false or permission blocked | `notify` is a no-op without throwing; `bounceDock` still runs (AC-06) |
| Notification garbage-collected before click | prevented: held in the Set until `close` |
| `show()` called twice quickly (Dock + notification click) | the same window, focused once |
| Window `close` during app quit | allowed only after `allowClose()` (T15 calls it once the quit guard lets the quit proceed) |

## Definition of Done

- [ ] `src/main/signals.test.ts` and `src/main/window.test.ts` pass in the node project
- [ ] the notification wording covers every `Notice` kind × ready phase and names no user data
- [ ] every Hard Rule inlined above still holds (hardened `webPreferences` unchanged)
- [ ] `npm run lint` + `npm run typecheck` clean
