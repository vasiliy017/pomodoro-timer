---
status: Draft
owner: "Vasiliy"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-31"
feature_size: "M"
---

# Spec — focus-timer-core

> **Glossary:** [CONTEXT](../../../CONTEXT.md)
> **Reference module / docs / channels used:** None — only the interview, [idea-brief.md](../../idea-brief.md), [roadmap.md](../../roadmap.md) step 2, [architecture-map.md](../../architecture-map.md), [ADR-0002](../../adr/0002-run-the-timer-engine-in-the-main-process.md), [ADR-0003](../../adr/0003-persist-data-as-versioned-local-json.md) and CONTEXT.

## 1. Context

The owner wants a free, calm desktop Pomodoro timer they use every working day (idea-brief §2,
§3); the public is an assumed second audience. Every later step on the roadmap — the
session-end ritual, the break ritual, durations, ambient audio, statistics — builds on one thing
this step delivers: a dependable cycle of focus sessions and breaks that the User controls and
can trust. Without it there is nothing to use daily and nothing to make soulful.

Why now: this is the first buildable step after the skeleton (roadmap step 2). The product's only
success signal — the owner using it every working day for several weeks without going back to a
previous timer (idea-brief §7) — cannot start until a usable timer exists, and the first public
release ships straight after this step (roadmap step 4).

**Committed approach (owner-accepted):** a classic, manually advanced cycle — 25-minute focus
sessions, 5-minute short breaks, and a 15-minute long break earned by the 4th completed focus
session — where every phase waits for the User to start it, and a plain system notification marks
every phase end until the Session-end ritual replaces it. The User can pause, reset or skip a
phase and restart the cycle; only a completed focus session advances the cycle, and nothing about
the running timer survives a quit. This rests on three signals: competitor timers diverge on what
happens at a phase end (the closest free peer chains every phase automatically, the opposite of a
ritual pause); the sharpest failure mode found is a phase that ends silently and rolls on
unnoticed; and the success criterion is daily use, which needs a timer that never surprises.

Traceability:
- Direction, users and scope: idea-brief §2, §3, §5, §7; roadmap step 2 (Focus timer core) and
  its edges to Session-end ritual, Configurable durations and Local statistics.
- Competitive scan (2026-10-31, secondary sources except where noted): Pomotroid defaults to
  25/5/15 with 4 rounds and auto-starts every phase (verified from its source); Be Focused makes
  auto-start optional; Session waits at a phase end; the original technique voids an abandoned
  pomodoro. Products do not document reset scope or sleep behaviour.
- Failure-mode review (clean context): silent phase end with automatic advance; sleep catch-up;
  state lost on quit; closing the only window without a menu-bar icon; undefined cycle-count
  rules; open-ended pause; repeated or crossing commands; stale countdown on reopen; late
  detection of a phase end while the app is in the background; durations fixed in the rules.
  Each is either settled by an acceptance criterion below or recorded in §8.

## 2. Goals

- The User can run their whole working day on this timer — focus sessions and breaks — without
  reaching for another one.
- No phase end goes unnoticed, even when the timer window is hidden or closed.
- The cycle count is honest: only real, completed focus sessions earn the long break, so the
  later Statistics step can record them as they are.

## 3. Non-goals

- **The Session-end ritual** (own window, animation, chime) — roadmap step 5; here a plain system
  notification is the signal.
- **Changing phase lengths** — roadmap step 7; lengths are fixed at 25/5/15 with a long break
  after 4 completed focus sessions until then, though the rules take them as an input.
- **Recording history or statistics** — roadmap step 9; this step only defines what a completed
  focus session is.
- **Surviving a quit or restart** — owner decision: quitting ends the current phase uncounted and
  the next launch starts fresh.
- **A menu-bar icon** — removed from v1 at roadmap review; the window and the Dock are the only
  surfaces.

## 4. User stories

### US-01: Start a focus session

**As a** User
**I want** start a focus session and see the time left
**So that** I work in a timed block

