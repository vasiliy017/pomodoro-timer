---
status: Draft
owner: "Vasiliy"
reviewers: []
updated_at: "2026-10-31"
feature_size: "M"
---

# On-device verification — focus-timer-core

> The manual checks that gate the first public release of this step. Automated tests cover the
> rules, the main-process shell and the UI (`npm test`, `npm run test:e2e`). They cannot cover
> background throttling, real sleep, OS quits or a full 25-minute run. Those run here, on the
> owner's Mac, against the **packaged** app ([sad.md](sad.md) §7: "NFR checks that depend on
> background behaviour must run on the packaged app, not on `npm run dev`").

## Before you start

1. `npm run dist:mac`, then open `dist/mac-arm64/Pomodoro Timer.app` (or `dist/mac` on Intel).
   The build is unsigned, so the first launch goes through System Settings → Privacy & Security →
   Open Anyway.
2. Allow notifications for Pomodoro Timer when macOS asks. For check 9, block them afterwards.
3. Keep Activity Monitor open (View → Columns: % CPU, Energy Impact, App Nap).

Fill **Result** with `pass` or `fail` plus what you saw, and **Date** with the run date. A `fail`
row names the fallback to take.

## Checks

| # | Check | Steps | Expected (quoted) | If it fails | Result | Date |
|---|---|---|---|---|---|---|
| 1 | QG-6 Launch time | Quit the app. Start a stopwatch and open the app from Finder. Stop it when «Focus session 1 of 4» and `25:00` appear | "≤ 2 s from a cold launch to the timer screen showing a ready focus session" ([spec.md](spec.md) §6) | Profile the launch. The automated boot test has the same 2 s bound, so compare it with this run | | |
| 2 | Risk 2a — App Nap opt-out in the bundle | `plutil -extract NSAppSleepDisabled raw "dist/mac-arm64/Pomodoro Timer.app/Contents/Info.plist"` | Prints `true` ([ADR-0004](adr/0004-disable-app-nap-in-the-app-bundle.md)) | Check `mac.extendInfo` in `electron-builder.yml` | pass: `true` for arm64 and x64 (checked by `implement`, T15) | 2026-10-31 |
| 3 | Risk 2b + QG-5 — App Nap and background CPU | Start a focus session, close the window, leave the Mac awake for 10 minutes. Read the app's row in Activity Monitor | App Nap column «No». "≤ 1% average CPU over 10 minutes and Energy Impact «Low» while a phase runs with the window hidden or closed" ([spec.md](spec.md) §6) | Revisit [ADR-0004](adr/0004-disable-app-nap-in-the-app-bundle.md). Look for another throttling source ([sad.md](sad.md) §11 risk 2) | | |
| 4 | QG-1 — Phase end after 30 minutes in the background | Start a focus session, close the window, work in other apps for 25 minutes. Note the wall-clock time the session should end | "≤ 1 s from a phase's scheduled end to its notification and on-screen change, window hidden or closed, Mac awake" ([spec.md](spec.md) §6). One notification and one Dock bounce. Reopening from the Dock shows the ready short break with the notice | Revisit [ADR-0004](adr/0004-disable-app-nap-in-the-app-bundle.md) / [ADR-0003](adr/0003-arm-one-deadline-timeout-in-main.md) (risk 2) | | |
| 5 | QG-3 — Timing accuracy over a real 25 minutes | Start a focus session beside the menu-bar clock (seconds on). Close and reopen the window twice and lock the screen once during the run | "remaining time shown never more than 1 s off wall-clock time over a 25-minute focus session, including after reopening the window or waking the Mac" ([spec.md](spec.md) §6). A locked screen is not sleep: the session ends as usual (AC-14) | Check `useTimerState` against `endsAt` ([ADR-0006](adr/0006-push-snapshots-on-change-and-count-down-in-the-window.md)) | | |
| 6 | Risk 1a — Lid-close sleep past the end | Start a focus session with less than 5 minutes left (use Skip/Reset to get there, or wait). Close the lid for 10 minutes, then open it | The window says the focus session ended while the Mac was asleep and was not counted. The cycle is unchanged, a short break is ready, and exactly one notification says so (AC-14) | Add the lateness fallback named in [ADR-0005](adr/0005-feed-sleep-and-wake-into-the-rules-from-powermonitor.md) ([sad.md](sad.md) §11 risk 1) | | |
| 7 | Risk 1b — Lid-close sleep before the end | Start a focus session with 15:00 left. Close the lid for 5 minutes, then open it | "the focus session simply continues with 10:00 left" (AC-14). No notification | As above ([ADR-0005](adr/0005-feed-sleep-and-wake-into-the-rules-from-powermonitor.md)) | | |
| 8 | Risk 3 — Clock and time-zone changes | With a phase paused, set the time zone so the local date moves to tomorrow (System Settings → General → Date & Time). Then switch back and move the clock forward past a running phase's end | After the zone change the screen shows focus session 1 of 4 ready with the cycle at 0, before you touch it (AC-15). After the forward jump the running phase ends and counts (accepted debt, [sad.md](sad.md) §11) | The new-day check still runs on every command, wake, launch and deadline. Re-read the zone in `src/main/clock.ts` if it is stale ([sad.md](sad.md) §11 risk 3) | | |
| 9 | AC-06 — Notifications blocked | Block the app's notifications (System Settings → Notifications) and close the window. Let a short break end | The Dock icon bounces once and does not keep bouncing. Reopening shows «Break over» beside the ready focus session. The app never raises the window by itself (AC-06) | Check `src/main/signals.ts` (`bounce('informational')`) | | |
| 10 | Risk 4a — Logout with progress | Complete one focus session, start the next, then log out (Apple menu → Log Out) | No Pomodoro Timer dialog. The logout is never blocked. The next launch shows focus session 1 of 4 ready with the cycle at 0 (AC-13) | Find another OS-quit signal, or drop the quit prompt and record an override ([sad.md](sad.md) §11 risk 4) | | |
| 11 | Risk 4b — Restart with progress | Same as check 10, using Apple menu → Restart | Same as check 10 | Same as check 10 | | |
| 12 | AC-13 — User quit with progress | Complete one focus session, start the next, press ⌘Q. Cancel, then ⌘Q again and confirm | The dialog names "1 completed focus session will no longer count toward the long break, and the focus session in progress will end uncounted." Cancel changes nothing. Confirm quits | Check `src/main/quit-guard.ts` | | |
| 13 | AC-03 — Second launch | With the app running, open it again from Finder | No second window or process. The existing window comes to the front | Check `requestSingleInstanceLock` in `src/main/index.ts` | | |

## Sign-off

Every row passes, or each failing row has its fallback decided and recorded as an ADR or a spec
change, before roadmap step 4 (Public release).

| Signed by | Date |
|---|---|
| | |
