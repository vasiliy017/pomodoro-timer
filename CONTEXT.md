---
status: Living
updated_at: "2026-10-31"
---

# Domain Context — pomodoro-timer

## Glossary

- Completed focus session — a focus session whose full length ran out while the Mac was awake, without being reset or skipped; the only thing that counts toward the long break. NOT a skipped, reset or slept-through focus session.
- Cycle — the count of completed focus sessions toward the next long break, belonging to the Mac's local date it began on; it goes back to 0 after a long break ends or is skipped, on Restart cycle, on quit, and on a new day (whenever the current phase is not running and the date is later than the cycle's date). NOT a day and NOT a phase.
- Focus session — a phase of concentrated work (25 minutes by default). NOT one launch of the app.
- Long break — the longer rest phase earned by the 4th completed focus session of a cycle (15 minutes by default). NOT a short break taken late.
- Phase — one timed stretch of the cycle: a focus session, a short break or a long break. NOT a pause (a pause stops a phase's clock; it is not a phase).
- Ready phase — the next phase, shown at full length but not running until the User starts it. NOT a paused phase (which has partly elapsed).
- Short break — the rest phase after a completed focus session that does not earn a long break (5 minutes by default). NOT a long break.
- User — the one person running the app on their own Mac; the app is single-user and local, so there is no other role. NOT the public (a market segment in the idea brief, not a separate role in the product).

## Invariants

- Exactly one phase is current at any time — ready, running or paused; when a phase ends, the next phase becomes current as a ready phase, and «ended» is only a message to the User, never a state.
- A phase never starts by itself; only the User starts it.
- Only a completed focus session advances the cycle.
