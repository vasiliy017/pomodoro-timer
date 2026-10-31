---
status: Accepted
owner: "Vasiliy"
reviewers: []
updated_at: "2026-10-31"
feature_size: ""
ticket: ""
---

# 0002 — Run the timer engine in the main process; the UI only renders its state

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Vasiliy (owner), with Claude during the greenfield `survey` session
- **Partially superseded (2026-10-31):** the menu-bar icon / tray assumptions are superseded by
  [focus-timer-core ADR-0009](../features/focus-timer-core/adr/0009-hide-the-single-timer-window-on-close.md)
  (no tray in v1; window + Dock only). The claim that clock jumps cause no drift is superseded by
  [focus-timer-core ADR-0002](../features/focus-timer-core/adr/0002-trust-the-wall-clock-with-clamps.md)
  (wall clock with clamps; a forward jump can end a phase). The core decision, engine in main with
  pure rules in `src/shared`, stands.

## Context

The timer must keep running and finish on time while every window is hidden. The menu-bar icon
shows the remaining time. At session end the app shows its own window and fires a fallback native
notification (idea-brief §7). Several consumers (tray, main window, session-end window,
notifications) must agree on one timer state.

## Decision drivers

- The session-end moment must fire reliably even when no window is visible (idea-brief §7, §6
  risk 3).
- The menu bar and the windows need a single source of truth.
- The timer rules should be easy to test without Electron.

## Considered options

1. **Timer engine in the main process.** A pure state machine in `src/shared`, run by main.
   Renderers subscribe to state events.
2. **Timer in the renderer** (React state or a hook). Simple, but Chromium throttles background
   timers in a hidden window, and tray and notifications would need state pushed back to main.

## Decision outcome

**Chosen:** the timer engine runs in the main process. Main is always alive, owns the tray,
notifications and windows, and does not throttle background timers the way a hidden renderer
does. Remaining time is computed from timestamps, so sleep/wake and clock jumps do not cause
drift. The rules live in pure `src/shared/timer.ts` and are unit-tested with fake timers.

## Consequences

**Positive**
- One authoritative state for tray, windows and notifications.
- The session-end window can be opened by main even when the UI is closed.
- The domain logic is pure and easy to test.

**Negative**
- Every user action crosses IPC (renderer → preload → main), so the IPC contract must be
  maintained.
- Animations that track the countdown are driven by received state plus local interpolation, not
  by the renderer's own timer.

**Neutral**
- Moving the engine later (e.g. into a utility process) only touches main's wiring, not the shared
  rules.

## Links

- Idea brief: [[../idea-brief.md]] §6, §7
- Architecture map: [[../architecture-map.md]] §Module inventory, §Conventions
- Related ADR: [[0001-build-on-electron-react-typescript]]
