import { describe, expect, it } from 'vitest'
import {
  allowedControls,
  createInitialState,
  DEFAULT_TIMER_CONFIG,
  isRestartLossEmpty,
  phaseDurationMs,
  restartLoss,
  toSnapshot,
  transition,
  type TimerCommand,
  type TimerInput,
  type TimerState,
  type TransitionResult
} from './timer'

/**
 * Command safety (spec §6, sad.md §10 QG-2): random sequences of commands, repeats, late commands
 * from a reopened window, phase ends, sleep/wake gaps, clock jumps and day changes. After every
 * step the four invariants must hold: one phase at a time, no focus session counted twice, the
 * cycle advanced only by a completed focus session, and reset to 0 only by the glossary's list.
 */

const SEQUENCES = 10_000
const STEPS = 40
const SEED = 0x5eed_2026
const config = DEFAULT_TIMER_CONFIG
const MIN = 60_000
const DAY = 24 * 60 * MIN
const START = Date.UTC(2026, 9, 31, 8, 0, 0)

/** mulberry32: small, fast and deterministic. */
function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The simulated Mac's local date: whole days since the epoch, as `YYYY-MM-DD`. */
function localDateOf(now: number): string {
  return new Date(Math.floor(now / DAY) * DAY).toISOString().slice(0, 10)
}

interface Step {
  input: TimerInput
  now: number
  localDate: string
}

function generateStep(rand: () => number, s: TimerState, now: number, seen: number[]): Step {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)] as T
  const roll = rand()
  let next = now
  let input: TimerInput

  if (roll < 0.55) {
    // A command at the current revision, or at an older one: a repeat or a late window.
    const revision = rand() < 0.65 ? s.revision : pick(seen)
    const type = pick(['start', 'pause', 'reset', 'skip', 'restartCycle'] as const)
    const command: TimerCommand =
      type === 'restartCycle' ? { type, revision, confirmed: rand() < 0.5 } : { type, revision }
    input = { kind: 'command', command }
    next = now + Math.floor(rand() * 3 * MIN)
  } else if (roll < 0.72) {
    // The armed deadline: around endsAt when running, otherwise some later moment.
    input = { kind: 'deadline' }
    next =
      s.endsAt !== null && rand() < 0.8
        ? Math.max(now, s.endsAt + Math.floor(rand() * 5_000) - 1_000)
        : now + Math.floor(rand() * 4 * 60 * MIN)
  } else if (roll < 0.8) {
    input = { kind: 'sleep' }
  } else if (roll < 0.88) {
    // Wake after a short or a long sleep, sometimes past midnight.
    input = { kind: 'wake' }
    next = now + Math.floor(rand() * (rand() < 0.5 ? 10 * MIN : 14 * 60 * MIN))
  } else {
    // The clock or time zone changed: a forward or backward jump, sometimes across a day.
    input = { kind: 'clockChanged' }
    next = now + Math.floor((rand() - 0.4) * (rand() < 0.2 ? 2 * DAY : 2 * 60 * MIN))
  }
  return { input, now: next, localDate: localDateOf(next) }
}

