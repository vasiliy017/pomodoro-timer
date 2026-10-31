import { describe, expect, it } from 'vitest'
import {
  allowedControls,
  createInitialState,
  DEFAULT_TIMER_CONFIG,
  isTimerCommand,
  restartLoss,
  toSnapshot,
  type Controls,
  type PhaseKind,
  type PhaseStatus,
  type TimerState
} from './timer'

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 31, 9, 0, 0)
const TODAY = '2026-10-31'

function state(overrides: Partial<TimerState> = {}): TimerState {
  return { ...createInitialState(TODAY, DEFAULT_TIMER_CONFIG), ...overrides }
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
    { type: 'restartCycle', revision: 3, confirmed: 'yes' }
  ])('rejects %j', (value) => {
    expect(isTimerCommand(value)).toBe(false)
  })
})
