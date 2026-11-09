# Changelog — focus-timer-core

## focus-timer-core — a dependable focus-and-break cycle you start yourself

**What:** The app is now a working Pomodoro timer. You start a 25-minute focus session and see
the time left, and you can pause, resume, reset or skip it. When it ends, a 5-minute short break
is ready, and the 4th completed focus session leads to a 15-minute long break. Nothing starts by
itself: every phase waits until you press Start. Each phase end posts a system notification and
bounces the Dock icon once. The timer screen keeps a «Focus session complete» or «Break over»
message beside the ready phase, so a phase end is never silent, even with notifications blocked.
Closing the window keeps the timer running, and the Dock icon brings back the same window,
showing the current time. Restart cycle, and quitting while progress would be lost, first ask for
confirmation and name what will be lost.

The cycle count is honest. Only a focus session that runs out counts. A skipped or reset session
doesn't, and neither does one that ended while the Mac was asleep: the window and a notification
say so. A new local day starts a fresh cycle. A quit always starts fresh at the next launch.

**Why:** Every later roadmap step needs a timer the owner can trust all working day: the
session-end ritual, the break ritual, durations and statistics
([spec](spec.md) §1–§2). Competitor timers either chain phases automatically or end them
silently. This one waits for you and always signals. Key decisions:

- The timer rules are one pure transition function in `src/shared/timer.ts`, unit- and
  property-tested ([ADR-0001](adr/0001-model-timer-rules-as-a-pure-transition-function.md)). They
  run in the main process (repo-level
  [ADR-0002](../../adr/0002-run-the-timer-engine-in-the-main-process.md)).
- Time comes from the wall clock, clamped. A phase never gains time beyond its full length, and a
  backward clock jump never brings back an ended phase
  ([ADR-0002](adr/0002-trust-the-wall-clock-with-clamps.md)).
- Main arms one timeout for the next phase end
  ([ADR-0003](adr/0003-arm-one-deadline-timeout-in-main.md)), and the bundle opts out of App Nap so
  that timeout fires on time in the background
  ([ADR-0004](adr/0004-disable-app-nap-in-the-app-bundle.md)).
- Sleep and wake come from `powerMonitor` and feed the rules
  ([ADR-0005](adr/0005-feed-sleep-and-wake-into-the-rules-from-powermonitor.md)).
- Main pushes a snapshot on every change, and the window counts down from it
  ([ADR-0006](adr/0006-push-snapshots-on-change-and-count-down-in-the-window.md)). The push goes
  through a typed main → renderer event contract
  ([ADR-0007](adr/0007-add-a-typed-main-to-renderer-event-contract.md)).
- Each command carries the revision the user saw, so double-clicks and late repeats have no extra
  effect ([ADR-0008](adr/0008-target-each-command-at-the-revision-the-user-saw.md)).
- Closing the one timer window hides it
  ([ADR-0009](adr/0009-hide-the-single-timer-window-on-close.md)).

**How to use:** Launch the app. The screen shows «Focus session 1 of 4» ready at 25:00, and only
the controls that apply are shown: Start, Pause / Resume, Reset, Skip and Restart cycle (AC-02b).
The window reaches the timer only through `window.api`: `timer:get-state`, `timer:command` and
the `timer:state` event ([contracts/public-api.md](contracts/public-api.md)).

**Operational notes:**
- Migration: none. Timer state lives only in memory and is never written to disk
  ([data-model.md](data-model.md)).
- Feature flag / config:
  - The macOS bundle sets `NSAppSleepDisabled` through `mac.extendInfo` in
    `electron-builder.yml`.
  - Unpackaged builds (`npm run dev`, the e2e run of `out/`) accept `POMODORO_TEST_TIMER_CONFIG`,
    a JSON object of shorter phase lengths in ms, as a test seam. The packaged app ignores it.
- Rollback: revert the merge commit. There is no persisted state to unwind.
- Before the public release (roadmap step 4): the on-device checks in
  [verification.md](verification.md) still need to run on the packaged app. They cover background
  CPU and App Nap, a real 25-minute run, lid-close sleep, clock and time-zone changes, blocked
  notifications, and logout and restart. Only check 2 (App Nap key in the bundle) has run.

**Acceptance criteria delivered:** AC-01 – AC-15, including AC-02b: the countdown with «focus
session N of 4»; single-effect repeated commands; the control table; a separate timer per macOS
account; pause that never expires; phase-end notification plus Dock bounce and a lasting on-screen
message; phases that wait for the user; the long break after 4 completed sessions; Reset; Skip,
which never counts; Restart cycle and quit with confirmation; close-to-hide with one window;
honest sleep handling; and a fresh cycle each local day.
