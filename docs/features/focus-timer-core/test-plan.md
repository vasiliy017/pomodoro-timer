---
status: Draft
owner: "Vasiliy"
reviewers: ["Vasiliy (implementing engineer)", "Tech Lead"]
updated_at: "2026-10-31"
feature_size: "M"
---

# Test plan — focus-timer-core

A manually advanced 25/5/15 focus cycle, owned by main: phases wait as ready until the User starts
them, only a completed focus session advances the cycle, every phase end is signalled with the
window hidden or closed, and sleep, a new day and a quit are handled honestly (spec §5 AC-01 to
AC-15).

## Levels

The `desktop-app` surface in sad.md adds the UI tiers. Main owns no datastore in this step, so
"integration" here means the main-process modules wired together for real (rules, timer service,
IPC registrar, window, quit guard, system events) with only the Electron/macOS edge replaced; the
real Electron runtime is exercised at the e2e tiers.

| Level | Scope | Strategy (generic — no tool names) |
|---|---|---|
| Unit | Pure timer rules in `src/shared/timer.ts`: `transition()`, `toSnapshot()`, `allowedControls()`, `restartLoss()`, plus the 10,000-sequence command-safety property test. | In-memory, simulated clock and local date, no I/O. |
| Integration | Main-process shell: timer service, clock, signals, window, quit guard, system events and the IPC registrar, wired to the real rules. | Node project with simulated timers; only the Electron/macOS APIs (notification, Dock, window, power monitor, dialog) are replaced at the adapter edge, because macOS cannot be spun up in a node test. |
| Contract | The renderer ↔ main boundary from `contracts/public-api.md`: `timerCommand`, `timerGetState`, the `timer:state` event. | Exercise the real registered handlers with well-formed and malformed payloads; assert the result shape and that state changes only through the five commands. |
| E2E | A full flow through the built app's main process: phase end with the window closed, close/reopen, single instance, fresh launch, account isolation. | The built app launched with a throwaway user-data directory per test and shortened phases via the unpackaged-only test timer config. |
| Load | <!-- N/A: no throughput or latency-under-load NFR; the numeric NFRs are verified by the scenarios in "NFR validation" at the levels named there. --> | — |
| Component | `TimerScreen`, the Restart-cycle dialog and the `useTimerState` hook. | Rendered in isolation in a simulated DOM with a fake `window.api`; assert output and interactions. |
| Visual-regression | <!-- N/A: desktop-app surface, not web; no baseline images in this step. --> | — |
| E2E-through-UI | The User-story flows driven by clicks in the real timer window: start, double-click, Restart cycle cancel/confirm, control latency. | The built app with a throwaway user-data directory and shortened phases. |

## AC coverage

