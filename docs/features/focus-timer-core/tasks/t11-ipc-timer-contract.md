---
id: T11
title: "Add timerGetState, timerCommand and the typed timer:state event across shared, main and preload"
layer: "ports"
deps: ["T6", "T7", "T10"]
blocks: ["T12", "T15"]
acs: ["AC-02", "AC-12"]
files_hint: ["src/shared/ipc.ts", "src/main/ipc.ts", "src/main/ipc.test.ts", "src/preload/index.ts", "src/main/index.ts"]
owner: "Vasiliy"
estimate: "M"
context_budget: "M"
status: "done"
step: "COMMIT"
---

<!-- To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous,
or contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T11 — Add timerGetState, timerCommand and the typed timer:state event across shared, main and preload

## Place in the sequence

- **Blocked by:** T6 — clock, T7 — signals/window, T10 — timer service · **Blocks:** T12 — useTimerState, T15 — main wiring · **Wave:** 6.
- **Lane:** **compile-coupled contract task** (tasks step 5): `Api` and `Handlers` are mapped over `InvokeContract`, so adding entries breaks `src/main/ipc.ts` and `src/preload/index.ts` until both implement them — all three land here together. `registerIpcHandlers` gains a service argument, so the one call in `src/main/index.ts` changes too; shares `src/main/index.ts` with T15 (serialized by `deps`).

## Why (user story)

> **As a** User
> **I want** start a focus session and see the time left
> **So that** I work in a timed block
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

This task opens the only door between the window and the timer: two calls and one event.

## Inlined context

> **Hard rule:** Every renderer → main call is declared once in `InvokeContract` in `src/shared/ipc.ts`, with its channel in `invokeChannels`. Never hand-write a channel string anywhere else. Main registers handlers only in `src/main/ipc.ts`. Handlers return values; the registrar wraps them in `Result` [...]. Add the method to the `api` object in `src/preload/index.ts`; `Api` keeps it type-checked.
>
> — `CLAUDE.md §IPC contract, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> **Chosen:** option 1. It extends the existing contract pattern symmetrically: one declaration, type-checked on both ends, with no channel string outside `src/shared/ipc.ts`.
>
> — `adr/0007-add-a-typed-main-to-renderer-event-contract.md §Decision outcome, abridged` · full text: [ADR-0007](../adr/0007-add-a-typed-main-to-renderer-event-contract.md)

> **Hard rule:** Renderer hardening is fixed: `contextIsolation: true`, `nodeIntegration: false` and `sandbox: true`. The renderer reaches main only through `window.api`.
>
> — `sad.md §2, Technical constraints, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read [public-api.md](../contracts/public-api.md) §2–§4 in full and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

| Name | Channel | Args | Result value |
|---|---|---|---|
| `timerGetState` | `timer:get-state` | `[]` | `TimerSnapshot` |
| `timerCommand` | `timer:command` | `[command: TimerCommand]` | `CommandOutcome` |

| Event | Channel | Payload | Sent when |
|---|---|---|---|
| `timerState` | `timer:state` | `TimerSnapshot` | every state change; never while nothing changes |

```ts
export interface EventContract { timerState: TimerSnapshot }
type Api = {
  ping(message: string): Promise<Result<string>> // unchanged
  timerGetState(): Promise<Result<TimerSnapshot>>
  timerCommand(command: TimerCommand): Promise<Result<CommandOutcome>>
  onTimerState(listener: (snapshot: TimerSnapshot) => void): () => void
}
```

The `timerCommand` handler takes `unknown` at runtime; a payload failing `isTimerCommand` → `ok` + `{ kind: 'ignored', reason: 'malformed', snapshot }`. `Result`'s `{ ok: false, error }` is used **only** for an unexpected throw, logged as `[ipc] <name> failed`. Main sends only through `broadcast(name, payload)` in `src/main/ipc.ts`, to every open window.

— `contracts/public-api.md §2, §3, §4, abridged` · full text: [public-api.md](../contracts/public-api.md)

## Acceptance criteria

### AC-02 — error

> **Then** [...] a repeated click on any control — Start, Pause, Reset, Skip or Restart cycle — has the same effect as one click, because each command acts only on the phase the User saw when they clicked
>
> — `spec.md §5, AC-02, abridged` · full text: [spec.md](../spec.md)

### AC-12 — happy

> **Then** [...] a Restart cycle that would lose something never takes effect without the User's confirmation, whichever window sends it
>
> — `spec.md §5, AC-12, abridged` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add the two entries to `InvokeContract` + `invokeChannels`, add `EventContract` + `eventChannels` + `EventName`, extend `Api` with `onTimerState` (keep `ping`) — `src/shared/ipc.ts`
- [ ] `registerIpcHandlers({ timer })` with `timerGetState: () => timer.getSnapshot()` and `timerCommand: (cmd) => timer.command(cmd)`; add typed `broadcast<K extends EventName>(name, payload)` over `BrowserWindow.getAllWindows()` — `src/main/ipc.ts`
- [ ] Preload: `timerGetState`, `timerCommand`, `onTimerState` (wraps `ipcRenderer.on(eventChannels.timerState)`, returns an unsubscribe that calls `removeListener`) — `src/preload/index.ts`
- [ ] In `src/main/index.ts`, construct the service (real clock, `createSignals` from T7 with `onClick` showing the window `createMainWindow` returned, `broadcast`, `DEFAULT_TIMER_CONFIG`) and pass it to `registerIpcHandlers`; nothing else in that file changes here (T15 moves the window to `window.ts`) — `src/main/index.ts`
- [ ] Type-level and unit tests (registrar with a fake service + mocked `ipcMain`: malformed → `ok` + ignored; throw → `ok: false` + log) — `src/main/ipc.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Renderer sends `{ type: 'setTime', ms: 0 }` | `ok` + `ignored/malformed`, state untouched |
| Service throws unexpectedly | `{ ok: false, error }` + `console.error('[ipc] timerCommand failed', …)` |
| `restartCycle` `confirmed: false` with progress | `ok` + `needsConfirmation` + `loss` |
| Listener unsubscribed | no further callbacks for that listener |

## Definition of Done

- [ ] `npm run typecheck` passes with the new `InvokeContract`, `EventContract` and `Api` across shared, main and preload
- [ ] `src/main/ipc.test.ts` passes (malformed → ignored; throw → `ok: false` and logged)
- [ ] `grep -rn "'timer:" src` finds the channel strings only in `src/shared/ipc.ts`
- [ ] `npm run build` succeeds (preload still emitted as `index.cjs`); `npm run lint` clean
