---
id: T4
title: "Implement the sleep, wake, new-day and clock-change transitions"
layer: "domain"
deps: ["T3"]
blocks: ["T5", "T10"]
acs: ["AC-14", "AC-15"]
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

# T4 — Implement the sleep, wake, new-day and clock-change transitions

## Place in the sequence

- **Blocked by:** T3 — phase-end transitions · **Blocks:** T5 — property test, T10 — timer service · **Wave:** 4 (completes `transition()`).
- **Lane:** shares `src/shared/timer.ts` + `timer.test.ts` with T1, T2, T3 — serialized chain.

## Why (user story)

> **As a** User
> **I want** the timer to keep real time while the Mac sleeps, without counting a focus session that ended while it slept
> **So that** the time is right when I come back and the cycle stays honest
>
> — `spec.md §4, US-09, verbatim` · full text: [spec.md](../spec.md)

> **As a** User
> **I want** a new day — from the Mac's local midnight — to start a fresh cycle, clearing any phase left ready or paused from the day before
> **So that** yesterday's sessions don't trigger a long break first thing
>
> — `spec.md §4, US-10, verbatim` · full text: [spec.md](../spec.md)

This task makes the rules honest across sleep, midnight and clock changes.

## Inlined context

> `powerMonitor` suspend and resume become `sleep(at)` and `wake` inputs. The rules decide counted / uncounted / still running from `sleptAt` [...]. In the same way, the macOS clock-change and time-zone-change notifications become a `clockChanged` input. It runs the new-day rule and re-arms the deadline, so the screen shows a fresh cycle before the User can act (AC-15).
>
> — `sad.md §4, strategic choice 4, abridged` · full text: [sad.md](../sad.md)

> **Chosen:** option 1. Only the real suspend moment can separate "ended before sleep (counts)" from "ended during sleep (doesn't count)".
>
> — `adr/0005-feed-sleep-and-wake-into-the-rules-from-powermonitor.md §Decision outcome, abridged` · full text: [ADR-0005](../adr/0005-feed-sleep-and-wake-into-the-rules-from-powermonitor.md)

> **Chosen:** option 1, the spec's default. [...] it counts sleep without a second time source, and it keeps `transition` to a single `now` input. Default: remaining time follows the wall clock, but a phase never gains time beyond its full length and a backward jump never resurrects an ended phase.
>
> — `adr/0002-trust-the-wall-clock-with-clamps.md §Decision outcome` + `spec.md §8 Q1 default, abridged` · full text: [ADR-0002](../adr/0002-trust-the-wall-clock-with-clamps.md)

> suspend → same running state with sleptAt recorded. Power Nap wakes are ignored while sleptAt is set. resume → wake: endsAt no later than sleptAt → counted, break ready, notify; endsAt passed while asleep → not counted, short break ready, ended-while-asleep notice and notify; endsAt still ahead → still running, no effects. The new-day rule runs after the sleep result in the same transition. At most one notification for the wake.
>
> — `sad.md §6, Flow 2, abridged` · full text: [sad.md](../sad.md)

> The same new-day check runs inside every transition. Ready or paused on a later date → fresh cycle, focus session 1 of 4 ready at 25:00, cycle 0, a paused phase ends uncounted. A phase running across midnight is left alone; when it ends it counts (if focus), then a fresh cycle starts at once, no long break even after 4 of 4; notification «focus session complete, focus session 1 of 4 ready»; a break running across midnight ends into the same fresh cycle. A ready phase is replaced by a new day, never started by it.
>
> — `sad.md §6, Flow 9, abridged` · full text: [sad.md](../sad.md)

