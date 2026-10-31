---
id: T1
title: "Define the timer types, default config and pure snapshot helpers in src/shared/timer.ts"
layer: "domain"
deps: []
blocks: ["T2", "T7", "T9"]
acs: ["AC-01", "AC-02b"]
files_hint: ["src/shared/timer.ts", "src/shared/timer.test.ts"]
owner: "Vasiliy"
estimate: "M"
context_budget: "M"
status: "todo"
step: ""
---

<!-- To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous,
or contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T1 — Define the timer types, default config and pure snapshot helpers in src/shared/timer.ts

## Place in the sequence

- **Blocked by:** — · **Blocks:** T2 — command transitions, T7 — phase-end signals and single window, T9 — quit guard · **Wave:** 1 (the shared vocabulary every other task imports).
- **Lane:** shares `src/shared/timer.ts` + `timer.test.ts` with T2, T3, T4 — serialized as one chain.

## Why (user story)

> **As a** User
> **I want** start a focus session and see the time left
> **So that** I work in a timed block
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

This task fixes what the screen can know about the timer (the snapshot) and which controls it offers, before any transition exists.

## Inlined context

> `timer.ts` ✚ rules: TimerState, inputs, effects, transition(), toSnapshot(), allowedControls(), restartLoss(), DEFAULT_TIMER_CONFIG (25/5/15, 4)
>
> — `sad.md §5, internal decomposition, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** `src/shared/` — pure TypeScript: no Electron, DOM, React or `node:` imports (enforced by ESLint).
> As a result, the timer rules never call `Date.now()` themselves; time is always an input.
>
> — `CLAUDE.md §Process boundary, verbatim` + `sad.md §2 Conventions, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> **Chosen:** option 1. A pure function with time and the local date as explicit inputs is the cheapest way to drive 10,000 random sequences, clock jumps and sleep gaps through the real rules in a plain Vitest node test.
>
> — `adr/0001-model-timer-rules-as-a-pure-transition-function.md §Decision outcome, abridged` · full text: [ADR-0001](../adr/0001-model-timer-rules-as-a-pure-transition-function.md)

> The renderer is untrusted: main checks every `timerCommand` payload with a type guard from `src/shared/timer.ts`, and a malformed command is ignored like an inapplicable one
>
> — `sad.md §8, Authentication / authorization row, verbatim` · full text: [sad.md](../sad.md)

> Durations are fixed at 25/5/15 with a long break after 4 completed focus sessions, via `DEFAULT_TIMER_CONFIG`. The rules already take the config as input, so roadmap step 7 only adds the setting and its persistence.
>
> — `sad.md §11, accepted debt, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) ·
[public-api.md](../contracts/public-api.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. The in-memory `TimerState` this task defines (never persisted; exact TS shape is the implementer's):

| Field | Meaning |
|---|---|
| `phase` | `focus \| shortBreak \| longBreak` |
| `status` | `ready \| running \| paused` |
| `completedInCycle` | `0..4` |
| `cycleDate` | `YYYY-MM-DD` local date the cycle began |
| `durationMs` | full length of the current phase |
| `endsAt` | epoch ms, running phase only |
| `remainingMs` | paused phase only |
| `sleptAt` | epoch ms, set on sleep input |
| `notice` | phase-ended message, nullable |
| `revision` | incremented on every state change |

— `data-model.md §ER diagram, TIMER_STATE_IN_MEMORY, abridged` · full text: [data-model.md](../data-model.md)

## API contract

Shared types, declared in `src/shared/timer.ts` exactly as named here (doc comments dropped):

```ts
export type PhaseKind = 'focus' | 'shortBreak' | 'longBreak'
export type PhaseStatus = 'ready' | 'running' | 'paused'
export interface Controls { start: boolean; pause: boolean; reset: boolean; skip: boolean; restartCycle: boolean }
export interface Notice { kind: 'phaseEnded' | 'endedWhileAsleep'; endedPhase: PhaseKind; counted: boolean }
export interface RestartLoss { completedInCycle: number; phaseInProgress: PhaseKind | null }
export interface TimerSnapshot {
  revision: number; phase: PhaseKind; status: PhaseStatus; durationMs: number; remainingMs: number
  endsAt: number | null; completedInCycle: number; focusNumber: number | null
  focusSessionsPerCycle: number; notice: Notice | null; controls: Controls
}
export type TimerCommand =
  | { type: 'start' | 'pause' | 'reset' | 'skip'; revision: number }
  | { type: 'restartCycle'; revision: number; confirmed: boolean }
