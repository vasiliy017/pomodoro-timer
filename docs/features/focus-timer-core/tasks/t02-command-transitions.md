---
id: T2
title: "Implement transition() for the five commands with revision targeting and the control table"
layer: "domain"
deps: ["T1"]
blocks: ["T3"]
acs: ["AC-02", "AC-02b", "AC-04", "AC-10", "AC-11", "AC-12"]
files_hint: ["src/shared/timer.ts", "src/shared/timer.test.ts"]
owner: "Vasiliy"
estimate: "M"
context_budget: "M"
status: "done"
step: "COMMIT"
---

<!-- To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous,
or contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T2 — Implement transition() for the five commands with revision targeting and the control table

## Place in the sequence

- **Blocked by:** T1 — timer types and helpers · **Blocks:** T3 — phase-end transitions · **Wave:** 2.
- **Lane:** shares `src/shared/timer.ts` + `timer.test.ts` with T1, T3, T4 — serialized chain.

## Why (user story)

> **As a** User
> **I want** to restart the current phase or move past it
> **So that** interruptions are handled without faking progress
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

This task makes the five commands (Start/Resume, Pause, Reset, Skip, Restart cycle) change the state exactly as the spec says, and ignore everything else.

## Inlined context

> `transition(state, input, now, localDate, config) → { state, effects }` lives in `src/shared/timer.ts`. Main is a thin imperative shell that supplies time and carries out the effects.
>
> — `sad.md §4, strategic choice 1, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** Rules return outcomes as values (`applied` / `ignored` / `needsConfirmation`). [...] Phase identity is an in-memory `revision` integer, incremented on every state change and reset on launch.
>
> — `sad.md §8, Error handling + ID strategy rows, abridged` · full text: [sad.md](../sad.md)

> **Chosen:** option 1. Only a revision ties a command to the phase the User actually saw. [...] a time window cannot tell a double-click from a deliberate second click, and it does not catch a late Skip from a reopened window that arrives after the window has passed. That Skip would skip the next break, which AC-02 forbids.
>
> — `adr/0008-target-each-command-at-the-revision-the-user-saw.md §Decision outcome, abridged` · full text: [ADR-0008](../adr/0008-target-each-command-at-the-revision-the-user-saw.md)

> A running phase stores `endsAt`. Remaining time is `clamp(endsAt − now, 0, durationMs)`
>
> — `sad.md §4, strategic choice 2, abridged` · full text: [sad.md](../sad.md)

Runtime branches this task implements:

> Pause: applies pause, 12:34 remaining, revision r+1. Resume = `start` at r+1: endsAt is now plus 12:34, revision r+2. A repeated click or late command with an older revision → nothing changes, outcome ignored. A command the control table does not allow → nothing changes, outcome ignored.
> Reset a running or paused phase → the same phase ready at its full length, cycle unchanged. Skip a running or paused focus session → ends it uncounted, a short break ready at 5:00. Skip a short break (ready, running or paused) → next focus session ready at 25:00, cycle unchanged. Skip a long break (ready, running or paused) → cycle back to 0, focus session 1 of 4 ready. Reset/Skip clear any phase-end notice and give no notification and no Dock bounce.
> Restart cycle unconfirmed with something to lose → needs confirmation, state unchanged. Confirmed at the current revision → any running or paused phase ends uncounted, cycle 0, focus session 1 of 4 ready. Confirmed at a stale revision → ignored. Nothing to lose (cycle 0, phase ready) → applied on the first, unconfirmed command.
>
> — `sad.md §6, Flows 4, 6, 7, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([spec.md](../spec.md) · [sad.md](../sad.md) · [public-api.md](../contracts/public-api.md) ·
[adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. Mutates the in-memory `TimerState` (T1): `status`, `phase`, `endsAt`, `remainingMs`, `completedInCycle`, `notice`, `revision`.

## API contract

Internal — no API surface. The result of a command input must let the service build `CommandOutcome` (`applied` / `ignored` + `staleRevision | notAllowed` / `needsConfirmation` + `RestartLoss`). `needsConfirmation` only for `restartCycle` with `confirmed: false` when the loss is non-empty; its snapshot is unchanged and its revision stays current. `ignored` never changes state.

— `contracts/public-api.md §1 invariants, abridged` · full text: [public-api.md](../contracts/public-api.md)

## Acceptance criteria

### AC-02 — error

> **Given** a focus session is already running
> **When** the User presses Start again (for example a double-click), or tries a control that does not apply to the current state (such as Pause on a ready phase)
> **Then** the running phase carries on unchanged — it is not restarted and nothing is counted twice — and only the controls that apply to the current state are offered (AC-02b); a repeated click on any control — Start, Pause, Reset, Skip or Restart cycle — has the same effect as one click, because each command acts only on the phase the User saw when they clicked (a second Skip that arrives after the first has taken effect does not also skip the break that is now ready)
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-02b — domain invariant

> **Then** exactly these controls are offered, and any other command is ignored (Start also resumes a paused phase): ready focus session → Start, Restart cycle · ready short or long break → Start, Skip, Restart cycle · running (any phase) → Pause, Reset, Skip, Restart cycle · paused (any phase) → Resume, Reset, Skip, Restart cycle. Skipping a ready break makes the next focus session the ready phase (a skipped long break sends the cycle back to 0, AC-09); a ready focus session cannot be skipped
>
> — `spec.md §5, AC-02b, abridged (table flattened; full table in T1)` · full text: [spec.md](../spec.md)

### AC-04 — happy

> **Given** a focus session or a break is running with 12:34 left
> **When** the User pauses it and later resumes it
> **Then** while paused the remaining time stays at 12:34 and the screen shows the phase as paused; on resume it counts down from 12:34; a pause never expires on its own (only a new day clears it, AC-15)
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — happy

> **Given** a focus session (or break) is running or paused with 12:34 left and 1 completed focus session in the cycle
> **When** the User resets it
> **Then** the same phase becomes the ready phase at its full length (25:00 for a focus session), not running, and the cycle still shows 1 completed
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-11 — domain invariant

> **Given** 2 completed focus sessions and focus session 3 of 4 running with 10:00 left
> **When** the User skips it
> **Then** the cycle still shows 2 completed and a short break appears as the ready phase — only a completed focus session advances the cycle, so the skipped one is not counted; skipping a break makes the next focus session the ready phase
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — happy

> **Given** 3 completed focus sessions in the cycle
> **When** the User chooses Restart cycle
> **Then** the app asks for confirmation whenever something would be lost — completed focus sessions in the cycle or a running or paused phase — and names what will be lost (here, 3 completed focus sessions that will no longer count toward the long break, plus the phase in progress if there is one); on confirm any running or paused phase ends uncounted, the cycle is 0 and focus session 1 of 4 is the ready phase at 25:00; on cancel nothing changes; only when the cycle is at 0 and the current phase is ready does Restart cycle act immediately without asking; a Restart cycle that would lose something never takes effect without the User's confirmation, whichever window sends it
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Define the input union (`{ kind: 'command'; command: TimerCommand }` now; T3/T4 add `deadline`, `sleep`, `wake`, `clockChanged`) and the effect union (empty for commands) — `src/shared/timer.ts`
- [ ] `transition(state, input, now, localDate, config)`: stale revision → ignored/`staleRevision`; not in `allowedControls` → ignored/`notAllowed`; both leave state and revision untouched — `src/shared/timer.ts`
- [ ] start (ready → running, `endsAt = now + durationMs`; paused → running, `endsAt = now + remainingMs`), pause (freeze `remainingMs`), reset, skip, restartCycle per the flows above; every applied command increments `revision` and clears `notice` — `src/shared/timer.ts`
- [ ] restartCycle: unconfirmed + non-empty `restartLoss` → needsConfirmation with that loss, state untouched — `src/shared/timer.ts`
- [ ] Tests named after each AC above with a simulated `now` — `src/shared/timer.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Two Skips at revision r on running focus session 3 | first → ready short break at r+1; second → ignored/`staleRevision`; the break is not skipped |
| Pause on a ready phase | ignored/`notAllowed`, revision unchanged |
| Skip on a ready focus session | ignored/`notAllowed` |
| Skip a ready or paused long break with 4 completed | cycle 0, focus session 1 of 4 ready at 25:00 |
| restartCycle confirmed at a stale revision | ignored/`staleRevision`, nothing lost |
| restartCycle unconfirmed, cycle 0, phase ready | applied at once, revision +1 |
| Paused for 3 hours, then Resume | counts down from the frozen value, not less |

## Definition of Done

- [ ] `src/shared/timer.test.ts` has a passing test per AC-02, AC-02b, AC-04, AC-10, AC-11, AC-12, including every edge case above
- [ ] `ignored` results never change state or `revision` (asserted)
- [ ] every Hard Rule inlined above still holds; `src/shared` stays pure
- [ ] `npm run lint` + `npm run typecheck` clean