| AC (spec.md §5) | Test name (intent-based) | Level | Expected outcome |
|---|---|---|---|
| AC-01 start a focus session | starting a ready focus session runs it from 25:00 as focus session 1 of 4 | unit | Running focus session, 25:00 remaining, snapshot reads «focus session 1 of 4» |
| AC-01 | focus number is completed + 1, and a skipped or reset session keeps its number | unit | After 2 completed, skipping or resetting focus session 3 leaves the next one as «focus session 3 of 4»; on a break the snapshot reads «N of 4 completed» |
| AC-01 | timer screen shows the phase kind and «N of 4» for every phase | component | Focus session (ready, running, paused) shows «focus session N of 4»; a break shows «N of 4 completed» |
| AC-01 | User starts focus session 1 of 4 from a fresh launch | e2e-through-UI | After one click on Start the window shows a running focus session 1 of 4 counting down from 25:00 |
| AC-02 repeated or misplaced commands | a repeated Start on a running focus session changes nothing | unit | Same running phase, same end time, nothing counted, state revision unchanged |
| AC-02 | a command not offered in the current state is ignored | unit | Pause on a ready phase (and every other off-table command) leaves the state unchanged |
| AC-02 | a late Skip aimed at an older revision does not skip the break that is now ready | unit | The first Skip moves to the ready break; the second, carrying the old revision, is ignored and the break stays ready |
| AC-02 | every control clicked twice has the effect of one click | unit | For Start, Pause, Reset, Skip and Restart cycle, applying the same command at the same revision twice equals applying it once |
| AC-02 | the window can only send the five commands, each tied to a revision | contract | A command outside the five, or one carrying extra fields such as a time or phase, is refused as a failed result and the timer state is unchanged; a well-formed command returns its outcome (applied or ignored) |
| AC-02 | User double-clicks Start in the real window | e2e-through-UI | One running focus session; the countdown is not restarted and the cycle count is unchanged |
| AC-02b allowed controls | the control table holds for every phase and status | unit | Each of the four rows of the spec table yields exactly its marked controls; every unmarked command is ignored by the rules |
| AC-02b | a ready focus session cannot be skipped; skipping a ready break readies the next focus session | unit | Skip on a ready focus session is ignored; Skip on a ready short break gives a ready focus session; Skip on a ready long break also returns the cycle to 0 |
| AC-02b | timer screen offers exactly the allowed controls | component | For each of the four states only the allowed buttons are rendered, and Start reads «Resume» on a paused phase |
| AC-03 separate macOS accounts | two app instances with separate user-data directories keep independent timers | e2e | Starting a focus session in the first instance leaves the second at a ready focus session 1 of 4 with the cycle at 0; neither shows the other's phase |
| AC-04 pause and resume | a paused phase keeps its remaining time, however long it stays paused | unit | Pausing a focus session or a break at 12:34 and advancing the simulated clock by 3 hours leaves 12:34 remaining and the phase paused |
| AC-04 | resuming counts down from the paused remaining time | unit | Start on the paused phase makes it running and its end falls 12:34 after the resume moment |
| AC-04 | timer screen shows a paused phase as paused and frozen | component | The screen labels the phase paused, shows 12:34, and the window's local countdown does not move while paused |
| AC-05 phase-end notification | a focus session's end asks for a notification naming the ready break | unit | The end of a focus session yields one notify effect saying the focus session is complete and a short (or long) break is ready; a break's end yields «break over — focus session ready» |
| AC-05 | the service fires the phase end on time with the window hidden or closed | integration | One timeout is armed at the phase's end; when it fires, exactly one notification, one Dock bounce and one state broadcast happen |
| AC-05 | clicking the phase-end notification brings the same timer window to the front | integration | The notification click shows the existing timer window; no second window is created |
| AC-05 | a phase ends while the window is closed | e2e | With shortened phases and the window closed, main's state moves to the ready next phase within 1 s of the scheduled end, and reopening the window shows the ready break beside the phase-end message |
| AC-06 notifications blocked or Focus on | the phase-end message waits on the state until the next command or phase end | unit | After a phase end the state carries the message; an ignored command keeps it; the next applied command or the next phase end replaces it; the sleep message behaves the same |
| AC-06 | every phase end bounces the Dock once and never raises the window | unit | Each phase end yields exactly one bounce effect and no effect that shows the window |
| AC-06 | the service bounces the Dock once per phase end and the message survives a window reopen | integration | The bounce is requested once, informational (not continuous), the window is never shown by the service, and a fresh state request after reopening still carries the message |
| AC-06 | timer screen shows the waiting message beside the ready phase | component | The phase-ended (or ended-while-asleep) message is rendered next to the ready phase and is absent when the state carries none |
| AC-07 phase end readies the next phase | a focus session that runs out counts and readies a short break | unit | Focus session 2 of 4 ending gives 2 of 4 completed and a ready short break at 5:00, not running |
| AC-07 | a break that runs out readies a focus session | unit | A short break ending gives a ready focus session at 25:00, not running, cycle unchanged |
| AC-07 | the service broadcasts the ready next phase and arms no phase deadline for it | integration | After the phase-end timeout fires, the broadcast state is the ready next phase and the only armed timeout is the next local midnight |
| AC-08 ready phase never starts by itself | a ready break stays at full length while untouched | unit | A ready short break after 10 minutes and after 3 hours of simulated time is still ready at 5:00 with no time counted |
| AC-08 | an untouched ready phase produces no timer activity | integration | Advancing time by 3 hours with a ready phase produces no phase change, no notification and no broadcast (other than a crossed local midnight) |
| AC-09 long break | the 4th completed focus session readies a long break | unit | With 3 completed, focus session 4 of 4 ending gives 4 of 4 completed and a ready long break at 15:00 |
| AC-09 | a long break that runs out starts a new cycle | unit | The long break ending returns the cycle to 0 with focus session 1 of 4 ready at 25:00 |
| AC-09 | a skipped long break starts a new cycle | unit | Skipping the long break (ready, running or paused) returns the cycle to 0 with focus session 1 of 4 ready at 25:00 |
| AC-10 reset | resetting a running or paused phase readies the same phase at full length | unit | A focus session (or break) at 12:34 with 1 completed becomes the same phase, ready, at its full length (25:00 for a focus session), and the cycle still shows 1 completed |
| AC-11 skip does not count | skipping a running focus session does not count it | unit | With 2 completed and focus session 3 at 10:00, Skip gives a ready short break and the cycle still shows 2 completed |
| AC-11 | skipping a break readies the next focus session | unit | Skipping a short break (running, paused or ready) gives a ready focus session with the cycle unchanged |
| AC-11 | only a completed focus session advances the cycle, across random command sequences | unit | Over 10,000 random sequences the cycle count rises only on a focus session's on-time end (see the Command safety scenario) |
| AC-12 restart cycle | the loss summary names completed sessions and the phase in progress | unit | With 3 completed and a phase running or paused, the summary names 3 completed focus sessions and the phase in progress; with the cycle at 0 and a ready phase it names nothing |
| AC-12 | an unconfirmed Restart cycle that would lose progress changes nothing | unit | The state is unchanged and the outcome says confirmation is needed, carrying the loss summary |
| AC-12 | a confirmed Restart cycle starts a fresh cycle and drops the phase uncounted | unit | The cycle is 0, focus session 1 of 4 is ready at 25:00, and the running or paused phase is not counted |
| AC-12 | Restart cycle with nothing to lose acts at once | unit | With the cycle at 0 and a ready phase, Restart cycle applies without asking |
| AC-12 | no window can restart a cycle with progress without confirmation | contract | A Restart cycle command without the confirmation flag, from any window, returns «needs confirmation» with the loss summary and the timer state stays unchanged |
| AC-12 | the confirmation dialog names the loss, confirms or cancels | component | The dialog shows the loss summary from main; Confirm sends Restart cycle with confirmation at the revision on screen; Cancel sends nothing; a confirmed command that comes back ignored shows the current state |
| AC-12 | User cancels, then confirms, Restart cycle in the real window | e2e-through-UI | After Cancel the running phase and cycle are as before; after Confirm focus session 1 of 4 is ready at 25:00 with the cycle at 0 |
| AC-13 close, reopen, quit | closing the timer window hides it and the phase keeps running | integration | The close request hides the single window instead of destroying it; the armed phase-end timeout is untouched |
| AC-13 | reopening from the Dock or a notification shows the same single window | integration | Activate and notification click show the existing window; no second window is ever created |
| AC-13 | quitting with progress at stake asks first and names the loss | integration | With completed sessions or a phase in progress, a user quit shows a confirmation naming what will be lost; Cancel keeps the app running and the state unchanged; Confirm quits |
| AC-13 | quitting with nothing to lose does not ask | integration | With the cycle at 0 and a ready phase the app quits without a confirmation |
| AC-13 | a quit for logout, shutdown or restart is never asked and never blocked | integration | After the system shutdown signal, the quit proceeds with no confirmation even with progress at stake |
| AC-13 | a reopened window shows the current remaining time on its first frame | component | On the first render after the window becomes visible the countdown is computed from the phase's end time, not an older value; an older snapshot never overwrites a newer one |
| AC-13 | the phase keeps running with the window closed and reopening shows it current | e2e | Closing the window during a running phase keeps the process and the phase alive; reopening shows the same window with the remaining time matching main's state within 1 s |
| AC-13 | a second launch for the same account reuses the one window | e2e | Launching again with the same user-data directory does not open a second window; the existing one is shown |
| AC-13 | the next launch after a quit starts fresh | e2e | After quitting with a phase running and relaunching, focus session 1 of 4 is ready with the cycle at 0 |
| AC-14 sleep | a focus session whose end passed during sleep is not counted | unit | Running with 15:00 left and 1 completed, sleep for 2 hours then wake gives a ready short break, cycle still 1, the asleep message, and one notification saying it ended while asleep |
| AC-14 | a short sleep lets the focus session continue | unit | Sleep for 5 minutes then wake leaves the focus session running with 10:00 left |
| AC-14 | a short break that ended during sleep readies the next focus session | unit | On wake the next focus session is ready at 25:00, the cycle unchanged, with an ended-while-asleep notification |
| AC-14 | a long break that ended during sleep ends as usual | unit | On wake the cycle is 0 and focus session 1 of 4 is ready at 25:00, with an ended-while-asleep notification |
| AC-14 | a paused phase is untouched by sleep | unit | A paused phase keeps its remaining time and status across sleep and wake |
| AC-14 | brief background wakes during sleep are ignored | unit | A wake signal arriving while sleep is still recorded, followed by the real wake, settles the phase once, as for one continuous sleep |
| AC-14 | a focus session that ended before the Mac slept is counted, even if noticed late | unit | A scheduled end at or before the sleep moment counts the focus session as completed |
| AC-14 | sleep across midnight applies the sleep result first, then the new day | unit | A focus session running at 23:50 with the Mac asleep until 08:00 wakes to focus session 1 of 4 ready at 25:00, cycle 0, the asleep message, and exactly one notification |
| AC-14 | system sleep and wake reach the timer service | integration | The OS suspend and resume signals become the service's sleep and wake inputs; a sleep across midnight produces exactly one notification |
| AC-15 new day | a phase not running on a later date is replaced by a fresh cycle | unit | Yesterday's paused focus session 4 of 4 (14:07, 3 completed) gives focus session 1 of 4 ready at 25:00, cycle 0, not counted; the same for a ready phase |
| AC-15 | a phase paused across midnight is cleared at midnight | unit | The midnight input clears the paused phase into a fresh cycle |
| AC-15 | a Start just after midnight starts focus session 1 of 4 | unit | A Start at 00:02 on yesterday's ready break starts focus session 1 of 4, never the break |
| AC-15 | a focus session running across midnight counts, then a fresh cycle starts | unit | A focus session ending at 00:10 is counted, no long break is offered even for focus session 4 of 4, and focus session 1 of 4 is ready at 25:00 with the cycle at 0; the notification says complete and focus session 1 of 4 ready |
| AC-15 | the next local midnight is found correctly, including across a daylight-saving change | integration | The clock adapter returns the next local midnight and the local date for normal days and daylight-saving transition days |
| AC-15 | the service checks for a new day at midnight, wake, launch and clock or time-zone change | integration | A timeout is armed for the next local midnight; firing it, a wake, a launch and a clock or time-zone change notification each run the new-day check before any command is applied |

