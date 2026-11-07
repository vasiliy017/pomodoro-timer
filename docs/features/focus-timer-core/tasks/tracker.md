# Tracker — focus-timer-core

> Status of every task in the epic. `implement` updates **Status** and **Step** after every
> subagent it runs (and commits them with the task), so this table shows where the run is right now.
> Status: `todo` · `in_progress` · `blocked` · `review` · `done`.
> Step: `SELECT` · `RED` · `GREEN` · `REFACTOR` · `GATE` · `REVIEW` · `COMMIT` (`—` before the task starts).
> A `blocked` row carries its reason in Step, e.g. `GATE — lint red after 3 retries`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status | Step |
|---|---|---|---|---|---|---|---|
| T1 | Define the timer types, default config and pure snapshot helpers | domain | Vasiliy | M | — | done | COMMIT |
| T2 | Implement transition() for the five commands | domain | Vasiliy | M | T1 | done | COMMIT |
| T3 | Implement the deadline transition | domain | Vasiliy | M | T2 | done | COMMIT |
| T4 | Implement sleep, wake, new-day and clock-change transitions | domain | Vasiliy | M | T3 | done | COMMIT |
| T5 | Add the 10,000-sequence command-safety property test | tests | Vasiliy | S | T4 | done | COMMIT |
| T6 | Add the main-process clock adapter | infra | Vasiliy | S | — | done | COMMIT |
| T7 | Add the phase-end signals adapter and the single timer window | infra | Vasiliy | M | T1 | done | COMMIT |
| T8 | Map powerMonitor and clock notifications to timer callbacks | infra | Vasiliy | S | — | done | COMMIT |
| T9 | Add the quit guard | app | Vasiliy | S | T1 | done | COMMIT |
| T10 | Build the timer service | app | Vasiliy | M | T4, T6 | done | COMMIT |
| T11 | Add the IPC timer contract across shared, main and preload | ports | Vasiliy | M | T6, T7, T10 | done | COMMIT |
| T12 | Add the useTimerState hook | ui | Vasiliy | S | T11 | done | COMMIT |
| T13 | Build the TimerScreen | ui | Vasiliy | M | T12 | done | COMMIT |
| T14 | Add the Restart-cycle confirmation dialog | ui | Vasiliy | S | T13 | done | COMMIT |
| T15 | Wire main and opt out of App Nap | wiring | Vasiliy | M | T7, T8, T9, T10, T11 | done | COMMIT |
| T16 | Add end-to-end timing tests | tests | Vasiliy | M | T14, T15 | done | COMMIT |
| T17 | Mark repo ADR-0002 partially superseded; write the device checklist | docs | Vasiliy | S | — | done | COMMIT |
| T18 | Settle a phase that is already due before judging a command | domain | Vasiliy | S | — | done | COMMIT |
| T19 | Keep a waiting phase-end notice through the new-day reset | domain | Vasiliy | S | T18 | done | COMMIT |
| T20 | Refuse timer commands that carry extra fields | domain | Vasiliy | S | T19 | done | COMMIT |
| T21 | Share one loss sentence between the quit dialog and Restart cycle | domain | Vasiliy | S | T20 | done | COMMIT |
| T22 | Ignore repeat clicks on the controls and keep focus on the primary button | ui | Vasiliy | S | T21 | done | COMMIT |
| T23 | Link the Restart-cycle loss text to the dialog | ui | Vasiliy | S | — | done | COMMIT |
| T24 | Expire the OS-initiated-quit flag after a cancelled logout | app | Vasiliy | S | — | done | COMMIT |
| T25 | Stop the timer window going full screen | infra | Vasiliy | S | — | done | COMMIT |
| T26 | Fill in the missing end-to-end rows of the test plan | tests | Vasiliy | M | T22, T23, T24, T25 | done | COMMIT |
| T27 | Ignore held-key repeats on the controls and keep focus when a control removes itself | ui | Vasiliy | S | — | done | COMMIT |
| T28 | Document that an ignored command can first settle a phase that is already due | docs | Vasiliy | S | — | done | COMMIT |
| T29 | Make the double-click, held-key, second-launch and relaunch e2e tests able to fail | tests | Vasiliy | S | T27 | done | COMMIT |
| T30 | Measure launch time inside the app | tests | Vasiliy | S | T29 | done | COMMIT |

**Total:** 30 tasks (T18–T30 are review follow-ups), ~20.5 person-days (S ≈ ½ day, M ≈ 1 day).
