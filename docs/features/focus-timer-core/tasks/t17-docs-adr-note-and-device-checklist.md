---
id: T17
title: "Mark repo ADR-0002 partially superseded and write the packaged-app verification checklist"
layer: "docs"
deps: []
blocks: []
acs: []
files_hint: ["docs/adr/0002-run-the-timer-engine-in-the-main-process.md", "docs/features/focus-timer-core/verification.md"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "done"
step: "COMMIT"
---

<!-- To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous,
or contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T17 — Mark repo ADR-0002 partially superseded and write the packaged-app verification checklist

## Place in the sequence

- **Blocked by:** — · **Blocks:** — · **Wave:** 1 (independent; the checklist is filled in by the owner before shipping).
- **Lane:** own lane.

## Why (user story)

> **As a** User
> **I want** the timer to keep real time while the Mac sleeps, without counting a focus session that ended while it slept
> **So that** the time is right when I come back and the cycle stays honest
>
> — `spec.md §4, US-09, verbatim` · full text: [spec.md](../spec.md)

This task records the checks only a real, packaged app on the owner's Mac can answer, and fixes the stale ADR context.

## Inlined context

> Stale architecture docs: [...] Repo ADR-0002's context assumes a tray and drift-free clock jumps. ADR-0002 and ADR-0009 supersede those points, and repo ADR-0002 gets a «partially superseded» note in this step.
>
> — `sad.md §11, risk 6, abridged` · full text: [sad.md](../sad.md)

> Manual checks before shipping on the owner's Mac (Activity Monitor CPU and Energy Impact, a 30-minute background run, a real 25-minute run against the system clock, a lid-close sleep). NFR checks that depend on background behaviour must run on the packaged app, not on `npm run dev`.
>
> — `sad.md §7, Monitoring + Deployment view, abridged` · full text: [sad.md](../sad.md)

> Open spikes: lid-close sleep past the end and before the end (risk 1); `NSAppSleepDisabled` in the built `Info.plist` and «App Nap: No» (risk 2); change the time zone and the clock with the app running, check `clockChanged` arrives and `localDate()` reflects the new zone (risk 3); manual logout and restart tests with progress in the cycle (risk 4).
>
> — `sad.md §11, risks 1–4 mitigations, abridged` · full text: [sad.md](../sad.md)

**Fallback:** read [sad.md](../sad.md) §7, §10, §11 in full. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

No AC of its own — supports the spec §6 NFRs (Phase-end detection latency, Timing accuracy, Background resource use, Launch time) and the sad §11 risks, whose results gate the release.

## Checklist

- [ ] Add a «Partially superseded by focus-timer-core ADR-0002 (clock) and ADR-0009 (no tray)» note with links under the header — `docs/adr/0002-run-the-timer-engine-in-the-main-process.md`
- [ ] Write the checklist: one row per manual check (QG-1 30-min background, QG-3 real 25-min run, QG-5 Activity Monitor CPU + Energy Impact + App Nap, QG-6 stopwatch launch, risks 1–4 spikes), each with steps, expected result quoted from spec/sad, and empty Result / Date columns for the owner — `docs/features/focus-timer-core/verification.md`

## Edge cases

| Case | Behaviour |
|---|---|
| A check fails on device | the checklist names the fallback from sad §11 to take (e.g. ADR-0005 lateness fallback, revisit ADR-0004) |

## Definition of Done

- [ ] repo ADR-0002 carries the note with working relative links
- [ ] `verification.md` lists every manual check from sad §7/§10/§11 with expected results and signatures
- [ ] markdown renders (no broken links)
