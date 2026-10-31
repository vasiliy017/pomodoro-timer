---
status: Accepted
owner: "Vasiliy"
reviewers: []
updated_at: "2026-10-31"
feature_size: "M"
ticket: ""
---

# 0009 — Hide the single timer window on close and reopen it from the Dock; no tray

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Vasiliy (owner), with Claude during the `design` pass (easy depth, assumptions ledger A12; closes spec §8 Q3 together with ADR-0002)

## Context

AC-13 says closing the window keeps the timer running. Clicking the Dock icon or the notification
reopens the window, and "there is only ever one timer window". The menu-bar icon was removed from
v1 at roadmap review (spec §3), but
[repo ADR-0002](../../../adr/0002-run-the-timer-engine-in-the-main-process.md) and
`architecture-map.md` still assume a tray. The scaffold currently creates a new window on
`activate` when none exist, and lets the window be destroyed on close.

## Decision drivers

- AC-13: one timer window, reopened from the Dock or the notification, showing the current state
  immediately.
- AC-05 and AC-06: a notification click brings the timer window to the front, and the phase-end
  message is still there after close and reopen.
- Spec §6 NFR *Background resource use*: ≤ 1% average CPU, window closed.
- Spec §6 NFR *Control responsiveness*: ≤ 100 ms.

## Considered options

1. **Hide on close.** One `BrowserWindow` is created at launch and lives until quit. Its `close`
   event is intercepted (unless the app is quitting) and turned into `hide()`. The Dock
   `activate` event, a notification click and a `second-instance` launch all call `show()` +
   `focus()` on that window.
2. **Destroy on close, recreate on reopen.** The window is destroyed on close. `activate` or a
   notification click creates a fresh window, which pulls a snapshot on mount.

## Decision outcome

**Chosen:** option 1. A single long-lived window makes "only ever one timer window" trivially
true and makes reopening instant. A hidden Chromium renderer is throttled and its countdown
interval only runs while visible (ADR-0006), so it costs nothing measurable in the background.
Option 2 saves the renderer's memory while closed, but it pays a full page load on every reopen
and needs guards against two windows being created by racing `activate` and notification clicks.

## Consequences

**Positive**
- Reopening is instant, and the first frame is already correct (the countdown is computed from
  `endsAt`).
- One owner for the window (`src/main/window.ts`): `show()` is the only reopen path, used by the
  Dock, notifications and second launches alike.
- No tray: the window and the Dock are the only surfaces. This supersedes the menu-bar assumption
  in repo ADR-0002.

**Negative**
- The renderer's memory stays resident while the window is closed.
- Real quit needs an `isQuitting` flag, so the `close` interceptor lets the window go during
  ⌘Q, Dock Quit, logout and shutdown.

**Neutral**
- Later ritual windows (roadmap steps 5–6) are separate windows with their own lifecycle. This ADR
  covers only the timer window.

## Links

- Spec: [[../spec.md]] AC-05, AC-06, AC-13, §3 (no menu-bar icon), §8 Q3
- SAD: [[../sad.md]] §5, §7
- Supersedes (in part): [repo ADR-0002](../../../adr/0002-run-the-timer-engine-in-the-main-process.md), the menu-bar icon / tray assumptions in its context, drivers and consequences
- Related ADR: [[0006-push-snapshots-on-change-and-count-down-in-the-window]], [[0007-add-a-typed-main-to-renderer-event-contract]]
