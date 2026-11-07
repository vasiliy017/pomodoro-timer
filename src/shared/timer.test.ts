import { describe, expect, it } from 'vitest'
import {
  allowedControls,
  createInitialState,
  DEFAULT_TIMER_CONFIG,
  isTimerCommand,
  lossMessage,
  restartLoss,
  toSnapshot,
  transition,
  type Controls,
  type PhaseKind,
  type PhaseStatus,
  type RestartLoss,
  type TimerCommand,
  type TimerInput,
  type TimerState
} from './timer'

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 31, 9, 0, 0)
const TODAY = '2026-10-31'

function state(overrides: Partial<TimerState> = {}): TimerState {
  return { ...createInitialState(TODAY, DEFAULT_TIMER_CONFIG), ...overrides }
}

function command(s: TimerState, cmd: TimerCommand, now = T0, localDate = TODAY) {
  return transition(s, { kind: 'command', command: cmd }, now, localDate, DEFAULT_TIMER_CONFIG)
}

function deadline(s: TimerState, now: number, localDate = TODAY) {
  return transition(s, { kind: 'deadline' }, now, localDate, DEFAULT_TIMER_CONFIG)
}

function send(s: TimerState, input: TimerInput, now: number, localDate = TODAY) {
  return transition(s, input, now, localDate, DEFAULT_TIMER_CONFIG)
}

/** A running focus session with `leftMs` to go at T0. */
function runningFocus(leftMs: number, overrides: Partial<TimerState> = {}): TimerState {
  return state({ status: 'running', endsAt: T0 + leftMs, revision: 5, ...overrides })
}

describe('DEFAULT_TIMER_CONFIG', () => {
  it('is 25 / 5 / 15 with a long break after 4 focus sessions', () => {
    expect(DEFAULT_TIMER_CONFIG).toEqual({
      focusMs: 25 * MIN,
      shortBreakMs: 5 * MIN,
      longBreakMs: 15 * MIN,
      focusSessionsPerCycle: 4
    })
  })
})

describe('createInitialState', () => {
  it('is a ready focus session at 25:00, cycle 0, revision 0, no notice', () => {
    const s = createInitialState(TODAY, DEFAULT_TIMER_CONFIG)
    expect(s).toMatchObject({
      revision: 0,
      phase: 'focus',
      status: 'ready',
      completedInCycle: 0,
      cycleDate: TODAY,
      durationMs: 25 * MIN,
      endsAt: null,
      sleptAt: null,
      notice: null
    })
  })
})

describe('allowedControls — AC-02b table', () => {
  const none: Controls = {
    start: false,
    pause: false,
    reset: false,
    skip: false,
    restartCycle: false
  }
  const rows: [PhaseKind, PhaseStatus, Partial<Controls>][] = [
    ['focus', 'ready', { start: true, restartCycle: true }],
    ['shortBreak', 'ready', { start: true, skip: true, restartCycle: true }],
    ['longBreak', 'ready', { start: true, skip: true, restartCycle: true }],
    ['focus', 'running', { pause: true, reset: true, skip: true, restartCycle: true }],
    ['shortBreak', 'running', { pause: true, reset: true, skip: true, restartCycle: true }],
    ['longBreak', 'running', { pause: true, reset: true, skip: true, restartCycle: true }],
    ['focus', 'paused', { start: true, reset: true, skip: true, restartCycle: true }],
    ['shortBreak', 'paused', { start: true, reset: true, skip: true, restartCycle: true }],
    ['longBreak', 'paused', { start: true, reset: true, skip: true, restartCycle: true }]
  ]

  it.each(rows)('%s %s offers exactly its row', (phase, status, offered) => {
    expect(allowedControls(phase, status)).toEqual({ ...none, ...offered })
  })
})

describe('restartLoss', () => {
  it('is empty on a ready phase with 0 completed', () => {
    expect(restartLoss(state())).toEqual({ completedInCycle: 0, phaseInProgress: null })
  })

  it('names the completed sessions and no phase when the phase is ready', () => {
    expect(restartLoss(state({ completedInCycle: 3 }))).toEqual({
      completedInCycle: 3,
      phaseInProgress: null
    })
  })

  it('names the running phase', () => {
    const s = state({ completedInCycle: 3, status: 'running', endsAt: T0 + 10 * MIN })
    expect(restartLoss(s)).toEqual({ completedInCycle: 3, phaseInProgress: 'focus' })
  })

  it('names the paused phase', () => {
    const s = state({
      phase: 'shortBreak',
      durationMs: 5 * MIN,
      completedInCycle: 1,
      status: 'paused',
      remainingMs: 2 * MIN
    })
    expect(restartLoss(s)).toEqual({ completedInCycle: 1, phaseInProgress: 'shortBreak' })
  })
})