> **Accepted debt:** A manual forward clock jump past `endsAt` completes a running focus session and counts it.
>
> — `sad.md §11, accepted debt, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full
([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. Uses the in-memory `TimerState` fields `sleptAt` (epoch ms, set on sleep input) and `cycleDate` (`YYYY-MM-DD` local date the cycle began).

— `data-model.md §ER diagram, TIMER_STATE_IN_MEMORY, abridged` · full text: [data-model.md](../data-model.md)

## API contract

Internal — no API surface. Sets `Notice.kind = 'endedWhileAsleep'` (with `counted: false`) when a phase end passed during system sleep.

## Acceptance criteria

### AC-14 — cross-context

> **Given** a focus session is running with 15:00 left and 1 completed in the cycle
> **When** the Mac sleeps for 2 hours and wakes
> **Then** the window tells the User the focus session ended while the Mac was asleep and was not counted, the cycle still shows 1 completed, a short break is the ready phase, and a notification says the focus session ended while the Mac was asleep; if the Mac sleeps for only 5 minutes, the focus session simply continues with 10:00 left; if instead a short break's end passed while the Mac slept, on wake the next focus session is the ready phase at 25:00, the cycle is unchanged, and a notification says the break ended while the Mac was asleep; if a long break's end passed while the Mac slept, it ended as usual — the cycle goes back to 0 and focus session 1 of 4 is the ready phase at 25:00 (AC-09), with the same «ended while the Mac was asleep» notification; a paused phase is untouched by sleep; when the Mac sleeps past midnight, the sleep result applies first and the new-day rule (AC-15) second — a focus session running at 23:50 with the Mac asleep until 08:00 wakes to focus session 1 of 4 ready at 25:00 with the cycle at 0, the window says the focus session ended while the Mac was asleep and was not counted, and exactly one notification says so; «asleep» means system sleep only (lid closed, Sleep from the menu, automatic sleep, including Power Nap's brief background wakes) — a locked screen, a sleeping display or a screen saver is not sleep, and a phase ends as usual during them; a focus session counts as completed when its scheduled end came no later than the moment the Mac went to sleep, even if the app noticed the end late
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

### AC-15 — cross-context

> **Given** yesterday the User left focus session 4 of 4 paused with 14:07 left, with 3 completed in a cycle that began yesterday
> **When** the User comes back to the app the next day
> **Then** the app shows focus session 1 of 4 as the ready phase at 25:00 with the cycle at 0, and yesterday's paused session is not counted — a cycle belongs to the Mac's local date it began on, and whenever the current phase is not running on a later date the app starts a fresh cycle; the app checks for a new day at the Mac's local midnight, when the Mac wakes, at launch and when the Mac's time zone or clock changes, so the screen already shows the fresh cycle before the User can act on it (a Start pressed at 00:02 starts focus session 1 of 4, never yesterday's ready break), and a phase paused across midnight is cleared at midnight; a phase running across midnight is left alone until it ends: a focus session that runs out at 00:10 counts as a completed focus session, but the fresh cycle starts straight after it — even when it was focus session 4 of 4, no long break is offered — so the notification says the focus session is complete and focus session 1 of 4 is ready, and the screen shows focus session 1 of 4 as the ready phase at 25:00 with the cycle at 0
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add inputs `sleep` (records `sleptAt = now` on a running phase; no revision bump needed if nothing visible changes), `wake`, `clockChanged` — `src/shared/timer.ts`
- [ ] `wake`: settle per Flow 2 using `sleptAt` (`endsAt ≤ sleptAt` → counted `phaseEnded`; `sleptAt < endsAt ≤ now` → uncounted `endedWhileAsleep`; else keep running), then clear `sleptAt` — `src/shared/timer.ts`
- [ ] `deadline` while `sleptAt` is set → ignored (Power Nap) — `src/shared/timer.ts`
- [ ] New-day rule at the end of **every** transition (commands included, before the command is judged): `localDate > cycleDate` and status not running → fresh cycle at `localDate`; a running phase that ends on a later date ends into a fresh cycle — `src/shared/timer.ts`
- [ ] At most one `notify` + one `bounceDock` per transition, even when a sleep result and the new-day rule both apply — `src/shared/timer.ts`
- [ ] Tests per AC-14 branch and AC-15 branch — `src/shared/timer.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Sleep 5 min with 15:00 left | still running, 10:00 left, no effects |
| Paused phase across sleep | unchanged |
| Focus running 23:50, asleep until 08:00 | uncounted `endedWhileAsleep` notice, then fresh cycle: focus 1 of 4 ready, cycle 0, exactly one `notify` |
| Start at 00:02 carrying yesterday's revision (ready break) | the new-day rule runs first and bumps the revision → the Start is ignored/`staleRevision`; yesterday's break is never started |
| Focus 4 of 4 runs out at 00:10 | counted, then fresh cycle, no long break; notify «focus session complete, focus session 1 of 4 ready» |
| Clock moved back one hour on a running phase | remaining clamped to `durationMs`, never more |
| Clock moved back to yesterday after a fresh cycle | no new-day reset (date is not later) |
| `wake` without a prior `sleep` | behaves as a `deadline` + new-day check; no uncounted branch |

## Definition of Done

- [ ] `src/shared/timer.test.ts` has a passing test for every AC-14 and AC-15 branch and every edge case above
- [ ] the sleep result always applies before the new-day rule (asserted by the 23:50 → 08:00 case)
- [ ] every Hard Rule inlined above still holds; `src/shared` stays pure
- [ ] `npm run lint` + `npm run typecheck` clean