export type CommandOutcome =
  | { kind: 'applied'; snapshot: TimerSnapshot }
  | { kind: 'ignored'; reason: IgnoredReason; snapshot: TimerSnapshot }
  | { kind: 'needsConfirmation'; loss: RestartLoss; snapshot: TimerSnapshot }
export type IgnoredReason = 'staleRevision' | 'notAllowed' | 'malformed'
export function isTimerCommand(value: unknown): value is TimerCommand
```

Invariants: `endsAt !== null` exactly when `status === 'running'` · `remainingMs` in `0..durationMs` · `focusNumber === completedInCycle + 1` when `phase === 'focus'`, else `null` · `controls` equals the AC-02b row for `(phase, status)`. Ready → `remainingMs = durationMs`; paused → the frozen value; running → informational, the window computes `clamp(endsAt − Date.now(), 0, durationMs)`.

— `contracts/public-api.md §1 Shared types + invariants, abridged` · full text: [public-api.md](../contracts/public-api.md)

## Acceptance criteria

### AC-01 — happy

> **Given** the User has a ready focus session and the cycle is at 0 of 4
> **When** the User starts it
> **Then** the focus session runs, counting down from 25:00, and the screen shows that it is a focus session and that it is focus session 1 of 4 in the cycle — on a focus session (ready, running or paused) the screen always shows «focus session N of 4» with N = the completed focus sessions in the cycle + 1, and on a break «N of 4 completed», so after a skipped or reset focus session 3 (2 completed) the next one is again focus session 3 of 4
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-02b — domain invariant

> **Given** a current phase in any state
> **When** the User looks at the timer screen
> **Then** exactly these controls are offered, and any other command is ignored (Start also resumes a paused phase):
>
> | Current phase | Start / Resume | Pause | Reset | Skip | Restart cycle |
> |---|---|---|---|---|---|
> | ready focus session | ✓ | – | – | – | ✓ |
> | ready short or long break | ✓ | – | – | ✓ | ✓ |
> | running (any phase) | – | ✓ | ✓ | ✓ | ✓ |
> | paused (any phase) | ✓ (Resume) | – | ✓ | ✓ | ✓ |
>
> Skipping a ready break makes the next focus session the ready phase (a skipped long break sends the cycle back to 0, AC-09); a ready focus session cannot be skipped, so a break is reached only from a focus session that ended or was skipped after it was started
>
> — `spec.md §5, AC-02b, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Declare the shared types above plus `TimerConfig` (`focusMs`, `shortBreakMs`, `longBreakMs`, `focusSessionsPerCycle`) and `DEFAULT_TIMER_CONFIG` = 25:00 / 5:00 / 15:00 / 4 — `src/shared/timer.ts`
- [ ] Declare `TimerState` per the data delta and `createInitialState(localDate, config)` → ready focus session, cycle 0, `revision` 0, no notice — `src/shared/timer.ts`
- [ ] `allowedControls(phase, status): Controls` encoding the AC-02b table — `src/shared/timer.ts`
- [ ] `restartLoss(state): RestartLoss` — `phaseInProgress` = the phase when running or paused, else `null` — `src/shared/timer.ts`
- [ ] `toSnapshot(state, now, config): TimerSnapshot` — `remainingMs` clamped to `0..durationMs`, `focusNumber` per AC-01, `controls` from `allowedControls` — `src/shared/timer.ts`
- [ ] `isTimerCommand(value: unknown)` — rejects unknown `type`, non-integer/negative `revision`, `restartCycle` without boolean `confirmed` — `src/shared/timer.ts`
- [ ] Unit tests for every helper, including all 12 AC-02b cells — `src/shared/timer.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Ready focus session, 2 completed | `focusNumber` 3, `controls.skip` false |
| Ready long break, 4 completed | `focusNumber` null, `completedInCycle` 4, `skip` true |
| Running phase, `now` after `endsAt` | `remainingMs` 0, never negative |
| Running phase, `now` before `endsAt − durationMs` (clock moved back) | `remainingMs` = `durationMs`, never more |
| `{ type: 'restartCycle', revision: 3 }` (no `confirmed`), `{ type: 'set' }`, `null`, `'start'` | `isTimerCommand` → false |
| Restart loss on a ready phase with 0 completed | `{ completedInCycle: 0, phaseInProgress: null }` (empty) |

## Definition of Done

- [ ] `src/shared/timer.test.ts` passes: the AC-02b table cell by cell, `focusNumber` per AC-01, `remainingMs` clamps, `isTimerCommand` accepts the 5 commands and rejects malformed payloads
- [ ] `src/shared/timer.ts` imports nothing from Electron, DOM, React or `node:` and never reads a clock (ESLint clean)
- [ ] every Hard Rule inlined above still holds
- [ ] `npm run lint` + `npm run typecheck` clean
