---
status: Draft
owner: "Vasiliy"
reviewers: []
updated_at: "2026-10-31"
feature_size: "M"
contract_form: "typed IPC (public-api)"
---

# Public API — focus-timer-core

**Why this contract exists.** The timer lives in main
([repo ADR-0002](../../../adr/0002-run-the-timer-engine-in-the-main-process.md)), and the
sandboxed renderer reaches it only through `window.api`. This document defines what the window
can see (a `TimerSnapshot`) and the one thing it can do (send a `TimerCommand`). It does not let
the window set the time, the phase or the cycle (spec §6.1). The SAD's only surface is
`desktop-app`, with no backend, HTTP or event bus. So the contract is the typed main ↔ renderer IPC
in `src/shared/ipc.ts`, written as TypeScript signatures, not as OpenAPI.

**Where it lives in code.** The types go in `src/shared/timer.ts`. The contract entries go in
`src/shared/ipc.ts` (`InvokeContract`, `invokeChannels`, the new `EventContract` and
`eventChannels`, and `Api`). The handlers go in `src/main/ipc.ts` and the bridge in
`src/preload/index.ts`. Channel strings appear only in `src/shared/ipc.ts`.

## 1. Shared types (`src/shared/timer.ts`)

```ts
export type PhaseKind = 'focus' | 'shortBreak' | 'longBreak'
export type PhaseStatus = 'ready' | 'running' | 'paused'

/** Which controls the window offers right now (AC-02b). `start` also means Resume when paused. */
export interface Controls {
  start: boolean
  pause: boolean
  reset: boolean
  skip: boolean
  restartCycle: boolean
}

/**
 * The phase-end message on the timer screen (AC-06, AC-14, AC-15). It stays until the next
 * command or the next phase end, and survives closing and reopening the window. The window owns
 * the wording.
 */
export interface Notice {
  /** `endedWhileAsleep`: the phase's end passed while the Mac was in system sleep (AC-14). */
  kind: 'phaseEnded' | 'endedWhileAsleep'
  endedPhase: PhaseKind
  /** True only for a focus session that counted as completed. Always false for a break. */
  counted: boolean
}

/** What a confirmed Restart cycle would throw away (AC-12). Main's quit guard uses the same summary (AC-13). */
export interface RestartLoss {
  /** Completed focus sessions that would no longer count toward the long break. 0..4. */
  completedInCycle: number
  /** The running or paused phase that would end uncounted, or null when the phase is ready. */
  phaseInProgress: PhaseKind | null
}

/** Everything the window shows. Main pushes a full snapshot on every state change (ADR-0006). */
export interface TimerSnapshot {
  /** Increments on every state change, starts at 0 on launch (ADR-0008). Never reused within a run. */
  revision: number
  phase: PhaseKind
  status: PhaseStatus
  /** Full length of the current phase, in ms (25:00 / 5:00 / 15:00 by default). */
  durationMs: number
  /**
   * Time left when the snapshot was made, in ms. Ready → durationMs. Paused → the frozen value
   * (AC-04). Running → informational: the window computes from `endsAt`.
   */
  remainingMs: number
  /** Wall-clock epoch ms when the running phase ends. null unless status is 'running'. */
  endsAt: number | null
  /** Completed focus sessions in the current cycle, 0..focusSessionsPerCycle (AC-01, AC-07, AC-09). */
  completedInCycle: number
  /** The «N» of «focus session N of 4»: completedInCycle + 1 on a focus phase, null on a break (AC-01). */
  focusNumber: number | null
  /** The «of 4»: focus sessions per cycle from the timer config (4 by default). */
  focusSessionsPerCycle: number
  notice: Notice | null
  controls: Controls
}

/** The only commands the window can send (spec §6.1). Each targets the revision the User saw. */
export type TimerCommand =
  | { type: 'start' | 'pause' | 'reset' | 'skip'; revision: number }
  | { type: 'restartCycle'; revision: number; confirmed: boolean }

/** What happened to a command. Expected failures are outcomes, not errors (ADR-0008). */
export type CommandOutcome =
  | { kind: 'applied'; snapshot: TimerSnapshot }
  | { kind: 'ignored'; reason: IgnoredReason; snapshot: TimerSnapshot }
  | { kind: 'needsConfirmation'; loss: RestartLoss; snapshot: TimerSnapshot }

export type IgnoredReason =
  /** The command's revision is not the current one: a repeat, a late command, a stale dialog. */
  | 'staleRevision'
  /** The control table does not offer this command in the current state (AC-02b). */
  | 'notAllowed'
  /** The payload failed the type guard (spec §6.1: the renderer is untrusted). */
  | 'malformed'

/** Type guard main runs on every `timerCommand` payload before the rules see it. */
export function isTimerCommand(value: unknown): value is TimerCommand
```

**Invariants the rules guarantee (checked by the property test):**

- `endsAt !== null` exactly when `status === 'running'`.
- `remainingMs` is in `0..durationMs`. A window displays `clamp(endsAt − Date.now(), 0, durationMs)`
  while running.
- `focusNumber === completedInCycle + 1` when `phase === 'focus'`, else `null`.
- `controls` equals the AC-02b row for `(phase, status)`. For example, `skip` is false on a ready focus session.
- `needsConfirmation` is returned only for `restartCycle` with `confirmed: false` when the loss is
  non-empty (`completedInCycle > 0 || phaseInProgress !== null`). Its snapshot is unchanged and its
  revision stays current.
- `ignored` never changes state, so `snapshot.revision` is the current, unchanged revision.

## 2. Invoke calls (renderer → main)

Added to `InvokeContract` and `invokeChannels` in `src/shared/ipc.ts`. The registrar in
`src/main/ipc.ts` wraps each handler's return value in `Result`.

