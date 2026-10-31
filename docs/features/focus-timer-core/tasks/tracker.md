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
| T14 | Add the Restart-cycle confirmation dialog | ui | Vasiliy | S | T13 | todo | — |
| T15 | Wire main and opt out of App Nap | wiring | Vasiliy | M | T7, T8, T9, T10, T11 | todo | — |
| T16 | Add end-to-end timing tests | tests | Vasiliy | M | T14, T15 | todo | — |
| T17 | Mark repo ADR-0002 partially superseded; write the device checklist | docs | Vasiliy | S | — | todo | — |

**Total:** 17 tasks, ~13.5 person-days (S ≈ ½ day, M ≈ 1 day).
