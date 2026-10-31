---
id: T3
title: "Implement the deadline transition: phase end, cycle progression, notice and signal effects"
layer: "domain"
deps: ["T2"]
blocks: ["T4"]
acs: ["AC-05", "AC-06", "AC-07", "AC-08", "AC-09"]
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

# T3 — Implement the deadline transition: phase end, cycle progression, notice and signal effects

## Place in the sequence

- **Blocked by:** T2 — command transitions · **Blocks:** T4 — sleep, wake and new-day transitions · **Wave:** 3.
- **Lane:** shares `src/shared/timer.ts` + `timer.test.ts` with T1, T2, T4 — serialized chain.

## Why (user story)

> **As a** User
> **I want** the next phase to wait, as a ready phase, until I start it
> **So that** I finish my thought before resting, and rest before focusing
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

This task decides what a phase end does to the cycle, which phase becomes ready, and which signals main must emit.

## Inlined context

> A running phase stores `endsAt`. Remaining time is `clamp(endsAt − now, 0, durationMs)`, and a phase end is a transition, so a backward clock jump never resurrects it.
>
> — `sad.md §4, strategic choice 2, verbatim` · full text: [sad.md](../sad.md)

> On every phase end, in this order: one Notification (kept referenced until closed [...]; a click → `window.show()`), one `app.dock.bounce('informational')`, and a `notice` in the state. The notice stays on screen until the next command or the next phase end. The app never raises the window by itself
>
> — `sad.md §8, Phase-end signalling row, abridged` · full text: [sad.md](../sad.md)

> The armed deadline at endsAt fires → counts the focus session, 4 of 4 completed, long break ready at 15:00, not running → posts the notification, focus session complete, long break ready → bounces the Dock icon once → snapshot with phase-end notice. The ready break stays at its full length for any time until the User starts it. Long break ends → cycle back to 0, focus session 1 of 4 ready, «break over, focus session ready». Short break ends → cycle unchanged, the next focus session ready at 25:00. Postcondition: every phase end gives one notification, one Dock bounce and a notice, and the next phase waits as a ready phase.
>
> — `sad.md §6, Flow 5, abridged` · full text: [sad.md](../sad.md)

> Completed focus session: A focus session whose full length ran out while the Mac was awake, without being reset or skipped. The only thing that counts toward the long break
>
> — `sad.md §12, Glossary, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([spec.md](../spec.md) · [sad.md](../sad.md) · [public-api.md](../contracts/public-api.md) ·
[adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. Mutates the in-memory `TimerState` (T1): `phase`, `status`, `completedInCycle`, `durationMs`, `endsAt`, `notice`, `revision`.

## API contract

Internal — no API surface. The `notice` it sets is the shared `Notice` (`kind: 'phaseEnded'`, `endedPhase`, `counted` — true only for a completed focus session, always false for a break).

— `contracts/public-api.md §1, Notice, abridged` · full text: [public-api.md](../contracts/public-api.md)

## Acceptance criteria

### AC-05 — happy

> **Given** a focus session is running and the timer window is hidden behind other apps or closed
> **When** the focus session's time runs out
> **Then** a system notification appears saying the focus session is complete and that a short break (or long break) is ready, and clicking it brings the timer window to the front; the same applies when a break ends («break over — focus session ready»)
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-06 — cross-context

> **Given** the User has blocked notifications for the app in the Mac's settings, or Focus / Do Not Disturb is on
> **When** a phase ends
> **Then** the timer window still tells the User the phase has ended and shows the next phase ready — that message stays on the timer screen beside the ready phase until the User's next command or the next phase end, and is still there when the window is closed and reopened (the same holds for the «ended while the Mac was asleep» message, AC-14) — and the app's Dock icon bounces once (it does not keep bouncing), so the phase end is never completely silent; because the app cannot tell whether the Mac hid its notification, the Dock icon does this on every phase end; the app never opens or raises the timer window by itself, so with notifications blocked and the window closed, the single Dock bounce and the waiting message are the only signals
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-07 — happy

> **Given** focus session 2 of 4 is running
> **When** its time runs out
> **Then** it counts as a completed focus session, the cycle shows 2 of 4 completed, and a short break appears as the ready phase at 5:00, not running; when a break's time runs out, a focus session appears as the ready phase at 25:00, not running
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-08 — domain invariant

> **Given** a short break is the ready phase after a focus session ended
> **When** nobody touches the app for any length of time (10 minutes or 3 hours)
> **Then** the short break is still ready at its full 5:00 and no time has been counted against it — a phase never starts by itself; it starts only when the User starts it
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-09 — happy

> **Given** 3 completed focus sessions in the cycle and focus session 4 of 4 running
> **When** its time runs out
> **Then** the cycle shows 4 of 4 completed and a long break appears as the ready phase at 15:00; when that long break's time runs out, or it is skipped, the cycle goes back to 0 and focus session 1 of 4 appears as the ready phase
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add a `deadline` input; on a running phase with `now ≥ endsAt` settle the phase end; otherwise it is a no-op (no revision bump) — `src/shared/timer.ts`
- [ ] Focus end → `completedInCycle + 1`; `== focusSessionsPerCycle` → ready long break, else ready short break. Short break end → ready focus, cycle unchanged. Long break end → cycle 0, ready focus 1 — `src/shared/timer.ts`
- [ ] Set `notice = { kind: 'phaseEnded', endedPhase, counted }`, bump `revision`, emit effects `notify` (carrying the `Notice` and the ready phase + its `focusNumber`, so T7 can word it) then `bounceDock` — `src/shared/timer.ts`
- [ ] Tests per AC above; AC-08 asserts a ready phase is unchanged by `deadline` inputs at +10 min and +3 h — `src/shared/timer.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| `deadline` fires early (`now < endsAt`) | no-op, no effects, revision unchanged |
| `deadline` arrives late (Mac awake, `now` = `endsAt` + 3 s) | settles as usual: focus counts, effects emitted once |
| `deadline` on a ready or paused phase | no-op (a ready phase never starts by itself; pause never expires) |
| Two `deadline` inputs for the same end | the second is a no-op — exactly one `notify` + one `bounceDock` |
| A command after a phase end | clears the notice (T2) |
| Second phase end while an old notice shows | the notice is replaced by the new one |

## Definition of Done

- [ ] `src/shared/timer.test.ts` has a passing test per AC-05 (effects), AC-06 (notice + single bounce effect), AC-07, AC-08, AC-09 and every edge case above
- [ ] exactly one `notify` and one `bounceDock` effect per phase end (asserted)
- [ ] every Hard Rule inlined above still holds; `src/shared` stays pure
- [ ] `npm run lint` + `npm run typecheck` clean