describe('toSnapshot', () => {
  it('shows focus session 1 of 4 ready at 25:00 on launch (AC-01)', () => {
    const snap = toSnapshot(state(), T0, DEFAULT_TIMER_CONFIG)
    expect(snap).toEqual({
      revision: 0,
      phase: 'focus',
      status: 'ready',
      durationMs: 25 * MIN,
      remainingMs: 25 * MIN,
      endsAt: null,
      completedInCycle: 0,
      focusNumber: 1,
      focusSessionsPerCycle: 4,
      notice: null,
      controls: allowedControls('focus', 'ready')
    })
  })

  it('numbers a focus session as completed + 1 (AC-01)', () => {
    const snap = toSnapshot(state({ completedInCycle: 2 }), T0, DEFAULT_TIMER_CONFIG)
    expect(snap.focusNumber).toBe(3)
    expect(snap.controls.skip).toBe(false)
  })

  it('has no focus number on a break (AC-01)', () => {
    const s = state({ phase: 'longBreak', durationMs: 15 * MIN, completedInCycle: 4 })
    const snap = toSnapshot(s, T0, DEFAULT_TIMER_CONFIG)
    expect(snap.focusNumber).toBeNull()
    expect(snap.completedInCycle).toBe(4)
    expect(snap.controls.skip).toBe(true)
  })

  it('computes the running remaining time from endsAt', () => {
    const s = state({ status: 'running', endsAt: T0 + 12 * MIN })
    const snap = toSnapshot(s, T0, DEFAULT_TIMER_CONFIG)
    expect(snap.remainingMs).toBe(12 * MIN)
    expect(snap.endsAt).toBe(T0 + 12 * MIN)
  })

  it('clamps the remaining time at 0 once endsAt has passed', () => {
    const s = state({ status: 'running', endsAt: T0 })
    expect(toSnapshot(s, T0 + 3_000, DEFAULT_TIMER_CONFIG).remainingMs).toBe(0)
  })

  it('never shows more than the full length when the clock moved back', () => {
    const s = state({ status: 'running', endsAt: T0 + 25 * MIN })
    expect(toSnapshot(s, T0 - 60 * MIN, DEFAULT_TIMER_CONFIG).remainingMs).toBe(25 * MIN)
  })

  it('shows the frozen value while paused, with no endsAt', () => {
    const s = state({ status: 'paused', remainingMs: 12 * MIN + 34_000 })
    const snap = toSnapshot(s, T0 + 3 * 60 * MIN, DEFAULT_TIMER_CONFIG)
    expect(snap.remainingMs).toBe(12 * MIN + 34_000)
    expect(snap.endsAt).toBeNull()
  })
})

describe('lossMessage', () => {
  it.each<[RestartLoss, string]>([
    [
      { completedInCycle: 3, phaseInProgress: 'focus' },
      '3 completed focus sessions will no longer count toward the long break, and the focus session in progress will end uncounted.'
    ],
    [
      { completedInCycle: 1, phaseInProgress: null },
      '1 completed focus session will no longer count toward the long break.'
    ],
    [
      { completedInCycle: 0, phaseInProgress: 'shortBreak' },
      'The short break in progress will end.'
    ],
    [
      { completedInCycle: 0, phaseInProgress: 'focus' },
      'The focus session in progress will end uncounted.'
    ],
    [
      { completedInCycle: 4, phaseInProgress: 'longBreak' },
      '4 completed focus sessions will no longer count toward the long break, and the long break in progress will end.'
    ]
  ])('%j', (value, message) => {
    expect(lossMessage(value)).toBe(message)
  })
})

describe('isTimerCommand', () => {
  it.each([
    { type: 'start', revision: 0 },
    { type: 'pause', revision: 3 },
    { type: 'reset', revision: 3 },
    { type: 'skip', revision: 3 },
    { type: 'restartCycle', revision: 3, confirmed: false },
    { type: 'restartCycle', revision: 3, confirmed: true }
  ])('accepts %j', (value) => {
    expect(isTimerCommand(value)).toBe(true)
  })

  it.each([
    null,
    undefined,
    'start',
    42,
    {},
    { type: 'set' },
    { type: 'set', revision: 1 },
    { type: 'start' },
    { type: 'start', revision: -1 },
    { type: 'start', revision: 1.5 },
    { type: 'start', revision: '1' },
    { type: 'restartCycle', revision: 3 },
    { type: 'restartCycle', revision: 3, confirmed: 'yes' },
    { type: 'start', revision: 0, endsAt: 1 },
    { type: 'pause', revision: 0, phase: 'focus' },
    { type: 'skip', revision: 0, confirmed: true },
    { type: 'restartCycle', revision: 0, confirmed: true, completedInCycle: 0 }
  ])('rejects %j', (value) => {
    expect(isTimerCommand(value)).toBe(false)
  })
})

