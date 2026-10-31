---
id: T9
title: "Add the quit guard: native confirmation when progress would be lost, never on OS quit"
layer: "app"
deps: ["T1"]
blocks: ["T15"]
acs: ["AC-13"]
files_hint: ["src/main/quit-guard.ts", "src/main/quit-guard.test.ts"]
owner: "Vasiliy"
estimate: "S"
context_budget: "M"
status: "done"
step: "COMMIT"
---

<!-- To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous,
or contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T9 — Add the quit guard: native confirmation when progress would be lost, never on OS quit

## Place in the sequence

- **Blocked by:** T1 — timer types (`RestartLoss`) · **Blocks:** T15 — main wiring · **Wave:** 2 (parallel with T2, T7).
- **Lane:** own lane. Takes `getLoss()` and a dialog function, so it needs no service.

## Why (user story)

> **As a** User
> **I want** closing the window to keep the timer running, and to reopen the window from the Dock
> **So that** the window is out of my way without stopping my session
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

This task protects a cycle in progress from an accidental ⌘Q without ever blocking a logout or shutdown.

## Inlined context

> Quit (⌘Q, Dock, app menu): a native `dialog.showMessageBox` from main, because the window may be closed. It is never shown when quitting for logout, restart or shutdown (`powerMonitor` `shutdown` sets the flag)
>
> — `sad.md §8, Confirmation dialogs row, abridged` · full text: [sad.md](../sad.md)

> No OS-initiated quit was signalled, works out what would be lost → shows the native confirmation naming what will be lost. Confirm → lets the quit proceed, the running phase ends uncounted. Cancel → prevents the quit, the phase keeps running and nothing changes. Nothing would be lost (cycle 0, phase ready) → quits at once without asking. macOS quits for logout, restart or shutdown → OS-quit flag set → quits at once, never asks and never blocks.
>
> — `sad.md §6, Flow 8, abridged` · full text: [sad.md](../sad.md)

> **Risk:** The quit guard could block a logout or restart if `powerMonitor` `shutdown` does not fire first [...]. The quit guard prompts only from `before-quit` when no OS-initiated quit signal has been seen.
>
> — `sad.md §11, risk 4, abridged` · full text: [sad.md](../sad.md)

> `RestartLoss { completedInCycle: number; phaseInProgress: PhaseKind | null }` — Main's quit guard uses the same summary (AC-13).
>
> — `contracts/public-api.md §1, RestartLoss, abridged` · full text: [public-api.md](../contracts/public-api.md)

**Fallback:** insufficient or contradicted by the code → read [sad.md](../sad.md) §6 Flow 8 / §11 and [spec.md](../spec.md) AC-13. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-13 — happy

> **Given** a focus session is running with 18:00 left
> **When** the User closes the timer window
> **Then** the focus session keeps running and its phase-end notification still arrives; clicking the Dock icon (or the notification) reopens the window, which shows the current remaining time immediately, not an older value counting down; there is only ever one timer window — reopening shows that same window, never a second one; if instead the User quits the app (⌘Q, Quit from the Dock or the app menu) while something would be lost — completed focus sessions in the cycle or a running or paused phase — the app first asks for confirmation and names what will be lost, as Restart cycle does (AC-12), and on cancel nothing changes; on confirm, or when macOS quits the app for logout, shutdown or restart (never asked, never blocked), the running phase ends uncounted and the next launch shows focus session 1 of 4 as the ready phase with the cycle at 0
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `installQuitGuard({ app, getLoss, showConfirm, onQuitAllowed })` → `{ markOsInitiatedQuit() }`; `showConfirm(loss) → Promise<boolean>` wraps `dialog.showMessageBox` — `src/main/quit-guard.ts`
- [ ] `before-quit`: OS-quit flag set, already confirmed, or empty loss → call `onQuitAllowed()` and let it proceed; else `preventDefault()`, ask, on confirm set confirmed + `app.quit()`, on cancel do nothing — `src/main/quit-guard.ts`
- [ ] `lossMessage(loss)` naming the completed focus sessions that will no longer count and the phase in progress, e.g. «3 completed focus sessions will no longer count toward the long break, and the focus session in progress will end uncounted» — `src/main/quit-guard.ts`
- [ ] Tests with a fake `app` emitter and fake `showConfirm` — `src/main/quit-guard.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| ⌘Q twice while the dialog is open | one dialog only; the second `before-quit` is prevented without a second dialog |
| Shutdown flag set, progress at stake | no dialog, quit proceeds |
| Loss `{0, null}` | no dialog, quit proceeds |
| Loss `{0, 'shortBreak'}` (break running) | dialog names the break in progress |

## Definition of Done

- [ ] `src/main/quit-guard.test.ts` passes: confirm → quit, cancel → prevented, empty loss → no dialog, OS-quit → no dialog, no double dialog
- [ ] the dialog text names exactly what `RestartLoss` reports
- [ ] `npm run lint` + `npm run typecheck` clean