### US-02: Pause and resume

**As a** User
**I want** pause a running phase — a focus session or a break — and resume it later
**So that** an interruption doesn't cost me the session

### US-03: Hear when a phase ends

**As a** User
**I want** a system notification when any phase ends
**So that** I notice it even with the window hidden

### US-04: Start the next phase myself

**As a** User
**I want** the next phase to wait, as a ready phase, until I start it
**So that** I finish my thought before resting, and rest before focusing

### US-05: Earn a long break

**As a** User
**I want** the 4th completed focus session of a cycle to lead into a long break
**So that** I get a real rest after a full cycle

### US-06: Reset or skip a phase

**As a** User
**I want** to restart the current phase or move past it
**So that** interruptions are handled without faking progress

### US-07: Restart the cycle

**As a** User
**I want** to put the cycle back to zero, after confirming when progress would be lost
**So that** I can start over when the count no longer fits my day

### US-08: Close the window, keep timing

**As a** User
**I want** closing the window to keep the timer running, and to reopen the window from the Dock
**So that** the window is out of my way without stopping my session

### US-09: Trust the timer across sleep

**As a** User
**I want** the timer to keep real time while the Mac sleeps, without counting a focus session that ended while it slept
**So that** the time is right when I come back and the cycle stays honest

### US-10: Start each day fresh

**As a** User
**I want** the first time I come back on a new day to start a fresh cycle, clearing any phase left ready or paused from the day before
**So that** yesterday's sessions don't trigger a long break first thing

## 5. Acceptance criteria

### AC-01 (US-01) — happy

**Given** the User has a ready focus session and the cycle is at 0 of 4
**When** the User starts it
**Then** the focus session runs, counting down from 25:00, and the screen shows that it is a focus session and that it is focus session 1 of 4 in the cycle

### AC-02 (US-01) — error

**Given** a focus session is already running
**When** the User presses Start again (for example a double-click), or tries a control that does not apply to the current state (such as Pause on a ready phase)
**Then** the running phase carries on unchanged — it is not restarted and nothing is counted twice — and only the controls that apply to the current state are offered

### AC-03 (US-01) — authorization

**Given** a second person uses a different macOS account on the same Mac
**When** they open the app
**Then** they get their own timer, at a ready focus session with their own cycle, and cannot see or affect the User's running phase

### AC-04 (US-02) — happy

**Given** a focus session or a break is running with 12:34 left
**When** the User pauses it and later resumes it
**Then** while paused the remaining time stays at 12:34 and the screen shows the phase as paused; on resume it counts down from 12:34; a pause never expires on its own (only a new day clears it, AC-15)

### AC-05 (US-03) — happy

**Given** a focus session is running and the timer window is hidden behind other apps or closed
**When** the focus session's time runs out
**Then** a system notification appears saying the focus session is complete and that a short break (or long break) is ready, and clicking it brings the timer window to the front; the same applies when a break ends («break over — focus session ready»)

### AC-06 (US-03) — cross-context

**Given** the User has blocked notifications for the app in the Mac's settings, or Focus / Do Not Disturb is on
**When** a phase ends
**Then** the timer window still tells the User the phase has ended and shows the next phase ready, and the app's Dock icon draws attention once, so the phase end is never completely silent; because the app cannot tell whether the Mac hid its notification, the Dock icon does this on every phase end

### AC-07 (US-04) — happy

**Given** focus session 2 of 4 is running
**When** its time runs out
**Then** it counts as a completed focus session, the cycle shows 2 of 4 completed, and a short break appears as the ready phase at 5:00, not running; when a break's time runs out, a focus session appears as the ready phase at 25:00, not running

### AC-08 (US-04) — domain invariant

**Given** a short break is the ready phase after a focus session ended
**When** nobody touches the app for any length of time (10 minutes or 3 hours)
**Then** the short break is still ready at its full 5:00 and no time has been counted against it — a phase never starts by itself; it starts only when the User starts it