describe('transition — commands', () => {
  describe('AC-01 start', () => {
    it('starts a ready focus session counting down from 25:00', () => {
      const r = command(state(), { type: 'start', revision: 0 })
      expect(r.outcome).toEqual({ kind: 'applied' })
      expect(r.effects).toEqual([])
      expect(r.state).toMatchObject({
        status: 'running',
        phase: 'focus',
        endsAt: T0 + 25 * MIN,
        revision: 1
      })
      expect(toSnapshot(r.state, T0, DEFAULT_TIMER_CONFIG).remainingMs).toBe(25 * MIN)
    })

    it('starts a ready short break at 5:00', () => {
      const s = state({ phase: 'shortBreak', durationMs: 5 * MIN, completedInCycle: 1 })
      const r = command(s, { type: 'start', revision: 0 })
      expect(r.state).toMatchObject({ status: 'running', endsAt: T0 + 5 * MIN })
    })
  })

  describe('AC-02 repeated and inapplicable commands', () => {
    it('ignores a second Start while the focus session runs (double-click)', () => {
      const first = command(state(), { type: 'start', revision: 0 })
      const second = command(first.state, { type: 'start', revision: 0 }, T0 + 200)
      expect(second.outcome).toEqual({ kind: 'ignored', reason: 'staleRevision' })
      expect(second.state).toBe(first.state)
    })

    it('ignores Start at the current revision while running: it is not offered', () => {
      const s = runningFocus(10 * MIN)
      const r = command(s, { type: 'start', revision: 5 })
      expect(r.outcome).toEqual({ kind: 'ignored', reason: 'notAllowed' })
      expect(r.state).toBe(s)
    })

    it('ignores Pause on a ready phase without a revision bump', () => {
      const s = state()
      const r = command(s, { type: 'pause', revision: 0 })
      expect(r.outcome).toEqual({ kind: 'ignored', reason: 'notAllowed' })
      expect(r.state).toBe(s)
      expect(r.state.revision).toBe(0)
    })

    it('ignores Skip on a ready focus session', () => {
      const r = command(state({ completedInCycle: 2 }), { type: 'skip', revision: 0 })
      expect(r.outcome).toEqual({ kind: 'ignored', reason: 'notAllowed' })
    })

    it('a second Skip at the same revision does not also skip the break now ready', () => {
      const s = runningFocus(10 * MIN, { completedInCycle: 2 })
      const first = command(s, { type: 'skip', revision: 5 })
      expect(first.state).toMatchObject({ phase: 'shortBreak', status: 'ready', revision: 6 })
      const second = command(first.state, { type: 'skip', revision: 5 }, T0 + 300)
      expect(second.outcome).toEqual({ kind: 'ignored', reason: 'staleRevision' })
      expect(second.state).toBe(first.state)
      expect(second.state.phase).toBe('shortBreak')
    })

    it.each(['pause', 'reset', 'skip'] as const)('a repeated %s has the effect of one', (type) => {
      const s = runningFocus(10 * MIN)
      const first = command(s, { type, revision: 5 })
      const second = command(first.state, { type, revision: 5 })
      expect(second.outcome).toEqual({ kind: 'ignored', reason: 'staleRevision' })
      expect(second.state).toBe(first.state)
    })
  })

  describe('AC-02b every command outside the table is ignored', () => {
    const all: TimerCommand['type'][] = ['start', 'pause', 'reset', 'skip', 'restartCycle']
    const cells: [PhaseKind, PhaseStatus][] = [
      ['focus', 'ready'],
      ['shortBreak', 'ready'],
      ['longBreak', 'ready'],
      ['focus', 'running'],
      ['shortBreak', 'running'],
      ['longBreak', 'running'],
      ['focus', 'paused'],
      ['shortBreak', 'paused'],
      ['longBreak', 'paused']
    ]

    it.each(cells)('%s %s', (phase, status) => {
      const s = state({
        phase,
        status,
        durationMs: 5 * MIN,
        endsAt: status === 'running' ? T0 + MIN : null,
        remainingMs: status === 'paused' ? MIN : null,
        completedInCycle: phase === 'longBreak' ? 4 : 1,
        revision: 9
      })
      const offered = allowedControls(phase, status)
      for (const type of all) {
        const cmd: TimerCommand =
          type === 'restartCycle' ? { type, revision: 9, confirmed: true } : { type, revision: 9 }
        const r = command(s, cmd)
        if (offered[type]) {
          expect(r.outcome.kind, `${type} should apply`).toBe('applied')
          expect(r.state.revision).toBe(10)
        } else {
          expect(r.outcome, `${type} should be ignored`).toEqual({
            kind: 'ignored',
            reason: 'notAllowed'
          })
          expect(r.state).toBe(s)
        }
      }
    })

    it('skipping a ready short break makes the next focus session ready', () => {
      const s = state({ phase: 'shortBreak', durationMs: 5 * MIN, completedInCycle: 2 })
      const r = command(s, { type: 'skip', revision: 0 })
      expect(r.state).toMatchObject({
        phase: 'focus',
        status: 'ready',
        durationMs: 25 * MIN,
        completedInCycle: 2
      })
    })
  })

  describe('AC-04 pause and resume', () => {
    const left = 12 * MIN + 34_000

    it('freezes 12:34 while paused and shows the phase as paused', () => {
      const r = command(runningFocus(left), { type: 'pause', revision: 5 })
      expect(r.outcome).toEqual({ kind: 'applied' })
      expect(r.state).toMatchObject({ status: 'paused', endsAt: null, revision: 6 })
      const later = toSnapshot(r.state, T0 + 10 * MIN, DEFAULT_TIMER_CONFIG)
      expect(later).toMatchObject({ status: 'paused', remainingMs: left })
    })

    it('resumes from 12:34 after 3 hours paused, not less', () => {
      const paused = command(runningFocus(left), { type: 'pause', revision: 5 }).state
      const resumeAt = T0 + 3 * 60 * MIN
      const r = command(paused, { type: 'start', revision: 6 }, resumeAt)
      expect(r.state).toMatchObject({ status: 'running', endsAt: resumeAt + left, revision: 7 })
      expect(toSnapshot(r.state, resumeAt, DEFAULT_TIMER_CONFIG).remainingMs).toBe(left)
    })

    it('pauses a running break too', () => {
      const s = state({
        phase: 'shortBreak',
        durationMs: 5 * MIN,
        status: 'running',
        endsAt: T0 + 2 * MIN,
        revision: 3
      })
      const r = command(s, { type: 'pause', revision: 3 })
      expect(r.state).toMatchObject({ phase: 'shortBreak', status: 'paused', remainingMs: 2 * MIN })
    })
  })

  describe('AC-10 reset', () => {
    it.each<PhaseStatus>(['running', 'paused'])(
      'a %s focus session with 12:34 left becomes ready at 25:00, cycle unchanged',
      (status) => {
        const s = state({
          status,
          completedInCycle: 1,
          endsAt: status === 'running' ? T0 + 12 * MIN + 34_000 : null,
          remainingMs: status === 'paused' ? 12 * MIN + 34_000 : null,
          revision: 4
        })
        const r = command(s, { type: 'reset', revision: 4 })
        expect(r.outcome).toEqual({ kind: 'applied' })
        expect(r.effects).toEqual([])
        expect(r.state).toMatchObject({
          phase: 'focus',
          status: 'ready',
          durationMs: 25 * MIN,
          endsAt: null,
          remainingMs: null,
          completedInCycle: 1,
          revision: 5
        })
      }
    )

    it('resets a running long break to 15:00', () => {
      const s = state({
        phase: 'longBreak',
        durationMs: 15 * MIN,
        completedInCycle: 4,
        status: 'running',
        endsAt: T0 + MIN
      })
      const r = command(s, { type: 'reset', revision: 0 })
      expect(r.state).toMatchObject({ phase: 'longBreak', status: 'ready', durationMs: 15 * MIN })
    })
  })

  describe('AC-11 skip', () => {
    it('skipping focus 3 of 4 with 10:00 left leaves 2 completed and a short break ready', () => {
      const s = runningFocus(10 * MIN, { completedInCycle: 2 })
      const r = command(s, { type: 'skip', revision: 5 })
      expect(r.outcome).toEqual({ kind: 'applied' })
      expect(r.effects).toEqual([])
      expect(r.state).toMatchObject({
        phase: 'shortBreak',
        status: 'ready',
        durationMs: 5 * MIN,
        completedInCycle: 2,
        endsAt: null
      })
      expect(toSnapshot(r.state, T0, DEFAULT_TIMER_CONFIG).completedInCycle).toBe(2)
    })

    it('skipping a paused focus session with 3 completed gives a short break, not a long one', () => {
      const s = state({ status: 'paused', remainingMs: MIN, completedInCycle: 3 })
      const r = command(s, { type: 'skip', revision: 0 })
      expect(r.state).toMatchObject({ phase: 'shortBreak', completedInCycle: 3 })
    })

    it('skipping a running short break makes the next focus session ready, cycle unchanged', () => {
      const s = state({
        phase: 'shortBreak',
        durationMs: 5 * MIN,
        status: 'running',
        endsAt: T0 + MIN,
        completedInCycle: 2
      })
      const r = command(s, { type: 'skip', revision: 0 })
      expect(r.state).toMatchObject({ phase: 'focus', status: 'ready', completedInCycle: 2 })
    })

    it.each<PhaseStatus>(['ready', 'paused', 'running'])(
      'skipping a %s long break with 4 completed sends the cycle back to 0',
      (status) => {
        const s = state({
          phase: 'longBreak',
          durationMs: 15 * MIN,
          completedInCycle: 4,
          status,
          endsAt: status === 'running' ? T0 + MIN : null,
          remainingMs: status === 'paused' ? MIN : null
        })
        const r = command(s, { type: 'skip', revision: 0 })
        expect(r.state).toMatchObject({
          phase: 'focus',
          status: 'ready',
          durationMs: 25 * MIN,
          completedInCycle: 0
        })
        expect(toSnapshot(r.state, T0, DEFAULT_TIMER_CONFIG).focusNumber).toBe(1)
      }
    )

    it('clears a phase-end notice', () => {
      const s = state({
        phase: 'shortBreak',
        durationMs: 5 * MIN,
        completedInCycle: 1,
        notice: { kind: 'phaseEnded', endedPhase: 'focus', counted: true }
      })
      const r = command(s, { type: 'skip', revision: 0 })
      expect(r.state.notice).toBeNull()
    })
  })

  describe('AC-12 restart cycle', () => {
    it('asks for confirmation with 3 completed, naming what is lost, state unchanged', () => {
      const s = state({ completedInCycle: 3, revision: 7 })
      const r = command(s, { type: 'restartCycle', revision: 7, confirmed: false })
      expect(r.outcome).toEqual({
        kind: 'needsConfirmation',
        loss: { completedInCycle: 3, phaseInProgress: null }
      })
      expect(r.state).toBe(s)
    })

    it('names the phase in progress too', () => {
      const s = runningFocus(10 * MIN, { completedInCycle: 3, revision: 7 })
      const r = command(s, { type: 'restartCycle', revision: 7, confirmed: false })
      expect(r.outcome).toEqual({
        kind: 'needsConfirmation',
        loss: { completedInCycle: 3, phaseInProgress: 'focus' }
      })
    })

    it('asks when only a running phase would be lost (cycle at 0)', () => {
      const s = runningFocus(10 * MIN, { revision: 7 })
      const r = command(s, { type: 'restartCycle', revision: 7, confirmed: false })
      expect(r.outcome.kind).toBe('needsConfirmation')
    })

    it('on confirm ends the running phase uncounted: cycle 0, focus 1 of 4 ready at 25:00', () => {
      const s = runningFocus(10 * MIN, { completedInCycle: 3, revision: 7 })
      const r = command(s, { type: 'restartCycle', revision: 7, confirmed: true })
      expect(r.outcome).toEqual({ kind: 'applied' })
      expect(r.effects).toEqual([])
      expect(r.state).toMatchObject({
        phase: 'focus',
        status: 'ready',
        durationMs: 25 * MIN,
        completedInCycle: 0,
        endsAt: null,
        revision: 8
      })
      expect(toSnapshot(r.state, T0, DEFAULT_TIMER_CONFIG).focusNumber).toBe(1)
    })

    it('ignores a confirmation at a stale revision: nothing lost', () => {
      const s = state({ completedInCycle: 3, revision: 8 })
      const r = command(s, { type: 'restartCycle', revision: 7, confirmed: true })
      expect(r.outcome).toEqual({ kind: 'ignored', reason: 'staleRevision' })
      expect(r.state).toBe(s)
    })

    it('acts at once when the cycle is at 0 and the phase is ready', () => {
      const r = command(state(), { type: 'restartCycle', revision: 0, confirmed: false })
      expect(r.outcome).toEqual({ kind: 'applied' })
      expect(r.state).toMatchObject({ phase: 'focus', status: 'ready', revision: 1 })
    })
  })

  it('every applied command increments the revision and clears the notice', () => {
    const notice = { kind: 'phaseEnded', endedPhase: 'focus', counted: true } as const
    const s = state({ phase: 'shortBreak', durationMs: 5 * MIN, completedInCycle: 1, notice })
    const r = command(s, { type: 'start', revision: 0 })
    expect(r.state.revision).toBe(1)
    expect(r.state.notice).toBeNull()
  })
})

