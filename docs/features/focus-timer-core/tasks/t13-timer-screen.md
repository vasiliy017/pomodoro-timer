---
id: T13
title: "Build the TimerScreen: phase, N of 4, countdown, notice and the offered controls"
layer: "ui"
deps: ["T12"]
blocks: ["T14"]
acs: ["AC-01", "AC-02b", "AC-06"]
files_hint: ["src/renderer/src/screens/TimerScreen.tsx", "src/renderer/src/screens/TimerScreen.module.css", "src/renderer/src/screens/TimerScreen.test.tsx", "src/renderer/src/components/ui/Button.tsx", "src/renderer/src/components/ui/Button.module.css", "src/renderer/src/App.tsx", "src/renderer/src/App.module.css", "src/renderer/src/styles/tokens.css", "e2e/boot.spec.ts"]
owner: "Vasiliy"
estimate: "M"
context_budget: "M"
status: "todo"
step: ""
---

<!-- To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous,
or contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T13 — Build the TimerScreen: phase, N of 4, countdown, notice and the offered controls

## Place in the sequence

- **Blocked by:** T12 — useTimerState · **Blocks:** T14 — Restart-cycle dialog · **Wave:** 8.
- **Lane:** shares `TimerScreen.tsx` with T14 and `e2e/boot.spec.ts` with T16 — serialized by `deps`.

## Why (user story)

> **As a** User
> **I want** start a focus session and see the time left
> **So that** I work in a timed block
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

This task is the one screen the User sees: it renders a snapshot and sends the offered commands.

## Inlined context

> `screens/TimerScreen.tsx` ✚ (+ .module.css, .test.tsx) phase, N of 4, countdown, notice, controls, Restart-cycle confirmation dialog. `App.tsx` ✎ renders TimerScreen (the ping status goes away)
>
> — `sad.md §5, internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** Raw values live only in `src/renderer/src/styles/tokens.css` [...]. CSS Modules (`*.module.css`) next to each component — no Tailwind, no CSS-in-JS, no third-party component kit. Shared primitives go in `src/renderer/src/components/ui/`; screens in `src/renderer/src/screens/`. Animation uses Motion (`motion/react`). Every animation honors `prefers-reduced-motion`.
>
> — `CLAUDE.md §UI, tokens and styling, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> The `Notice` [...] stays until the next command or the next phase end, and survives closing and reopening the window. The window owns the wording. `kind`: `phaseEnded | endedWhileAsleep`; `counted`: true only for a focus session that counted as completed.
>
> — `contracts/public-api.md §1, Notice, abridged` · full text: [public-api.md](../contracts/public-api.md)

**Reuse:** `Panel` (`components/ui/Panel.tsx`) and the existing `tokens.css` custom properties. **New:** a `Button` primitive in `components/ui/` — no button primitive exists yet. No `screens.md` exists for this feature, so there is no SCR-NN manifest; the states to build are the AC-02b rows.

**Fallback:** insufficient or contradicted by the code → read [spec.md](../spec.md) §5 and [public-api.md](../contracts/public-api.md). Do not guess.

## Data delta

No DB changes.

## API contract

Reads `TimerSnapshot` fields `phase`, `status`, `focusNumber`, `completedInCycle`, `focusSessionsPerCycle`, `notice`, `controls`, plus `remainingMs` from `useTimerState()`; sends `start | pause | reset | skip` through `send()` (T12).

## Acceptance criteria

### AC-01 — happy

> **Given** the User has a ready focus session and the cycle is at 0 of 4
> **When** the User starts it
> **Then** the focus session runs, counting down from 25:00, and the screen shows that it is a focus session and that it is focus session 1 of 4 in the cycle — on a focus session (ready, running or paused) the screen always shows «focus session N of 4» with N = the completed focus sessions in the cycle + 1, and on a break «N of 4 completed», so after a skipped or reset focus session 3 (2 completed) the next one is again focus session 3 of 4
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-02b — domain invariant

> **Then** exactly these controls are offered, and any other command is ignored (Start also resumes a paused phase): ready focus session → Start, Restart cycle · ready short or long break → Start, Skip, Restart cycle · running (any phase) → Pause, Reset, Skip, Restart cycle · paused (any phase) → Resume, Reset, Skip, Restart cycle
>
> — `spec.md §5, AC-02b, abridged (table flattened)` · full text: [spec.md](../spec.md)

### AC-06 — cross-context

> **Then** the timer window still tells the User the phase has ended and shows the next phase ready — that message stays on the timer screen beside the ready phase until the User's next command or the next phase end, and is still there when the window is closed and reopened (the same holds for the «ended while the Mac was asleep» message, AC-14) [...]
>
> — `spec.md §5, AC-06, abridged` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `Button` primitive (variant primary/secondary, tokens only) — `src/renderer/src/components/ui/Button.tsx` + `.module.css`
- [ ] `TimerScreen`: phase label (Focus session / Short break / Long break), «focus session N of 4» or «N of 4 completed», `mm:ss` countdown, «Paused» state, notice line worded from `Notice`, one button per `controls` flag that is true («Resume» when paused); Restart cycle button present but its dialog is T14 — `src/renderer/src/screens/TimerScreen.tsx` + `.module.css`
- [ ] Any new raw value (e.g. countdown font size) added as a token — `src/renderer/src/styles/tokens.css`
- [ ] `App.tsx` renders `<TimerScreen />` inside `Panel`; remove the ping status and its CSS — `src/renderer/src/App.tsx`, `App.module.css`
- [ ] Update the boot test: assert «Focus session 1 of 4» and `25:00` instead of `bridge-status` (keep the no-Node-globals check) — `e2e/boot.spec.ts`
- [ ] Testing Library tests: one per AC-02b row, AC-01 labels, notice text for each `Notice` kind — `src/renderer/src/screens/TimerScreen.test.tsx`

## Edge cases

| Case | Behaviour |
|---|---|
| `snapshot` null (still loading) | a quiet placeholder, no controls |
| Ready long break, 4 completed | «Long break», «4 of 4 completed», Start + Skip + Restart cycle |
| Notice `endedWhileAsleep`, focus, not counted | «Focus session ended while the Mac was asleep — not counted» beside the ready break |
| Remaining 0 ms before the next snapshot arrives | shows `00:00`, never negative |
| Reduced motion | any transition is instant |

## Definition of Done

- [ ] `src/renderer/src/screens/TimerScreen.test.tsx` passes: AC-01 labels, every AC-02b row's buttons (no others rendered), AC-06 notice text
- [ ] no raw colour/spacing/font values outside `tokens.css` (review)
- [ ] `npm run test:e2e` boot test passes with the new assertions
- [ ] `npm run lint` + `npm run typecheck` clean
