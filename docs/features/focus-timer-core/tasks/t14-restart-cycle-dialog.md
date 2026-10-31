---
id: T14
title: "Add the in-app Restart-cycle confirmation dialog naming what will be lost"
layer: "ui"
deps: ["T13"]
blocks: ["T16"]
acs: ["AC-12"]
files_hint: ["src/renderer/src/screens/TimerScreen.tsx", "src/renderer/src/screens/TimerScreen.test.tsx", "src/renderer/src/components/ui/Dialog.tsx", "src/renderer/src/components/ui/Dialog.module.css", "src/renderer/src/components/ui/Dialog.test.tsx"]
owner: "Vasiliy"
estimate: "S"
context_budget: "S"
status: "todo"
step: ""
---

<!-- To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous,
or contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T14 — Add the in-app Restart-cycle confirmation dialog naming what will be lost

## Place in the sequence

- **Blocked by:** T13 — timer screen · **Blocks:** T16 — end-to-end tests · **Wave:** 9.
- **Lane:** shares `TimerScreen.tsx` with T13 — serialized.

## Why (user story)

> **As a** User
> **I want** to put the cycle back to zero, after confirming when progress would be lost
> **So that** I can start over when the count no longer fits my day
>
> — `spec.md §4, US-07, verbatim` · full text: [spec.md](../spec.md)

This task lets the User confirm or cancel a Restart cycle without leaving the calm in-window design.

## Inlined context

> Restart cycle: an in-app dialog in the renderer, showing the loss summary returned with `needsConfirmation`.
>
> — `sad.md §8, Confirmation dialogs row, abridged` · full text: [sad.md](../sad.md)

> Sends restartCycle at revision r, not confirmed → needs confirmation + loss → dialog. Confirm → restartCycle at revision r, confirmed → snapshot, ready focus session 1 of 4. Cancel → closes the dialog, nothing is sent. State changed while the dialog was open → confirmed at r is stale → ignored → shows the current snapshot, the User can choose Restart cycle again. Nothing would be lost → applied at once, no dialog.
>
> — `sad.md §6, Flow 7, abridged` · full text: [sad.md](../sad.md)

**Reuse:** `Button` (T13), `tokens.css`, Motion with `useReducedMotion()`. **New:** a `Dialog` primitive in `components/ui/` (native `<dialog>`, focus-trapped, Esc = Cancel) — none exists.

**Fallback:** insufficient or contradicted by the code → read [sad.md](../sad.md) §6 Flow 7. Do not guess.

## Data delta

No DB changes.

## API contract

`send('restartCycle', { confirmed })` → `CommandOutcome`; `needsConfirmation` carries `loss: RestartLoss { completedInCycle, phaseInProgress }`.

— `contracts/public-api.md §1, abridged` · full text: [public-api.md](../contracts/public-api.md)

## Acceptance criteria

### AC-12 — happy

> **Given** 3 completed focus sessions in the cycle
> **When** the User chooses Restart cycle
> **Then** the app asks for confirmation whenever something would be lost — completed focus sessions in the cycle or a running or paused phase — and names what will be lost (here, 3 completed focus sessions that will no longer count toward the long break, plus the phase in progress if there is one); on confirm any running or paused phase ends uncounted, the cycle is 0 and focus session 1 of 4 is the ready phase at 25:00; on cancel nothing changes; only when the cycle is at 0 and the current phase is ready does Restart cycle act immediately without asking; a Restart cycle that would lose something never takes effect without the User's confirmation, whichever window sends it
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `Dialog` primitive (title, body, confirm/cancel, reduced-motion aware) — `src/renderer/src/components/ui/Dialog.tsx` + `.module.css` + `.test.tsx`
- [ ] Restart cycle click → `send('restartCycle', { confirmed: false })`; `needsConfirmation` → open the dialog with the loss text; confirm → `send(..., { confirmed: true })` at the same revision; cancel → close, send nothing — `src/renderer/src/screens/TimerScreen.tsx`
- [ ] Ignored confirm (stale) → close the dialog, the screen shows the current snapshot — same file
- [ ] Tests for confirm, cancel, stale, nothing-to-lose — `src/renderer/src/screens/TimerScreen.test.tsx`

## Edge cases

| Case | Behaviour |
|---|---|
| Loss `{3, 'focus'}` | «3 completed focus sessions will no longer count toward the long break, and the focus session in progress will end uncounted» |
| Loss `{0, 'shortBreak'}` | names only the break in progress |
| A phase ends while the dialog is open | confirm comes back `ignored/staleRevision`; dialog closes, fresh state shown |

## Definition of Done

- [ ] `TimerScreen.test.tsx` + `Dialog.test.tsx` pass: confirm, cancel (no second command sent), stale, nothing-to-lose (no dialog)
- [ ] dialog is keyboard-operable and honours `prefers-reduced-motion`
- [ ] `npm run lint` + `npm run typecheck` clean