describe('transition — deadline (phase end)', () => {
  const bounce = { kind: 'bounceDock' }

  describe('AC-07 focus end counts; the next phase waits ready', () => {
    it('focus 2 of 4 ends: 2 completed, short break ready at 5:00, not running', () => {
      const s = runningFocus(10 * MIN, { completedInCycle: 1 })
      const r = deadline(s, T0 + 10 * MIN)
      expect(r.outcome).toEqual({ kind: 'applied' })
      expect(r.state).toMatchObject({
        phase: 'shortBreak',
        status: 'ready',
        durationMs: 5 * MIN,
        completedInCycle: 2,
        endsAt: null,
        revision: 6
      })
    })

    it('a short break ends: focus ready at 25:00, cycle unchanged', () => {
      const s = state({
        phase: 'shortBreak',
        durationMs: 5 * MIN,
        status: 'running',
        endsAt: T0,
        completedInCycle: 2
      })
      const r = deadline(s, T0)
      expect(r.state).toMatchObject({
        phase: 'focus',
        status: 'ready',
        durationMs: 25 * MIN,
        completedInCycle: 2
      })
      expect(r.state.notice).toEqual({
        kind: 'phaseEnded',
        endedPhase: 'shortBreak',
        counted: false
      })
    })
  })

  describe('AC-05 / AC-06 signals: one notification, one Dock bounce, a notice', () => {
    it('focus end emits notify (with the ready phase) then bounceDock, in that order', () => {
      const s = runningFocus(0, { completedInCycle: 1 })
      const r = deadline(s, T0)
      const notice = { kind: 'phaseEnded', endedPhase: 'focus', counted: true }
      expect(r.state.notice).toEqual(notice)
      expect(r.effects).toEqual([
        { kind: 'notify', notice, next: { phase: 'shortBreak', focusNumber: null } },
        bounce
      ])
    })

    it('break end tells which focus session is ready', () => {
      const s = state({
        phase: 'shortBreak',
        durationMs: 5 * MIN,
        status: 'running',
        endsAt: T0,
        completedInCycle: 2
      })
      expect(deadline(s, T0).effects[0]).toEqual({
        kind: 'notify',
        notice: { kind: 'phaseEnded', endedPhase: 'shortBreak', counted: false },
        next: { phase: 'focus', focusNumber: 3 }
      })
    })

    it('a second deadline for the same end is a no-op: exactly one notify and one bounce', () => {
      const first = deadline(runningFocus(0), T0)
      const second = deadline(first.state, T0 + 5)
      expect(second.state).toBe(first.state)
      expect(second.effects).toEqual([])
      const all = [...first.effects, ...second.effects]
      expect(all.filter((e) => e.kind === 'notify')).toHaveLength(1)
      expect(all.filter((e) => e.kind === 'bounceDock')).toHaveLength(1)
    })

    it('a new phase end replaces the old notice', () => {
      const s = state({
        phase: 'shortBreak',
        durationMs: 5 * MIN,
        status: 'running',
        endsAt: T0,
        completedInCycle: 1,
        notice: { kind: 'phaseEnded', endedPhase: 'focus', counted: true }
      })
      expect(deadline(s, T0).state.notice).toEqual({
        kind: 'phaseEnded',
        endedPhase: 'shortBreak',
        counted: false
      })
    })

    it('the next command clears the notice', () => {
      const ended = deadline(runningFocus(0), T0).state
      const r = command(ended, { type: 'start', revision: ended.revision }, T0 + MIN)
      expect(r.state.notice).toBeNull()
    })
  })

  describe('timing', () => {
    it('an early deadline (now < endsAt) is a no-op without a revision bump', () => {
      const s = runningFocus(MIN)
      const r = deadline(s, T0 + MIN - 1)
      expect(r.state).toBe(s)
      expect(r.effects).toEqual([])
    })

    it('a late deadline (endsAt + 3 s, Mac awake) settles as usual and counts', () => {
      const r = deadline(runningFocus(0, { completedInCycle: 0 }), T0 + 3_000)
      expect(r.state.completedInCycle).toBe(1)
      expect(r.effects).toHaveLength(2)
    })

    it('a paused phase never expires on its own', () => {
      const s = state({ status: 'paused', remainingMs: MIN })
      const r = deadline(s, T0 + 3 * 60 * MIN)
      expect(r.state).toBe(s)
      expect(r.effects).toEqual([])
    })
  })

  describe('AC-08 a ready phase never starts by itself', () => {
    it.each([10 * MIN, 3 * 60 * MIN])('ready short break untouched after %i ms', (wait) => {
      const ready = deadline(runningFocus(0), T0).state
      const r = deadline(ready, T0 + wait)
      expect(r.state).toBe(ready)
      expect(r.effects).toEqual([])
      expect(toSnapshot(r.state, T0 + wait, DEFAULT_TIMER_CONFIG)).toMatchObject({
        phase: 'shortBreak',
        status: 'ready',
        remainingMs: 5 * MIN
      })
    })
  })

  describe('AC-09 long break', () => {
    it('focus 4 of 4 ends: 4 completed, long break ready at 15:00', () => {
      const r = deadline(runningFocus(0, { completedInCycle: 3 }), T0)
      expect(r.state).toMatchObject({
        phase: 'longBreak',
        status: 'ready',
        durationMs: 15 * MIN,
        completedInCycle: 4
      })
      expect(r.effects[0]).toMatchObject({ next: { phase: 'longBreak', focusNumber: null } })
    })

    it('the long break ends: cycle back to 0, focus 1 of 4 ready', () => {
      const s = state({
        phase: 'longBreak',
        durationMs: 15 * MIN,
        completedInCycle: 4,
        status: 'running',
        endsAt: T0
      })
      const r = deadline(s, T0)
      expect(r.state).toMatchObject({ phase: 'focus', status: 'ready', completedInCycle: 0 })
      expect(r.effects[0]).toEqual({
        kind: 'notify',
        notice: { kind: 'phaseEnded', endedPhase: 'longBreak', counted: false },
        next: { phase: 'focus', focusNumber: 1 }
      })
    })
  })
})

