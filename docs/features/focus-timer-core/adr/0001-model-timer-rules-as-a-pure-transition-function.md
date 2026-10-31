---
status: Accepted
owner: "Vasiliy"
reviewers: []
updated_at: "2026-10-31"
feature_size: "M"
ticket: ""
---

# 0001 — Model the timer rules as one pure transition function over timestamps

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Vasiliy (owner), with Claude during the `design` pass (easy depth, assumptions ledger A6)

## Context

focus-timer-core has many interacting rules. There are three phases and three phase states.
Only a completed focus session advances the cycle. The cycle resets on a new day. Sleep decides
whether a phase counts. A Restart cycle that would lose progress needs confirmation. Repeated
commands must have no extra effect. [repo ADR-0002](../../../adr/0002-run-the-timer-engine-in-the-main-process.md)
puts the engine in main with the rules in `src/shared/timer.ts`, but leaves their shape open.
The shape decides how the spec's 10,000-sequence property test and the simulated-clock tests can
be written, and how much of main is testable without Electron.

## Decision drivers

- Spec §6 NFR *Command safety*: 0 violations across 10,000 random command sequences, as a
  randomized property test over the timer rules in CI.
- Spec §6 NFR *Timing accuracy*: verified by unit tests with a simulated clock.
- Repo convention: the rules live in pure `src/shared/timer.ts`, with no Electron, DOM or `node:`
  imports, and are unit-tested with fake timers (CLAUDE.md, *Timer truth*).
- Spec §3: durations are fixed now but "the rules take them as an input" (roadmap step 7).

## Considered options

1. **One pure transition function.** It has the shape
   `transition(state, input, now, localDate, config) → { state, effects }`. `input` is a User
   command (start, pause, reset, skip, restartCycle) or a system event: deadline reached, sleep,
   wake, day check. `effects` is plain data (notify, bounce the Dock) that main carries out.
2. **An XState statechart in `src/shared`.** A declarative machine definition. The library runs
   the transitions, guards and delayed events.
3. **A stateful `TimerEngine` class in `src/shared` with injected ports.** The class holds the
   state privately. It receives a `Clock` (`now`, `localDate`) and a `Scheduler`
   (`schedule(at, cb)`) through its constructor, and calls them itself.

## Decision outcome

**Chosen:** option 1. A pure function with time and the local date as explicit inputs is the
cheapest way to drive 10,000 random sequences, clock jumps and sleep gaps through the real rules
in a plain Vitest node test. No Electron mock and no fake-timer choreography are needed. Option 2
adds a dependency and a second way of thinking about delays for a machine of one region. Option 3
stays pure, but every test has to drive time through a fake scheduler and inspect hidden state
through methods. The property test would then exercise the timing glue as much as the rules.

## Consequences

**Positive**
- Every AC becomes a table-driven unit test (input sequence → expected state + effects), and the
  Command-safety property test runs against exactly the code that ships.
- Main shrinks to an imperative shell: hold the state, feed it inputs with `Date.now()` and the
  local date, carry out the effects, arm the next timeout (ADR-0003).
- The allowed-controls table (AC-02b) and the Restart-cycle loss summary (AC-12) are derived by
  pure helpers next to `transition`. The renderer never re-implements them.

**Negative**
- Effects-as-data adds a small interpreter in main (`notify`, `bounceDock`) that must stay in step
  with the effect union.
- The state carries derived bookkeeping (`endsAt`, `sleptAt`, `notice`, `revision`) that a
  class could hide.

**Neutral**
- Moving to a statechart later is possible. The input and effect vocabulary maps one-to-one onto
  events and actions.

## Links

- Spec: [[../spec.md]] §5 (AC-02, AC-02b, AC-07 – AC-15), §6 Command safety, Timing accuracy
- SAD: [[../sad.md]] §4, §5
- Related ADR: [[0002-trust-the-wall-clock-with-clamps]], [[0003-arm-one-deadline-timeout-in-main]], [[0005-feed-sleep-and-wake-into-the-rules-from-powermonitor]], [[0008-target-each-command-at-the-revision-the-user-saw]]
