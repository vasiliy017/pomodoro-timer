import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Notice, TimerSnapshot } from '@shared/timer'
import type { Clock } from './clock'
import type { ReadyPhase } from './signals'
import { createTimerService } from './timer-service'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const T0 = Date.UTC(2026, 9, 31, 9, 0, 0) // 09:00 on 2026-10-31 in the fake (UTC) zone

/** A clock whose local zone is UTC, driven by the fake timers' system time. */
const fakeClock: Clock = {
  now: () => Date.now(),
  localDate: (at = Date.now()) => new Date(at).toISOString().slice(0, 10),
  nextLocalMidnight: (at = Date.now()) => (Math.floor(at / DAY) + 1) * DAY
}

let notified: [Notice, ReadyPhase][]
let bounces: number
let broadcasts: TimerSnapshot[]

function create() {
  const signals = {
    notify: vi.fn((notice: Notice, ready: ReadyPhase) => void notified.push([notice, ready])),
    bounceDock: vi.fn(() => void bounces++)
  }
  const service = createTimerService({
    clock: fakeClock,
    signals,
    broadcast: (snapshot) => broadcasts.push(snapshot)
  })
  return { service, signals }
}

function start(service: ReturnType<typeof create>['service']) {
  const { revision } = service.getSnapshot()
  return service.command({ type: 'start', revision })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'Date'] })
  vi.setSystemTime(T0)
  notified = []
  bounces = 0
  broadcasts = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('createTimerService', () => {
  it('launches at focus session 1 of 4 ready, arming only the midnight timeout', () => {
    const { service } = create()
    expect(service.getSnapshot()).toMatchObject({
      revision: 0,
      phase: 'focus',
      status: 'ready',
      focusNumber: 1,
      remainingMs: 25 * MIN
    })
    expect(vi.getTimerCount()).toBe(1)
    expect(broadcasts).toEqual([])
  })

  it('a start is applied, broadcast once and arms the deadline at endsAt', () => {
    const { service } = create()
    const outcome = start(service)
    expect(outcome.kind).toBe('applied')
    expect(outcome.snapshot).toMatchObject({ status: 'running', endsAt: T0 + 25 * MIN })
    expect(broadcasts).toEqual([outcome.snapshot])
    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(25 * MIN - 1)
    expect(notified).toEqual([])
    vi.advanceTimersByTime(1)
    expect(service.getSnapshot()).toMatchObject({ phase: 'shortBreak', status: 'ready' })
  })

  it('on the phase end: notify, then bounce the Dock, then broadcast (AC-05)', () => {
    const order: string[] = []
    const service = createTimerService({
      clock: fakeClock,
      signals: {
        notify: () => void order.push('notify'),
        bounceDock: () => void order.push('bounceDock')
      },
      broadcast: (snapshot) => void order.push(`broadcast ${snapshot.phase}`)
    })
    start(service)
    order.length = 0
    vi.advanceTimersByTime(25 * MIN)
    expect(order).toEqual(['notify', 'bounceDock', 'broadcast shortBreak'])
  })

  it('passes the notice and the ready phase to the notification', () => {
    const { service } = create()
    start(service)
    vi.advanceTimersByTime(25 * MIN)
    expect(notified).toEqual([
      [
        { kind: 'phaseEnded', endedPhase: 'focus', counted: true },
        { phase: 'shortBreak', focusNumber: null }
      ]
    ])
    expect(bounces).toBe(1)
    expect(broadcasts.at(-1)).toMatchObject({
      phase: 'shortBreak',
      status: 'ready',
      completedInCycle: 1,
      notice: { kind: 'phaseEnded', endedPhase: 'focus', counted: true }
    })
  })

  it.each([10 * MIN, 3 * HOUR])('a ready break never starts by itself (AC-08, +%i ms)', (wait) => {
    const { service } = create()
    start(service)
    vi.advanceTimersByTime(25 * MIN)
    const count = broadcasts.length
    vi.advanceTimersByTime(wait)
    expect(service.getSnapshot()).toMatchObject({
      phase: 'shortBreak',
      status: 'ready',
      remainingMs: 5 * MIN
    })
    expect(broadcasts).toHaveLength(count)
    expect(notified).toHaveLength(1)
  })

  it('keeps exactly one pending timeout across many commands and never uses setInterval', () => {
    const setInterval = vi.spyOn(globalThis, 'setInterval')
    const { service } = create()
    for (let i = 0; i < 20; i++) {
      const { revision, status } = service.getSnapshot()
      service.command({ type: status === 'running' ? 'pause' : 'start', revision })
      expect(vi.getTimerCount()).toBe(1)
    }
    expect(setInterval).not.toHaveBeenCalled()
  })

  it('ignored and needsConfirmation outcomes do not broadcast', () => {
    const { service } = create()
    expect(service.command({ type: 'pause', revision: 0 })).toMatchObject({
      kind: 'ignored',
      reason: 'notAllowed'
    })
    start(service)
    const count = broadcasts.length
    expect(service.command({ type: 'start', revision: 0 })).toMatchObject({
      kind: 'ignored',
      reason: 'staleRevision'
    })
    const { revision } = service.getSnapshot()
    expect(service.command({ type: 'restartCycle', revision, confirmed: false })).toMatchObject({
      kind: 'needsConfirmation',
      loss: { completedInCycle: 0, phaseInProgress: 'focus' }
    })
    expect(broadcasts).toHaveLength(count)
  })

  it.each([null, 'start', { type: 'set', revision: 0 }, { type: 'start' }])(
    'a malformed payload %j is ignored/malformed with the current snapshot, never thrown',
    (payload) => {
      const { service } = create()
      expect(service.command(payload)).toEqual({
        kind: 'ignored',
        reason: 'malformed',
        snapshot: service.getSnapshot()
      })
    }
  )

  it('reports what a Restart cycle or a quit would lose', () => {
    const { service } = create()
    expect(service.getRestartLoss()).toEqual({ completedInCycle: 0, phaseInProgress: null })
    start(service)
    expect(service.getRestartLoss()).toEqual({ completedInCycle: 0, phaseInProgress: 'focus' })
  })

  describe('new day (AC-15)', () => {
    it("midnight replaces yesterday's paused phase with a fresh cycle, without a notification", () => {
      const { service } = create()
      start(service)
      service.command({ type: 'pause', revision: service.getSnapshot().revision })
      const toMidnight = fakeClock.nextLocalMidnight() - Date.now()
      vi.advanceTimersByTime(toMidnight - 1)
      expect(service.getSnapshot().status).toBe('paused')
      vi.advanceTimersByTime(1)
      expect(broadcasts.at(-1)).toMatchObject({
        phase: 'focus',
        status: 'ready',
        completedInCycle: 0,
        notice: null
      })
      expect(notified).toEqual([])
      expect(vi.getTimerCount()).toBe(1)
    })

    it('re-arms for the next midnight after midnight passes', () => {
      const { service } = create()
      vi.advanceTimersByTime(fakeClock.nextLocalMidnight() - Date.now())
      expect(vi.getTimerCount()).toBe(1)
      // A paused phase on day two is cleared by the following midnight.
      start(service)
      service.command({ type: 'pause', revision: service.getSnapshot().revision })
      vi.advanceTimersByTime(fakeClock.nextLocalMidnight() - Date.now())
      expect(service.getSnapshot()).toMatchObject({ status: 'ready', phase: 'focus' })
    })

    it('a clock change checks for a new day at once', () => {
      const { service } = create()
      start(service)
      service.command({ type: 'pause', revision: service.getSnapshot().revision })
      vi.setSystemTime(T0 + DAY)
      service.clockChanged()
      expect(service.getSnapshot()).toMatchObject({ status: 'ready', completedInCycle: 0 })
      expect(vi.getTimerCount()).toBe(1)
    })
  })

  describe('sleep and wake', () => {
    it('arms no phase deadline while asleep (Power Nap) and settles on wake', () => {
      const { service } = create()
      start(service)
      vi.advanceTimersByTime(10 * MIN)
      service.sleep()
      // Power Nap: timers still run while the Mac is mostly asleep.
      vi.advanceTimersByTime(30 * MIN)
      expect(notified).toEqual([])
      expect(service.getSnapshot().status).toBe('running')
      service.wake()
      expect(service.getSnapshot()).toMatchObject({
        phase: 'shortBreak',
        status: 'ready',
        completedInCycle: 0,
        notice: { kind: 'endedWhileAsleep', endedPhase: 'focus', counted: false }
      })
      expect(notified).toHaveLength(1)
      expect(bounces).toBe(1)
      expect(vi.getTimerCount()).toBe(1)
    })

    it('a short sleep keeps the phase running and re-arms at endsAt', () => {
      const { service } = create()
      start(service)
      service.sleep()
      vi.setSystemTime(T0 + 5 * MIN)
      service.wake()
      expect(service.getSnapshot()).toMatchObject({ status: 'running', endsAt: T0 + 25 * MIN })
      vi.advanceTimersByTime(20 * MIN)
      expect(service.getSnapshot()).toMatchObject({ phase: 'shortBreak', completedInCycle: 1 })
    })
  })

  it('a throwing effect is logged; the remaining effects and the broadcast still run', () => {
    const bounceDock = vi.fn()
    const broadcast = vi.fn()
    const service = createTimerService({
      clock: fakeClock,
      signals: {
        notify: () => {
          throw new Error('notification centre down')
        },
        bounceDock
      },
      broadcast
    })
    start(service)
    vi.advanceTimersByTime(25 * MIN)
    expect(console.error).toHaveBeenCalledWith('[timer] notify failed', expect.any(Error))
    expect(bounceDock).toHaveBeenCalledOnce()
    expect(broadcast).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'shortBreak' }))
  })

  it('dispose clears the pending timeout', () => {
    const { service } = create()
    service.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })
})