| Name | Channel | Args | Result value | Spec |
|---|---|---|---|---|
| `timerGetState` | `timer:get-state` | `[]` | `TimerSnapshot` | AC-01, AC-13 (Flow 3) |
| `timerCommand` | `timer:command` | `[command: TimerCommand]` | `CommandOutcome` | AC-01…AC-12, AC-15 (Flows 1, 4–7, 9) |

```ts
export interface InvokeContract {
  ping: { args: [message: string]; result: string } // unchanged
  timerGetState: { args: []; result: TimerSnapshot }
  timerCommand: { args: [command: TimerCommand]; result: CommandOutcome }
}
```

The handler for `timerCommand` takes `unknown` at runtime. A payload that fails `isTimerCommand`
returns `{ kind: 'ignored', reason: 'malformed', snapshot }`. It is not a thrown error.

**Error channel.** `Result`'s `{ ok: false, error }` is used **only** for an unexpected throw
inside main, which the registrar logs as `[ipc] <name> failed` (CLAUDE.md *IPC contract*). Every
expected case is an `ok: true` outcome:

| Case (sequence branch) | Return |
|---|---|
| Command applied (Flows 1, 4, 5, 6, 7 confirm, 9) | `ok` → `applied` |
| Stale revision: double-click, late command, stale dialog (Flow 4 alt 1, Flow 7 alt 3) | `ok` → `ignored` / `staleRevision` |
| Command not offered in this state (Flow 4 alt 2, Flow 6 postcondition) | `ok` → `ignored` / `notAllowed` |
| Malformed payload (Flow 4 alt 2, spec §6.1) | `ok` → `ignored` / `malformed` |
| Restart cycle would lose progress, unconfirmed (Flow 7) | `ok` → `needsConfirmation` + `loss` |
| Restart cycle with nothing to lose (Flow 7 alt 4) | `ok` → `applied` on the first, unconfirmed command |
| Unexpected exception in main | `{ ok: false, error: <message> }` |

## 3. Events (main → renderer)

A new `EventContract` and `eventChannels` in `src/shared/ipc.ts`
([ADR-0007](../adr/0007-add-a-typed-main-to-renderer-event-contract.md)). Main sends only through
`broadcast(name, payload)` in `src/main/ipc.ts`, to every open window.

| Name | Channel | Payload | Sent when |
|---|---|---|---|
| `timerState` | `timer:state` | `TimerSnapshot` | Every state change: command applied, phase end, sleep/wake result, new day, clock change. Never while nothing changes (ADR-0006) |

```ts
export interface EventContract {
  timerState: TimerSnapshot
}
```

This is an in-process push between two processes on the same Mac. It has no broker, retries or
dead-letter queue. A window that misses events (none are dropped while it exists) catches up with
`timerGetState`.

## 4. `window.api` additions (`src/preload/index.ts`)

```ts
type Api = {
  ping(message: string): Promise<Result<string>> // unchanged
  timerGetState(): Promise<Result<TimerSnapshot>>
  timerCommand(command: TimerCommand): Promise<Result<CommandOutcome>>
  /** Subscribes to `timer:state`. Returns the unsubscribe function. */
  onTimerState(listener: (snapshot: TimerSnapshot) => void): () => void
}
```

**Consumer rule (the renderer and any later window).** A snapshot reaches the window two ways:
the `timer:state` broadcast and the `snapshot` inside a `CommandOutcome`. Flow 1 shows the
broadcast arriving before the outcome, but neither order is guaranteed. **Keep the snapshot with
the highest `revision`, and drop any older one.** Send every command with that snapshot's
`revision`. On mount: subscribe first, then call `timerGetState()`, then apply the same rule.

## 5. Examples (placeholder values)

**Start a ready focus session (AC-01)**, request:

```json
{ "type": "start", "revision": 0 }
```

Success (`Result.value`):

```json
{
  "kind": "applied",
  "snapshot": {
    "revision": 1,
    "phase": "focus",
    "status": "running",
    "durationMs": 1500000,
    "remainingMs": 1500000,
    "endsAt": 1793430000000,
    "completedInCycle": 0,
    "focusNumber": 1,
    "focusSessionsPerCycle": 4,
    "notice": null,
    "controls": { "start": false, "pause": true, "reset": true, "skip": true, "restartCycle": true }
  }
}
```

Repeated click (AC-02), the same request again:

```json
{ "kind": "ignored", "reason": "staleRevision", "snapshot": { "revision": 1, "...": "unchanged" } }
```

**Restart cycle with 3 completed and a running phase (AC-12)**, request:

```json
{ "type": "restartCycle", "revision": 7, "confirmed": false }
```

Response:

```json
{
  "kind": "needsConfirmation",
  "loss": { "completedInCycle": 3, "phaseInProgress": "focus" },
  "snapshot": { "revision": 7, "...": "unchanged" }
}
```

Then `{ "type": "restartCycle", "revision": 7, "confirmed": true }` → `applied`, with
`revision: 8`, `completedInCycle: 0`, `focusNumber: 1` and status `ready`.

**`timer:state` after a focus session ended while the Mac slept (AC-14)**:

```json
{
  "revision": 12,
  "phase": "shortBreak",
  "status": "ready",
  "durationMs": 300000,
  "remainingMs": 300000,
  "endsAt": null,
  "completedInCycle": 1,
  "focusNumber": null,
  "focusSessionsPerCycle": 4,
  "notice": { "kind": "endedWhileAsleep", "endedPhase": "focus", "counted": false },
  "controls": { "start": true, "pause": false, "reset": false, "skip": true, "restartCycle": true }
}
```

**Unexpected failure in main** (`Result`):

```json
{ "ok": false, "error": "<message of the thrown error>" }
```