### AC-09 (US-05) — happy

**Given** 3 completed focus sessions in the cycle and focus session 4 of 4 running
**When** its time runs out
**Then** the cycle shows 4 of 4 completed and a long break appears as the ready phase at 15:00; when that long break's time runs out, or it is skipped, the cycle goes back to 0 and focus session 1 of 4 appears as the ready phase

### AC-10 (US-06) — happy

**Given** a focus session (or break) is running or paused with 12:34 left and 1 completed focus session in the cycle
**When** the User resets it
**Then** the same phase becomes the ready phase at its full length (25:00 for a focus session), not running, and the cycle still shows 1 completed

### AC-11 (US-06) — domain invariant

**Given** 2 completed focus sessions and focus session 3 of 4 running with 10:00 left
**When** the User skips it
**Then** the cycle still shows 2 completed and a short break appears as the ready phase — only a completed focus session advances the cycle, so the skipped one is not counted; skipping a break makes the next focus session the ready phase

### AC-12 (US-07) — happy

**Given** 3 completed focus sessions in the cycle
**When** the User chooses Restart cycle
**Then** the app asks for confirmation whenever something would be lost — completed focus sessions in the cycle or a running or paused phase — and names what will be lost (here, 3 completed focus sessions that will no longer count toward the long break, plus the phase in progress if there is one); on confirm any running or paused phase ends uncounted, the cycle is 0 and focus session 1 of 4 is the ready phase at 25:00; on cancel nothing changes; only when the cycle is at 0 and the current phase is ready does Restart cycle act immediately without asking

### AC-13 (US-08) — happy

**Given** a focus session is running with 18:00 left
**When** the User closes the timer window
**Then** the focus session keeps running and its phase-end notification still arrives; clicking the Dock icon (or the notification) reopens the window, which shows the current remaining time immediately, not an older value counting down; if instead the User quits the app, the running phase ends uncounted and the next launch shows focus session 1 of 4 as the ready phase with the cycle at 0

### AC-14 (US-09) — cross-context

**Given** a focus session is running with 15:00 left and 1 completed in the cycle
**When** the Mac sleeps for 2 hours and wakes
**Then** the window tells the User the focus session ended while the Mac was asleep and was not counted, the cycle still shows 1 completed, a short break is the ready phase, and a notification says the focus session ended while the Mac was asleep; if the Mac sleeps for only 5 minutes, the focus session simply continues with 10:00 left; if instead a break's end passed while the Mac slept, on wake the next focus session is the ready phase at 25:00, the cycle is unchanged, and a notification says the break ended while the Mac was asleep; a paused phase is untouched by sleep

### AC-15 (US-10) — cross-context

**Given** yesterday the User left focus session 4 of 4 paused with 14:07 left, with 3 completed in a cycle that began yesterday
**When** the User comes back to the app the next day
**Then** the app shows focus session 1 of 4 as the ready phase at 25:00 with the cycle at 0, and yesterday's paused session is not counted — a cycle belongs to the Mac's local date it began on, and whenever the current phase is not running on a later date the app starts a fresh cycle; a phase running across midnight is left alone until it ends: a focus session that runs out at 00:10 counts as a completed focus session, and the fresh cycle starts straight after it, with focus session 1 of 4 as the ready phase

## 6. Non-functional requirements

