---
id: T6
title: "Add the main-process clock adapter: now, localDate and nextLocalMidnight"
layer: "infra"
deps: []
blocks: ["T10", "T11"]
acs: ["AC-15"]
files_hint: ["src/main/clock.ts", "src/main/clock.test.ts"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "todo"
step: ""
---

<!-- To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous,
or contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T6 — Add the main-process clock adapter: now, localDate and nextLocalMidnight

## Place in the sequence

- **Blocked by:** — · **Blocks:** T10 — timer service, T11 — IPC contract · **Wave:** 1 (parallel with T1, T8, T17).
- **Lane:** own lane.

## Why (user story)

> **As a** User
> **I want** a new day — from the Mac's local midnight — to start a fresh cycle, clearing any phase left ready or paused from the day before
> **So that** yesterday's sessions don't trigger a long break first thing
>
> — `spec.md §4, US-10, verbatim` · full text: [spec.md](../spec.md)

This task gives main its only source of wall-clock time and the local date.

## Inlined context

> `clock.ts` ✚ now(), localDate(), nextLocalMidnight(): the only Date access in main
>
> — `sad.md §5, internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> `src/shared` never reads a clock. Main's `clock.ts` supplies `now` (wall-clock epoch ms) and `localDate` (`YYYY-MM-DD` in the Mac's time zone) to every transition.
>
> — `sad.md §8, Time row, abridged` · full text: [sad.md](../sad.md)

> **Risk:** V8 may keep a cached time zone after the change. The new-day rule would then fire at the old midnight [...]. Re-read the zone in `clock.ts` if it is stale
>
> — `sad.md §11, risk 3, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read [sad.md](../sad.md) §8/§11. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-15 — cross-context

> **Then** [...] a cycle belongs to the Mac's local date it began on [...]; the app checks for a new day at the Mac's local midnight, when the Mac wakes, at launch and when the Mac's time zone or clock changes
>
> — `spec.md §5, AC-15, abridged` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `now(): number` (epoch ms), `localDate(at?): string` (`YYYY-MM-DD`, local zone), `nextLocalMidnight(at?): number` (epoch ms of the next local 00:00) — `src/main/clock.ts`
- [ ] Export a `Clock` interface so the service can take a fake — `src/main/clock.ts`
- [ ] Tests with fixed instants under `TZ=Europe/Kyiv` and `TZ=America/New_York`, including a DST change day — `src/main/clock.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| 23:59:59.999 local | `localDate` is today; `nextLocalMidnight` is 1 ms later |
| DST spring-forward day | `nextLocalMidnight` is the real next 00:00 (23 h day), not `+24h` |
| Time zone changed while running | the next call reflects the new zone (no module-level cached offset) |

## Definition of Done

- [ ] `src/main/clock.test.ts` passes in the node project, including the DST case
- [ ] no other main file calls `Date.now()` or `new Date()` for timer logic (grep in review)
- [ ] `npm run lint` + `npm run typecheck` clean
