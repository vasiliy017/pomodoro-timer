import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Notice } from '@shared/timer'

const electron = vi.hoisted(() => {
  const created: FakeNotification[] = []
  class FakeNotification {
    static isSupported = vi.fn(() => true)
    listeners = new Map<string, () => void>()
    show = vi.fn()
    constructor(public options: { title: string; body: string }) {
      created.push(this)
    }
    on(event: string, listener: () => void) {
      this.listeners.set(event, listener)
      return this
    }
    emit(event: string) {
      this.listeners.get(event)?.()
    }
  }
  const app = { dock: { bounce: vi.fn() } as { bounce: ReturnType<typeof vi.fn> } | undefined }
  return { created, FakeNotification, app }
})

vi.mock('electron', () => ({ app: electron.app, Notification: electron.FakeNotification }))

const { createSignals, phaseEndMessage } = await import('./signals')

const focusDone: Notice = { kind: 'phaseEnded', endedPhase: 'focus', counted: true }

beforeEach(() => {
  electron.created.length = 0
  electron.FakeNotification.isSupported.mockReturnValue(true)
  electron.app.dock = { bounce: vi.fn() }
})

describe('phaseEndMessage', () => {
  it.each([
    [focusDone, 'shortBreak', null, 'Focus session complete', 'Short break ready'],
    [focusDone, 'longBreak', null, 'Focus session complete', 'Long break ready'],
    [focusDone, 'focus', 1, 'Focus session complete', 'Focus session 1 ready'],
    [
      { kind: 'phaseEnded', endedPhase: 'shortBreak', counted: false },
      'focus',
      3,
      'Break over',
      'Focus session 3 ready'
    ],
    [
      { kind: 'phaseEnded', endedPhase: 'longBreak', counted: false },
      'focus',
      1,
      'Break over',
      'Focus session 1 ready'
    ],
    [
      { kind: 'endedWhileAsleep', endedPhase: 'focus', counted: false },
      'shortBreak',
      null,
      'Focus session ended while the Mac was asleep',
      'Not counted. Short break ready'
    ],
    [
      { kind: 'endedWhileAsleep', endedPhase: 'focus', counted: false },
      'focus',
      1,
      'Focus session ended while the Mac was asleep',
      'Not counted. Focus session 1 ready'
    ],
    [
      { kind: 'endedWhileAsleep', endedPhase: 'shortBreak', counted: false },
      'focus',
      2,
      'Break ended while the Mac was asleep',
      'Focus session 2 ready'
    ]
  ] as const)('%j → %s %s', (notice, phase, focusNumber, title, body) => {
    expect(phaseEndMessage(notice, { phase, focusNumber })).toEqual({ title, body })
  })
})

describe('createSignals', () => {
  it('notify shows exactly one notification with the phase-end wording', () => {
    const signals = createSignals({ onClick: vi.fn() })
    signals.notify(focusDone, { phase: 'shortBreak', focusNumber: null })
    expect(electron.created).toHaveLength(1)
    expect(electron.created[0]?.options).toMatchObject({
      title: 'Focus session complete',
      body: 'Short break ready'
    })
    expect(electron.created[0]?.show).toHaveBeenCalledOnce()
  })

  it('a click on the notification calls onClick (the window is shown by the caller)', () => {
    const onClick = vi.fn()
    createSignals({ onClick }).notify(focusDone, { phase: 'shortBreak', focusNumber: null })
    electron.created[0]?.emit('click')
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('keeps each notification referenced until it closes', () => {
    const signals = createSignals({ onClick: vi.fn() })
    signals.notify(focusDone, { phase: 'shortBreak', focusNumber: null })
    signals.notify(focusDone, { phase: 'longBreak', focusNumber: null })
    expect(signals.pendingNotifications()).toBe(2)
    electron.created[0]?.emit('close')
    expect(signals.pendingNotifications()).toBe(1)
    electron.created[1]?.emit('click')
    expect(signals.pendingNotifications()).toBe(0)
  })

  it('notify is a no-op when notifications are unsupported', () => {
    electron.FakeNotification.isSupported.mockReturnValue(false)
    const signals = createSignals({ onClick: vi.fn() })
    expect(() =>
      signals.notify(focusDone, { phase: 'shortBreak', focusNumber: null })
    ).not.toThrow()
    expect(electron.created).toHaveLength(0)
  })

  it('bounceDock bounces once, informational (never critical)', () => {
    createSignals({ onClick: vi.fn() }).bounceDock()
    expect(electron.app.dock?.bounce).toHaveBeenCalledOnce()
    expect(electron.app.dock?.bounce).toHaveBeenCalledWith('informational')
  })

  it('bounceDock does not throw without a Dock', () => {
    electron.app.dock = undefined
    expect(() => createSignals({ onClick: vi.fn() }).bounceDock()).not.toThrow()
  })
})