| Aspect | Target | Measurement |
|---|---|---|
| Phase-end detection latency | ≤ 1 s from a phase's scheduled end to its notification and on-screen change, window hidden or closed, Mac awake | automated test with shortened phase lengths; one on-device check after 30 minutes in the background |
| Timing accuracy | remaining time shown never more than 1 s off wall-clock time over a 25-minute focus session, including after reopening the window or waking the Mac | unit tests with a simulated clock; one real 25-minute run checked against the system clock |
| Control responsiveness | ≤ 100 ms from a click on Start, Pause, Reset, Skip or Restart cycle to the visible change | end-to-end test timing click → screen change |
| Background resource use | ≤ 1% average CPU over 10 minutes and Energy Impact «Low» while a phase runs with the window hidden or closed | Activity Monitor on the owner's Mac, manual check before shipping |
| Command safety | 0 cases of two phases running at once, a focus session counted twice, the cycle advanced by anything but a completed focus session, or the cycle reset to 0 by anything outside the glossary's reset list (long break ended or skipped, Restart cycle, new day, quit), across 10,000 random command sequences (repeats, two windows, clock changes) | randomized property test over the timer rules in CI |
| Launch time | ≤ 2 s from a cold launch to the timer screen showing a ready focus session | end-to-end boot test timing to first window; manual stopwatch check of the packaged app |

## 6.1 Security / privacy

- **Data classification:** internal — timer state for one person's working rhythm; nothing in this
  step is stored on disk or leaves the Mac.
- **Personal data touched:** none. The running phase and the cycle live only while the app runs
  (a quit starts fresh); no history is recorded in this step.
- **AuthZ/AuthN impact:** no accounts and no new permission checks. The only boundary is the
  macOS account: each account has its own independent timer (AC-03). The timer window can only
  ask the timer to start, pause, reset, skip or restart; it cannot set the time, the phase or the
  cycle directly.
- **Abuse cases:**
  - A compromised or buggy window sends crafted or repeated commands: only the five commands
    exist, a command that does not fit the current state is ignored, and repeats have no extra
    effect (AC-02, Command safety NFR).
  - Another macOS account on the same Mac tries to read or change the User's timer: denied by
    construction — each account runs its own app instance with its own state (AC-03).
  - Notification spam: at most one notification per phase end, and phases never start by
    themselves (AC-08), so the app cannot fire notifications in a loop.
  - Notification content leaking something private: notifications only name the phase that ended
    and the ready phase; there is no user-entered text in this step.
- **Security review:** N/A — no new authorization boundary, no personal data, no network access,
  no persisted data in this step.

## 7. Metrics / KPIs

- **Daily use** — baseline: 0 days (no timer of ours exists), target: the owner uses this build on
  10 of the first 10 working days after it ships, without going back to a previous timer.
  Measured by the owner's one-line daily log until Statistics (roadmap step 9) can count it. This
  is the first checkpoint toward the overall success target, set here (resolving roadmap D5): the
  owner uses the app every working day for 4 weeks (20 working days) without going back to a
  previous timer.
- **A full cycle per day** — baseline: 0, target: on ≥ 7 of those first 10 working days, ≥ 4
  completed focus sessions (one full cycle reaching a long break). Measured by the same daily log.
- **No missed phase ends** — baseline: not measured for the previous timer (measurement plan: the
  daily log records any phase end noticed more than a minute late), target: 0 during the first 10
  working days.
- **Trust in the timer** — baseline: 0 reports (nothing released yet), target: 0 reports of a wrong
  count or wrong remaining time — from the owner or as GitHub issues labelled as timer bugs —
  within 30 days of the first public release containing this step.

## 8. Open questions

- [ ] When the Mac's clock is changed or corrected mid-phase (time-zone change, manual change, network time correction), which time does the timer trust? Default now: remaining time follows the wall clock, but a phase never gains time beyond its full length and a backward jump never resurrects an ended phase. — owner: Vasiliy (with design), due: before `sdd:design` closes
- [ ] Does meeting the ≤ 1 s phase-end detection target require stopping macOS from suspending the app while a phase runs, and does that break the ≤ 1% background CPU target? Default now: keep the app from being suspended only while a phase is running, and verify both numbers on the owner's Mac. — owner: Vasiliy, due: on-device spike during `sdd:design`
- [ ] ADR-0002's context still assumes a menu-bar icon (removed from v1 at roadmap review) and claims clock jumps cause no drift; it needs amending so design does not build on stale assumptions. Default now: design records a follow-up ADR that supersedes those two points. — owner: Vasiliy, due: during `sdd:design`