## Edge cases / error paths

The error and authorization criteria already have their own rows above: AC-02 (repeated, late and
off-table commands — four unit rows, one contract row, one e2e-through-UI row) and AC-03 (account
isolation — its own e2e row). The boundary and failure cases the spec and ADRs imply:

| Case | Test name (intent-based) | Level | Expected outcome |
|---|---|---|---|
| Malformed command (unknown kind, missing revision, wrong types) | a malformed timer command is refused | contract | Failed result, nothing logged as a crash, timer state and revision unchanged |
| Command carrying a revision newer than the current one | a command from the future is ignored | unit | Ignored, state unchanged |
| Clock set backward mid-phase | a backward clock jump never adds time beyond the full length | unit | Remaining time is clamped at the phase's full length |
| Clock set backward after a phase ended | a backward clock jump never resurrects an ended phase | unit | The ready next phase stays ready |
| Clock set forward past a running focus session's end | a forward clock jump completes and counts the focus session (accepted debt) | unit | Counted as completed, next phase ready, one notification |
| Phase-end timeout fires slightly early | an early timeout does not end the phase | integration | No phase end; the timeout is re-armed for the remaining time |
| Phase-end timeout fires late with the Mac awake | a late timeout settles the phase at its scheduled end | unit | Counted as completed, as if detected on time |
| Wake with no recorded sleep | a wake without a prior sleep settles nothing extra | unit | Only the normal deadline and new-day checks run |
| Notification cannot be shown | a failed notification still bounces the Dock and keeps the message | integration | Dock bounce once, message in state, error logged, no crash |
| Window subscribes after a broadcast it missed | a window that missed a broadcast pulls the current state | component | First render after mount shows the current snapshot from the state request |
| Unexpected throw inside a timer handler | an unexpected handler error becomes a failed result | contract | Failed result returned to the window, error logged, state unchanged |
| Test timer config set in a packaged build, or malformed | the test timer config never changes a packaged build | integration | Packaged: default 25/5/15 config; malformed JSON in an unpackaged build: default config and a logged warning |
| Two windows racing Restart cycle with confirmation | a confirmed Restart cycle at a stale revision is ignored | unit | Ignored; the window shows the current state and the User can choose again |

