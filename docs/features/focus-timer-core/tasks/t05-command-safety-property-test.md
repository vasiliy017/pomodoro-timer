---
id: T5
title: "Add the 10,000-sequence command-safety property test over transition()"
layer: "tests"
deps: ["T4"]
blocks: []
acs: ["AC-02", "AC-11"]
files_hint: ["src/shared/timer.property.test.ts"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---

<!-- To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous,
or contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T5 — Add the 10,000-sequence command-safety property test over transition()

## Place in the sequence

- **Blocked by:** T4 — sleep, wake and new-day transitions · **Blocks:** — · **Wave:** 5 (parallel with T10).
- **Lane:** own lane (new file).

## Why (user story)

> **As a** User
> **I want** to restart the current phase or move past it
> **So that** interruptions are handled without faking progress
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

This task proves the cycle count stays honest under any mix of commands and system events.

## Inlined context

> | Command safety | 0 cases of two phases running at once, a focus session counted twice, the cycle advanced by anything but a completed focus session, or the cycle reset to 0 by anything outside the glossary's reset list (long break ended or skipped, Restart cycle, new day, quit), across 10,000 random command sequences (repeats, late commands from a timer window that was closed and reopened, clock changes checked against the current default in §8 Q1) | randomized property test over the timer rules in CI |
>
> — `spec.md §6, Command safety NFR, verbatim` · full text: [spec.md](../spec.md)

> **How verify:** a randomized property test over `transition()` in CI (`src/shared/timer.property.test.ts`, 10,000 generated sequences with a fixed, logged seed), asserting the four invariants after every step. Inputs: random sequences of the five commands, repeats, late commands from a timer window that was closed and reopened, sleep/wake gaps, day changes and clock changes.
>
> — `sad.md §10, QG-2, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read [sad.md](../sad.md) §10 and [spec.md](../spec.md) §6. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-02 — error

> **Then** the running phase carries on unchanged — it is not restarted and nothing is counted twice — [...] a repeated click on any control — Start, Pause, Reset, Skip or Restart cycle — has the same effect as one click, because each command acts only on the phase the User saw when they clicked
>
> — `spec.md §5, AC-02, abridged` · full text: [spec.md](../spec.md)

### AC-11 — domain invariant

> **Then** the cycle still shows 2 completed and a short break appears as the ready phase — only a completed focus session advances the cycle, so the skipped one is not counted; skipping a break makes the next focus session the ready phase
>
> — `spec.md §5, AC-11, abridged` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Seeded PRNG (no new dependency unless the repo already has one), seed logged on failure — `src/shared/timer.property.test.ts`
- [ ] Generator: commands at the current or an older revision (repeats, late), `deadline` at random times, `sleep`/`wake` gaps, forward/backward clock jumps, date changes — `src/shared/timer.property.test.ts`
- [ ] After every step assert the four invariants and the snapshot invariants (T1) — `src/shared/timer.property.test.ts`
- [ ] 10,000 sequences; keep the run under a few seconds in CI — `src/shared/timer.property.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| `completedInCycle` grows | only on a `phaseEnded` notice with `counted: true` for a focus phase |
| `completedInCycle` drops to 0 | only on long break end/skip, Restart cycle, or a new day |
| A failing sequence | the test prints the seed and the minimal step list to reproduce |

## Definition of Done

- [ ] `src/shared/timer.property.test.ts` runs 10,000 sequences in `npm test` and passes with 0 invariant violations
- [ ] a deliberately broken rule (e.g. counting a skipped focus session) makes it fail — checked locally, not committed
- [ ] `npm run lint` + `npm run typecheck` clean