describe('transition — sleep and wake (AC-14)', () => {
  const HOUR = 60 * MIN
  const sleep = { kind: 'sleep' } as const
  const wake = { kind: 'wake' } as const

  function asleep(s: TimerState, at = T0) {
    return send(s, sleep, at).state
  }

  it('sleep records sleptAt on a running phase, nothing visible changes', () => {
    const s = runningFocus(15 * MIN, { completedInCycle: 1 })
    const r = send(s, sleep, T0)
    expect(r.state).toMatchObject({ status: 'running', sleptAt: T0, revision: 5 })
    expect(r.effects).toEqual([])
  })

  it('focus with 15:00 left, asleep 2 h: ended while asleep, not counted, short break ready, one notify', () => {
    const s = asleep(runningFocus(15 * MIN, { completedInCycle: 1 }))
    const r = send(s, wake, T0 + 2 * HOUR)
    const notice = { kind: 'endedWhileAsleep', endedPhase: 'focus', counted: false }
    expect(r.state).toMatchObject({
      phase: 'shortBreak',
      status: 'ready',
      completedInCycle: 1,
      sleptAt: null,
      notice
    })
    expect(r.effects).toEqual([
      { kind: 'notify', notice, next: { phase: 'shortBreak', focusNumber: null } },
      { kind: 'bounceDock' }
    ])
  })

  it('asleep 5 min with 15:00 left: still running with 10:00 left, no effects', () => {
    const s = asleep(runningFocus(15 * MIN))
    const r = send(s, wake, T0 + 5 * MIN)
    expect(r.state).toMatchObject({ status: 'running', phase: 'focus', sleptAt: null })
    expect(r.effects).toEqual([])
    expect(toSnapshot(r.state, T0 + 5 * MIN, DEFAULT_TIMER_CONFIG).remainingMs).toBe(10 * MIN)
  })

  it('a focus session whose end came before the sleep counts, even if noticed late', () => {
    const s = asleep(runningFocus(0, { completedInCycle: 1 }), T0 + 2_000)
    const r = send(s, wake, T0 + HOUR)
    expect(r.state).toMatchObject({ phase: 'shortBreak', completedInCycle: 2 })
    expect(r.state.notice).toEqual({ kind: 'phaseEnded', endedPhase: 'focus', counted: true })
  })

  it("a short break's end passed while asleep: focus ready at 25:00, cycle unchanged", () => {
    const s = asleep(
      state({
        phase: 'shortBreak',
        durationMs: 5 * MIN,
        status: 'running',
        endsAt: T0 + MIN,
        completedInCycle: 2
      })
    )
    const r = send(s, wake, T0 + HOUR)
    expect(r.state).toMatchObject({
      phase: 'focus',
      status: 'ready',
      durationMs: 25 * MIN,
      completedInCycle: 2
    })
    expect(r.state.notice).toEqual({
      kind: 'endedWhileAsleep',
      endedPhase: 'shortBreak',
      counted: false
    })
    expect(r.effects.filter((e) => e.kind === 'notify')).toHaveLength(1)
  })

  it("a long break's end passed while asleep: cycle 0, focus 1 of 4 ready", () => {
    const s = asleep(
      state({
        phase: 'longBreak',
        durationMs: 15 * MIN,
        status: 'running',
        endsAt: T0 + MIN,
        completedInCycle: 4
      })
    )
    const r = send(s, wake, T0 + HOUR)
    expect(r.state).toMatchObject({ phase: 'focus', status: 'ready', completedInCycle: 0 })
    expect(r.state.notice).toMatchObject({ kind: 'endedWhileAsleep', endedPhase: 'longBreak' })
  })

  it('a paused phase is untouched by sleep', () => {
    const s = state({ status: 'paused', remainingMs: 7 * MIN, revision: 2 })
    const slept = send(s, sleep, T0)
    expect(slept.state).toBe(s)
    const woke = send(slept.state, wake, T0 + 2 * HOUR)
    expect(woke.state).toBe(s)
    expect(woke.effects).toEqual([])
  })

  it('a deadline while asleep (Power Nap) is ignored', () => {
    const s = asleep(runningFocus(MIN))
    const r = send(s, { kind: 'deadline' }, T0 + 2 * MIN)
    expect(r.state).toBe(s)
    expect(r.effects).toEqual([])
  })

  it('wake without a prior sleep behaves as a deadline: no uncounted branch', () => {
    const r = send(runningFocus(MIN, { completedInCycle: 1 }), wake, T0 + HOUR)
    expect(r.state).toMatchObject({ phase: 'shortBreak', completedInCycle: 2 })
    expect(r.state.notice).toMatchObject({ kind: 'phaseEnded', counted: true })
  })

  it('focus running at 23:50, asleep until 08:00: uncounted notice, then a fresh cycle, one notify', () => {
    const s = asleep(runningFocus(15 * MIN, { completedInCycle: 2 }))
    const r = send(s, wake, T0 + 8 * HOUR, '2026-11-01')
    const notice = { kind: 'endedWhileAsleep', endedPhase: 'focus', counted: false }
    expect(r.state).toMatchObject({
      phase: 'focus',
      status: 'ready',
      durationMs: 25 * MIN,
      completedInCycle: 0,
      cycleDate: '2026-11-01',
      notice
    })
    expect(r.effects).toEqual([
      { kind: 'notify', notice, next: { phase: 'focus', focusNumber: 1 } },
      { kind: 'bounceDock' }
    ])
  })
})