## Test data

- **Seed strategy:** state builders that follow `TIMER_STATE_IN_MEMORY` in data-model.md — e.g. a
  ready focus session with N completed, a running phase with a given remaining time, a paused
  phase, a state with `sleptAt` set, a state with a notice — built from `DEFAULT_TIMER_CONFIG`
  and a fixed simulated start instant. No persisted data: `settings.json` is untouched by this
  step, so no store fixture is needed.
- **Time and date:** every unit and integration test runs on a simulated clock in one pinned time
  zone that has a daylight-saving change, so midnight and DST cases are deterministic. The
  property test uses a fixed seed that is printed on failure so a failing sequence can be
  replayed.
- **Integration dependency:** there is no datastore in this feature, so there is nothing to spin
  up as a throwaway container. The dependencies main owns are the Electron/macOS APIs; at the
  integration level only that thin adapter edge is replaced, and everything inside main is real.
  The real runtime is the e2e tiers: the built app launched against a throwaway user-data
  directory created per test (the existing boot test's pattern).
- **Cleanup boundary:** per-test. Unit and integration tests build a fresh state and service and
  restore real timers after each test. Each e2e test closes the app and deletes its user-data
  directory in a `finally`-style teardown, so runs never share state.

## NFR validation (load)

No NFR is a throughput or load target, so there is no load test (Load level: N/A). Each numeric
spec §6 NFR still gets a concrete scenario at the level that can measure it:

- **Phase-end detection latency ≤ 1 s** → e2e: shortened phases of 3 s, window closed, run 5
  consecutive phase ends; assert each state change lands ≤ 1 s after its scheduled end.
  Plus the packaged-app check: one focus session after 30 minutes in the background.
- **Timing accuracy ≤ 1 s off wall clock over 25 min** → unit: step a simulated clock through a
  full 25-minute focus session in 1 s steps, including a window reopen and a 5-minute sleep;
  assert |shown remaining − (end − now)| ≤ 1 s at every step. Component: first render after the
  window becomes visible is within 1 s. Plus one real 25-minute packaged run against the system
  clock.
- **Control responsiveness ≤ 100 ms** → e2e-through-UI: click each of Start, Pause, Reset, Skip
  and Restart cycle 10 times; assert every click-to-visible-change time ≤ 100 ms.
- **Background resource use ≤ 1 % average CPU over 10 min, Energy Impact «Low»** → manual on the
  owner's Mac with the packaged app, window closed, one running phase, 10 minutes, read from the
  macOS activity/energy monitor. Integration: while a phase runs, main holds at most one armed
  timeout and no repeating interval.
- **Command safety: 0 violations across 10,000 random sequences** → unit property test: 10,000
  generated sequences of the five commands, repeats, stale revisions, sleep/wake gaps, day and
  clock changes, fixed logged seed; assert after every step 0 cases of two phases running, a
  double count, a cycle advance by anything but a completed focus session, or a reset to 0
  outside the reset list.
- **Launch time ≤ 2 s** → e2e: 3 cold launches with fresh user-data directories; assert each
  shows a ready «focus session 1 of 4» ≤ 2 s after launch. Plus a manual stopwatch check of the
  packaged app.

## CI placement

- **On every PR (existing macOS CI job, `npm test`):** unit (including the 10,000-sequence
  property test), contract, integration and component — all node / simulated-DOM, seconds in
  total.
- **On every PR, added as a step after the build:** e2e and e2e-through-UI. With shortened
  phases the whole set stays well under two minutes, and the CI runner is already macOS.
- **Pre-release (manual, T17 packaged-app checklist):** 30-minute background phase end, real
  25-minute accuracy run, CPU / Energy Impact, lid-close sleep before and after a phase end,
  logout and restart with progress at stake, time-zone and clock change, notifications blocked.