/** Throws with a reason when a step breaks an invariant. */
function checkStep(prev: TimerState, step: Step, r: TransitionResult): void {
  const fail = (reason: string): never => {
    throw new Error(reason)
  }
  const next = r.state
  const { input, now, localDate } = step
  const newDay = prev.status !== 'running' && localDate > prev.cycleDate
  const overdue = prev.status === 'running' && prev.endsAt !== null && prev.endsAt <= now

  // One phase at a time, with exactly the fields of its status.
  if ((next.endsAt !== null) !== (next.status === 'running')) fail('endsAt does not match status')
  if ((next.remainingMs !== null) !== (next.status === 'paused')) fail('remainingMs mismatch')
  if (next.sleptAt !== null && next.status !== 'running') fail('sleptAt outside a running phase')
  if (next.durationMs !== phaseDurationMs(next.phase, config)) fail('duration does not match phase')
  if (next.completedInCycle < 0 || next.completedInCycle > config.focusSessionsPerCycle) {
    fail('completedInCycle out of range')
  }
  if (next.revision < prev.revision) fail('revision went back')

  // Snapshot invariants (public-api.md §1).
  const snap = toSnapshot(next, now, config)
  if (snap.remainingMs < 0 || snap.remainingMs > snap.durationMs) fail('remainingMs out of range')
  if (snap.focusNumber !== (snap.phase === 'focus' ? snap.completedInCycle + 1 : null)) {
    fail('focusNumber mismatch')
  }
  expect(snap.controls).toEqual(allowedControls(next.phase, next.status))

  // The cycle advances only by one completed focus session: a focus phase that ran out awake.
  const counted = next.completedInCycle > prev.completedInCycle
  const notice = next.notice
  const countedEnd =
    // A new-day reset keeps the same notice object; a phase end always makes a new one.
    notice !== prev.notice &&
    notice?.kind === 'phaseEnded' &&
    notice.endedPhase === 'focus' &&
    notice.counted
  if (counted && next.completedInCycle !== prev.completedInCycle + 1) fail('counted twice')
  if (counted && !countedEnd) fail('cycle advanced without a completed focus session')
  if (countedEnd) {
    const ranOut =
      prev.phase === 'focus' &&
      prev.status === 'running' &&
      prev.endsAt !== null &&
      prev.endsAt <= now &&
      (prev.sleptAt === null || prev.endsAt <= prev.sleptAt)
    if (!ranOut) fail('counted a focus session that did not run out while awake')
  }

  // The cycle drops only to 0, and only by the glossary's reset list.
  if (next.completedInCycle < prev.completedInCycle) {
    const restart =
      input.kind === 'command' &&
      input.command.type === 'restartCycle' &&
      r.outcome.kind === 'applied'
    const longBreakOver = prev.phase === 'longBreak' && next.phase === 'focus'
    const crossedDay = localDate > prev.cycleDate
    if (next.completedInCycle !== 0) fail('cycle dropped to a non-zero count')
    if (!restart && !longBreakOver && !newDay && !crossedDay) fail('cycle reset outside the list')
  }

  // Commands: ignored and needsConfirmation never change state, except the new-day rule and the
  // settling of a phase that was already due.
  if (
    input.kind === 'command' &&
    r.outcome.kind !== 'applied' &&
    !newDay &&
    !overdue &&
    next !== prev
  ) {
    fail(`${r.outcome.kind} changed the state`)
  }
  // A command never acts on a phase that has already ended: the phase end comes first.
  if (input.kind === 'command' && overdue) {
    if (next.revision <= prev.revision || next.notice === null) {
      fail('a command skipped the end of a phase that was already due')
    }
    if (r.effects.filter((e) => e.kind === 'notify').length !== 1) {
      fail('a settled phase end did not notify')
    }
  }
  if (r.outcome.kind === 'needsConfirmation') {
    const cmd = input.kind === 'command' ? input.command : null
    if (cmd?.type !== 'restartCycle' || cmd.confirmed)
      fail('confirmation asked for the wrong input')
    if (isRestartLossEmpty(r.outcome.loss)) fail('confirmation asked with nothing to lose')
    expect(r.outcome.loss).toEqual(restartLoss(next))
  }
  if (input.kind === 'command' && r.outcome.kind === 'applied') {
    if (input.command.revision !== prev.revision && !newDay) fail('applied a stale command')
  }

  // At most one notification and one Dock bounce per transition.
  if (r.effects.filter((e) => e.kind === 'notify').length > 1) fail('two notifications')
  if (r.effects.filter((e) => e.kind === 'bounceDock').length > 1) fail('two Dock bounces')
}

function runSequence(seed: number): void {
  const rand = prng(seed)
  let now = START + Math.floor(rand() * DAY)
  let s = createInitialState(localDateOf(now), config)
  const seen = [s.revision]
  const steps: Step[] = []
  // A command reached a session whose end had already passed while the Mac slept (AC-14).
  let endedAsleep = false

  for (let i = 0; i < STEPS; i++) {
    const step = generateStep(rand, s, now, seen)
    steps.push(step)
    const r = transition(s, step.input, step.now, step.localDate, config)
    try {
      checkStep(s, step, r)
      endedAsleep ||=
        step.input.kind === 'command' &&
        s.phase === 'focus' &&
        s.sleptAt !== null &&
        s.endsAt !== null &&
        s.endsAt > s.sleptAt &&
        s.endsAt <= step.now
      if (endedAsleep && r.state.completedInCycle > s.completedInCycle) {
        throw new Error('counted a focus session that ended while the Mac was asleep')
      }
      if (r.state.status === 'ready') endedAsleep = false
    } catch (error) {
      const replay = steps.map((st) => JSON.stringify(st)).join('\n  ')
      throw new Error(
        `seed ${seed} step ${i}: ${(error as Error).message}\n  ${replay}\nstate before: ${JSON.stringify(s)}\nstate after: ${JSON.stringify(r.state)}`,
        { cause: error }
      )
    }
    s = r.state
    now = step.now
    seen.push(s.revision)
  }
}

describe('timer rules — command safety property', () => {
  it(`holds the invariants across ${SEQUENCES.toLocaleString('en')} random sequences (seed ${SEED})`, () => {
    const rand = prng(SEED)
    for (let i = 0; i < SEQUENCES; i++) {
      runSequence(Math.floor(rand() * 2 ** 32))
    }
  })
})