describe('transition — a command on a phase that is already due (AC-05, AC-07, AC-14)', () => {
  const HOUR = 60 * MIN

  it('a Pause before the late wake settles the session as ended asleep: uncounted, one notify', () => {
    const s = runningFocus(15 * MIN, { completedInCycle: 1, sleptAt: T0 })
    const r = command(s, { type: 'pause', revision: 5 }, T0 + 2 * HOUR)
    const notice = { kind: 'endedWhileAsleep', endedPhase: 'focus', counted: false }
    expect(r.outcome).toEqual({ kind: 'ignored', reason: 'staleRevision' })
    expect(r.state).toMatchObject({
      phase: 'shortBreak',
      status: 'ready',
      completedInCycle: 1,
      revision: 6,
      notice
    })
    expect(r.effects).toEqual([
      { kind: 'notify', notice, next: { phase: 'shortBreak', focusNumber: null } },
      { kind: 'bounceDock' }
    ])
    // The real wake arrives afterwards and changes nothing.
    expect(send(r.state, { kind: 'wake' }, T0 + 2 * HOUR + 1).state).toBe(r.state)
  })

  it('a Skip a few ms past the end counts the session instead of dropping it', () => {
    const s = runningFocus(0, { completedInCycle: 1 })
    const r = command(s, { type: 'skip', revision: 5 }, T0 + 3)
    const notice = { kind: 'phaseEnded', endedPhase: 'focus', counted: true }
    expect(r.outcome).toEqual({ kind: 'ignored', reason: 'staleRevision' })
    expect(r.state).toMatchObject({ phase: 'shortBreak', completedInCycle: 2, notice })
    expect(r.effects).toEqual([
      { kind: 'notify', notice, next: { phase: 'shortBreak', focusNumber: null } },
      { kind: 'bounceDock' }
    ])
  })

  it('settles at exactly the end time', () => {
    const r = command(runningFocus(0), { type: 'pause', revision: 5 }, T0)
    expect(r.state).toMatchObject({ phase: 'shortBreak', status: 'ready', completedInCycle: 1 })
  })

  it('a confirmed Restart cycle aimed at the finished phase is ignored, the count stands', () => {
    const s = runningFocus(0, { completedInCycle: 1 })
    const r = command(s, { type: 'restartCycle', revision: 5, confirmed: true }, T0 + HOUR)
    expect(r.outcome).toEqual({ kind: 'ignored', reason: 'staleRevision' })
    expect(r.state).toMatchObject({ phase: 'shortBreak', completedInCycle: 2 })
  })

  it('a break already due ends into the next focus session', () => {
    const s = state({
      phase: 'shortBreak',
      durationMs: 5 * MIN,
      status: 'running',
      endsAt: T0,
      completedInCycle: 1,
      revision: 5
    })
    const r = command(s, { type: 'reset', revision: 5 }, T0 + 1)
    expect(r.state).toMatchObject({ phase: 'focus', status: 'ready', completedInCycle: 1 })
    expect(r.state.notice).toMatchObject({ kind: 'phaseEnded', endedPhase: 'shortBreak' })
  })

  it('a session due across midnight settles, then the fresh cycle starts', () => {
    const s = runningFocus(0, { completedInCycle: 2 })
    const r = command(s, { type: 'pause', revision: 5 }, T0 + 1, '2026-11-01')
    expect(r.state).toMatchObject({
      phase: 'focus',
      status: 'ready',
      completedInCycle: 0,
      cycleDate: '2026-11-01',
      notice: { kind: 'phaseEnded', endedPhase: 'focus', counted: true }
    })
  })

  it('a command with time still left applies as usual, even before a late wake', () => {
    const s = runningFocus(15 * MIN, { sleptAt: T0 })
    const r = command(s, { type: 'pause', revision: 5 }, T0 + 5 * MIN)
    expect(r.outcome).toEqual({ kind: 'applied' })
    expect(r.state).toMatchObject({ status: 'paused', remainingMs: 10 * MIN, sleptAt: null })
    expect(r.effects).toEqual([])
  })
})

