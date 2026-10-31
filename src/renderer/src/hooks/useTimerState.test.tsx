import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Api } from '@shared/ipc'
import type { Result } from '@shared/result'
import type { CommandOutcome, TimerSnapshot } from '@shared/timer'
import { useTimerState } from './useTimerState'

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 31, 9, 0, 0)

function snap(overrides: Partial<TimerSnapshot> = {}): TimerSnapshot {
  return {
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
    controls: { start: true, pause: false, reset: false, skip: false, restartCycle: true },
    ...overrides
  }
}

const running = (revision: number, leftMs: number) =>
  snap({ revision, status: 'running', endsAt: Date.now() + leftMs, remainingMs: leftMs })

let push: (snapshot: TimerSnapshot) => void
let resolveGetState: (result: Result<TimerSnapshot>) => void
let calls: string[]
let unsubscribe: ReturnType<typeof vi.fn>
let api: {
  onTimerState: ReturnType<typeof vi.fn>
  timerGetState: ReturnType<typeof vi.fn>
  timerCommand: ReturnType<typeof vi.fn>
}
let visibility: DocumentVisibilityState

function setVisibility(value: DocumentVisibilityState) {
  visibility = value
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

/** Lets pending promise callbacks (the getState reply) run inside act. */
async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

async function mount(initial = snap()) {
  const hook = renderHook(() => useTimerState())
  resolveGetState({ ok: true, value: initial })
  await flush()
  return hook
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(T0)
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility
  })
  calls = []
  unsubscribe = vi.fn()
  api = {
    onTimerState: vi.fn((listener: (snapshot: TimerSnapshot) => void) => {
      calls.push('subscribe')
      push = (snapshot) => act(() => listener(snapshot))
      return unsubscribe
    }),
    timerGetState: vi.fn(() => {
      calls.push('getState')
      return new Promise<Result<TimerSnapshot>>((resolve) => (resolveGetState = resolve))
    }),
    timerCommand: vi.fn()
  }
  window.api = api as unknown as Api
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useTimerState', () => {
  it('subscribes first, then pulls the current state', async () => {
    const { result } = await mount(snap({ revision: 2 }))
    expect(calls).toEqual(['subscribe', 'getState'])
    expect(result.current.snapshot?.revision).toBe(2)
  })

  it('drops an older getState reply that arrives after a newer broadcast', async () => {
    const { result } = renderHook(() => useTimerState())
    push(snap({ revision: 6, status: 'paused', remainingMs: MIN }))
    resolveGetState({ ok: true, value: snap({ revision: 5 }) })
    await flush()
    expect(result.current.snapshot?.revision).toBe(6)
    expect(result.current.snapshot?.status).toBe('paused')
  })

  it('drops an older broadcast that arrives after a newer snapshot', async () => {
    const { result } = await mount(snap({ revision: 7 }))
    push(snap({ revision: 6, status: 'paused', remainingMs: MIN }))
    expect(result.current.snapshot?.revision).toBe(7)
    push(snap({ revision: 8, completedInCycle: 1, focusNumber: 2 }))
    expect(result.current.snapshot?.revision).toBe(8)
  })

  it('counts down from endsAt while running and visible', async () => {
    const { result } = await mount(running(1, 10 * MIN))
    expect(result.current.remainingMs).toBe(10 * MIN)
    act(() => vi.advanceTimersByTime(1_000))
    expect(result.current.remainingMs).toBe(10 * MIN - 1_000)
  })

  it('never shows less than 0', async () => {
    const { result } = await mount(running(1, 500))
    act(() => vi.advanceTimersByTime(2_000))
    expect(result.current.remainingMs).toBe(0)
  })

  it('runs no interval while hidden, and is right on the first render after becoming visible', async () => {
    let renders = 0
    const endsAt = Date.now() + 25 * MIN
    const { result } = renderHook(() => {
      renders++
      return useTimerState()
    })
    resolveGetState({ ok: true, value: snap({ revision: 1, status: 'running', endsAt }) })
    await flush()
    setVisibility('hidden')
    expect(vi.getTimerCount()).toBe(0)

    const before = renders
    act(() => vi.advanceTimersByTime(18 * MIN))
    expect(renders).toBe(before)

    setVisibility('visible')
    expect(renders).toBe(before + 1)
    expect(result.current.remainingMs).toBe(endsAt - Date.now())
    expect(result.current.remainingMs).toBe(7 * MIN)
  })

  it('a paused snapshot is frozen and runs no interval (AC-04)', async () => {
    const left = 12 * MIN + 34_000
    const { result } = await mount(snap({ revision: 3, status: 'paused', remainingMs: left }))
    expect(vi.getTimerCount()).toBe(0)
    act(() => vi.advanceTimersByTime(3 * 60 * MIN))
    expect(result.current.remainingMs).toBe(left)
  })

  it('a resumed phase counts down from the frozen value (AC-04)', async () => {
    const left = 12 * MIN + 34_000
    const { result } = await mount(snap({ revision: 3, status: 'paused', remainingMs: left }))
    act(() => vi.advanceTimersByTime(60 * MIN))
    push(running(4, left))
    expect(result.current.remainingMs).toBe(left)
    act(() => vi.advanceTimersByTime(1_000))
    expect(result.current.remainingMs).toBe(left - 1_000)
  })

  it('commands carry the held revision and apply the outcome snapshot', async () => {
    const { result } = await mount(snap({ revision: 4 }))
    const outcome: CommandOutcome = { kind: 'applied', snapshot: running(5, 25 * MIN) }
    api.timerCommand.mockResolvedValue({ ok: true, value: outcome })
    let returned: CommandOutcome | null = null
    await act(async () => {
      returned = await result.current.send('start')
    })
    expect(api.timerCommand).toHaveBeenCalledWith({ type: 'start', revision: 4 })
    expect(returned).toEqual(outcome)
    expect(result.current.snapshot?.revision).toBe(5)
  })

  it('sends restartCycle with its confirmation flag', async () => {
    const { result } = await mount(snap({ revision: 9, completedInCycle: 3, focusNumber: 4 }))
    api.timerCommand.mockResolvedValue({
      ok: true,
      value: { kind: 'applied', snapshot: snap({ revision: 10 }) }
    })
    await act(async () => {
      await result.current.send('restartCycle', { confirmed: true })
    })
    expect(api.timerCommand).toHaveBeenCalledWith({
      type: 'restartCycle',
      revision: 9,
      confirmed: true
    })
  })

  it('an outcome older than a broadcast already applied is dropped', async () => {
    const { result } = await mount(snap({ revision: 4 }))
    let reply: (value: Result<CommandOutcome>) => void = () => {}
    api.timerCommand.mockReturnValue(new Promise((resolve) => (reply = resolve)))
    let pending: Promise<unknown> = Promise.resolve()
    act(() => {
      pending = result.current.send('start')
    })
    push(running(6, 20 * MIN))
    await act(async () => {
      reply({ ok: true, value: { kind: 'applied', snapshot: running(5, 25 * MIN) } })
      await pending
    })
    expect(result.current.snapshot?.revision).toBe(6)
  })

  it('a failed getState leaves the snapshot null without throwing', async () => {
    const { result } = renderHook(() => useTimerState())
    resolveGetState({ ok: false, error: 'boom' })
    await flush()
    expect(result.current.snapshot).toBeNull()
  })

  it('send before any snapshot does nothing', async () => {
    const { result } = renderHook(() => useTimerState())
    await act(async () => {
      expect(await result.current.send('start')).toBeNull()
    })
    expect(api.timerCommand).not.toHaveBeenCalled()
  })

  it('a failed command returns null and keeps the snapshot', async () => {
    const { result } = await mount(snap({ revision: 4 }))
    api.timerCommand.mockResolvedValue({ ok: false, error: 'boom' })
    await act(async () => {
      expect(await result.current.send('start')).toBeNull()
    })
    expect(result.current.snapshot?.revision).toBe(4)
  })

  it('unsubscribes on unmount', async () => {
    const { unmount } = await mount()
    unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})

describe('useTimerState — explicit revision', () => {
  it('send can target the revision a dialog was opened at, not the newest one', async () => {
    const { result } = await mount(snap({ revision: 7, completedInCycle: 3, focusNumber: 4 }))
    push(snap({ revision: 8, completedInCycle: 4, focusNumber: null, phase: 'longBreak' }))
    api.timerCommand.mockResolvedValue({
      ok: true,
      value: { kind: 'ignored', reason: 'staleRevision', snapshot: snap({ revision: 8 }) }
    })
    await act(async () => {
      await result.current.send('restartCycle', { confirmed: true, revision: 7 })
    })
    expect(api.timerCommand).toHaveBeenCalledWith({
      type: 'restartCycle',
      revision: 7,
      confirmed: true
    })
  })
})
