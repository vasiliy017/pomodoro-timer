---
status: Accepted
owner: "Vasiliy"
reviewers: []
updated_at: "2026-10-31"
feature_size: "M"
ticket: ""
---

# 0007 — Add a typed main-to-renderer `EventContract` beside `InvokeContract`

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Vasiliy (owner), with Claude during the `design` pass (easy depth, assumptions ledger A10)

## Context

The scaffolded IPC contract in `src/shared/ipc.ts` covers only renderer → main calls
(`InvokeContract`, `invokeChannels`, `Api`). The repo convention already names a main → renderer
broadcast, `timer:state`, but nothing types it yet. focus-timer-core is the first feature that
needs one. Whatever shape it takes becomes the pattern for every later event: the session-end
ritual and the break ritual both subscribe to timer state.

## Decision drivers

- Repo convention: every channel is declared once in `src/shared/ipc.ts`, and no channel string
  is hand-written anywhere else (CLAUDE.md, *IPC contract*).
- Renderer hardening: the sandboxed renderer sees only `window.api`, never `ipcRenderer`.
- [ADR-0006](0006-push-snapshots-on-change-and-count-down-in-the-window.md): main pushes
  `TimerSnapshot`s.

## Considered options

1. **A typed `EventContract` in `src/shared/ipc.ts`.** `EventContract` maps an event name to its
   payload (`timerState: TimerSnapshot`), and `eventChannels` maps it to a channel
   (`timer:state`). The `Api` type gains one `on<Name>(listener) → unsubscribe` method per event
   (`onTimerState`). Main sends only through one typed `broadcast(name, payload)` in
   `src/main/ipc.ts`.
2. **One typed channel constant, no generic contract.** `src/shared/ipc.ts` exports
   `TIMER_STATE_CHANNEL` and the `TimerSnapshot` payload type. The preload hand-writes
   `onTimerState` around that constant, and main sends through it.
3. **A `MessagePort` per window.** Main transfers a port to each window and posts snapshots over
   it.

## Decision outcome

**Chosen:** option 1. It extends the existing contract pattern symmetrically: one declaration,
type-checked on both ends, with no channel string outside `src/shared/ipc.ts`. Option 2 obeys the rule with
less machinery today. But each later event (the ritual windows) would add another constant plus
hand-written preload and main glue, with nothing tying the name, channel and payload together.
Option 3 adds port lifecycle management for a single low-rate event.

## Consequences

**Positive**
- Adding a later event is one line in `EventContract` and one in `eventChannels`. `Api`, the
  preload and `broadcast` pick it up through the types.
- The `unsubscribe` return lets `useTimerState()` clean up in its effect, with no leaked listeners
  across hot reloads.

**Negative**
- `src/shared/ipc.ts` and `src/preload/index.ts` grow a second generic mapping that must be kept
  in step with the invoke side.

**Neutral**
- `broadcast` sends to every open `webContents`. Today there is one window
  ([ADR-0009](0009-hide-the-single-timer-window-on-close.md)), but later ritual windows receive
  snapshots without changes.

## Links

- Spec: [[../spec.md]] §6.1 (the window can only ask, never set state)
- SAD: [[../sad.md]] §5, §8
- Related ADR: [[0006-push-snapshots-on-change-and-count-down-in-the-window]], [[0008-target-each-command-at-the-revision-the-user-saw]]