describe('transition — new day (AC-15)', () => {
  const TOMORROW = '2026-11-01'

  it("yesterday's paused focus 4 of 4 (3 completed) becomes focus 1 of 4 ready, cycle 0, uncounted", () => {
    const s = state({ status: 'paused', remainingMs: 14 * MIN + 7_000, completedInCycle: 3 })
    const r = send(s, { kind: 'clockChanged' }, T0, TOMORROW)
    expect(r.outcome).toEqual({ kind: 'applied' })
    expect(r.state).toMatchObject({
      phase: 'focus',
      status: 'ready',
      durationMs: 25 * MIN,
      completedInCycle: 0,
      cycleDate: TOMORROW,
      remainingMs: null,
      notice: null,
      revision: 1
    })
    expect(r.effects).toEqual([])
  })

  it('the midnight deadline replaces a ready break with a fresh cycle, never starts it', () => {
    const s = state({ phase: 'shortBreak', durationMs: 5 * MIN, completedInCycle: 2 })
    const r = send(s, { kind: 'deadline' }, T0, TOMORROW)
    expect(r.state).toMatchObject({ phase: 'focus', status: 'ready', completedInCycle: 0 })
  })

  it('a waiting phase-end notice stays through the new-day reset, with no new signal (AC-06)', () => {
    const notice = { kind: 'phaseEnded', endedPhase: 'focus', counted: true } as const
    const s = state({ phase: 'shortBreak', durationMs: 5 * MIN, completedInCycle: 2, notice })
    const r = send(s, { kind: 'deadline' }, T0, TOMORROW)
    expect(r.state).toMatchObject({ phase: 'focus', completedInCycle: 0, notice })
    expect(r.effects).toEqual([])
  })

  it('a stale command that triggers the reset leaves the notice; the next command clears it', () => {
    const notice = { kind: 'endedWhileAsleep', endedPhase: 'focus', counted: false } as const
    const s = state({ phase: 'shortBreak', durationMs: 5 * MIN, revision: 4, notice })
    const r = command(s, { type: 'start', revision: 4 }, T0, TOMORROW)
    expect(r.outcome).toEqual({ kind: 'ignored', reason: 'staleRevision' })
    expect(r.state.notice).toEqual(notice)
    const next = command(r.state, { type: 'start', revision: r.state.revision }, T0, TOMORROW)
    expect(next.state.notice).toBeNull()
  })

  it("a Start at 00:02 carrying yesterday's revision never starts yesterday's ready break", () => {
    const s = state({ phase: 'shortBreak', durationMs: 5 * MIN, completedInCycle: 1, revision: 4 })
    const r = command(s, { type: 'start', revision: 4 }, T0, TOMORROW)
    expect(r.outcome).toEqual({ kind: 'ignored', reason: 'staleRevision' })
    expect(r.state).toMatchObject({
      phase: 'focus',
      status: 'ready',
      completedInCycle: 0,
      revision: 5
    })
  })

  it('a phase running across midnight is left alone', () => {
    const s = runningFocus(10 * MIN, { completedInCycle: 3 })
    const r = send(s, { kind: 'clockChanged' }, T0, TOMORROW)
    expect(r.state).toBe(s)
    const midnight = send(s, { kind: 'deadline' }, T0 + MIN, TOMORROW)
    expect(midnight.state).toBe(s)
  })

  it('focus 4 of 4 runs out at 00:10: counted, then a fresh cycle, no long break', () => {
    const s = runningFocus(10 * MIN, { completedInCycle: 3 })
    const r = send(s, { kind: 'deadline' }, T0 + 10 * MIN, TOMORROW)
    const notice = { kind: 'phaseEnded', endedPhase: 'focus', counted: true }
    expect(r.state).toMatchObject({
      phase: 'focus',
      status: 'ready',
      completedInCycle: 0,
      cycleDate: TOMORROW,
      notice
    })
    expect(r.effects).toEqual([
      { kind: 'notify', notice, next: { phase: 'focus', focusNumber: 1 } },
      { kind: 'bounceDock' }
    ])
  })

  it('a break running across midnight ends into the same fresh cycle', () => {
    const s = state({
      phase: 'shortBreak',
      durationMs: 5 * MIN,
      status: 'running',
      endsAt: T0,
      completedInCycle: 2
    })
    const r = send(s, { kind: 'deadline' }, T0, TOMORROW)
    expect(r.state).toMatchObject({ phase: 'focus', completedInCycle: 0, cycleDate: TOMORROW })
    expect(r.effects.filter((e) => e.kind === 'notify')).toHaveLength(1)
  })

  it('the clock moved back one hour on a running phase: remaining never exceeds the full length', () => {
    const s = runningFocus(25 * MIN)
    const r = send(s, { kind: 'clockChanged' }, T0 - 60 * MIN)
    expect(r.state).toBe(s)
    expect(toSnapshot(r.state, T0 - 60 * MIN, DEFAULT_TIMER_CONFIG).remainingMs).toBe(25 * MIN)
  })

  it('the clock moved back to yesterday after a fresh cycle: no new-day reset', () => {
    const s = state({ completedInCycle: 1, cycleDate: TOMORROW })
    const r = send(s, { kind: 'clockChanged' }, T0, TODAY)
    expect(r.state).toBe(s)
  })

  it('nothing changes when the local date has not changed', () => {
    const s = state({ phase: 'shortBreak', durationMs: 5 * MIN, completedInCycle: 1 })
    const r = send(s, { kind: 'clockChanged' }, T0)
    expect(r.state).toBe(s)
    expect(r.outcome).toEqual({ kind: 'ignored', reason: 'notAllowed' })
  })
})
