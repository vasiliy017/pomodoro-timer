import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
  allowedControls,
  type CommandOutcome,
  type Notice,
  type PhaseKind,
  type PhaseStatus,
  type TimerSnapshot
} from '@shared/timer'
import { useTimerState, type TimerState } from '../hooks/useTimerState'
import { TimerScreen } from './TimerScreen'

vi.mock('../hooks/useTimerState', () => ({ useTimerState: vi.fn() }))

const MIN = 60_000
const hook = vi.mocked(useTimerState)
let send: Mock<TimerState['send']>

function snap(
  phase: PhaseKind,
  status: PhaseStatus,
  overrides: Partial<TimerSnapshot> = {}
): TimerSnapshot {
  const durationMs = { focus: 25, shortBreak: 5, longBreak: 15 }[phase] * MIN
  const completedInCycle = overrides.completedInCycle ?? 0
  return {
    revision: 1,
    phase,
    status,
    durationMs,
    remainingMs: durationMs,
    endsAt: status === 'running' ? Date.now() + durationMs : null,
    completedInCycle,
    focusNumber: phase === 'focus' ? completedInCycle + 1 : null,
    focusSessionsPerCycle: 4,
    notice: null,
    controls: allowedControls(phase, status),
    ...overrides
  }
}

function show(snapshot: TimerSnapshot | null, remainingMs = snapshot?.remainingMs ?? 0) {
  hook.mockReturnValue({ snapshot, remainingMs, send })
  return render(<TimerScreen />)
}

const buttonNames = () => screen.queryAllByRole('button').map((button) => button.textContent)

beforeEach(() => {
  send = vi.fn<TimerState['send']>().mockResolvedValue(null)
})

describe('TimerScreen', () => {
  describe('AC-02 repeat clicks', () => {
    it.each<[string, PhaseStatus]>([
      ['Start', 'ready'],
      ['Pause', 'running'],
      ['Resume', 'paused'],
      ['Reset', 'running'],
      ['Skip', 'running'],
      ['Restart cycle', 'ready']
    ])('ignores the second click of a double-click on %s', (name, status) => {
      show(snap('focus', status))
      fireEvent.click(screen.getByRole('button', { name }), { detail: 2 })
      expect(send).not.toHaveBeenCalled()
    })

    it('a single click and a keyboard press (detail 0) both send', () => {
      show(snap('focus', 'ready'))
      fireEvent.click(screen.getByRole('button', { name: 'Start' }), { detail: 1 })
      fireEvent.click(screen.getByRole('button', { name: 'Start' }), { detail: 0 })
      expect(send).toHaveBeenCalledTimes(2)
    })

    // A held key auto-repeats keydown; each repeat would click the same focused button again.
    it.each(['Enter', ' '])('drops auto-repeated %j keydowns on a control', (key) => {
      show(snap('focus', 'running'))
      for (const name of ['Pause', 'Reset', 'Skip', 'Restart cycle']) {
        const button = screen.getByRole('button', { name })
        // fireEvent returns false when the handler called preventDefault.
        expect(fireEvent.keyDown(button, { key, repeat: true }), name).toBe(false)
        expect(fireEvent.keyDown(button, { key, repeat: false }), name).toBe(true)
      }
    })
  })

  describe('keyboard focus when a control removes itself', () => {
    it.each<[string, TimerSnapshot, TimerSnapshot]>([
      ['Reset', snap('focus', 'running'), snap('focus', 'ready', { revision: 2 })],
      [
        'Skip',
        snap('shortBreak', 'ready', { completedInCycle: 1 }),
        snap('focus', 'ready', { revision: 2, completedInCycle: 1 })
      ]
    ])('moves focus to the primary button after %s', (name, before, after) => {
      const { rerender } = show(before)
      screen.getByRole('button', { name }).focus()
      hook.mockReturnValue({ snapshot: after, remainingMs: after.remainingMs, send })
      rerender(<TimerScreen />)
      expect(screen.queryByRole('button', { name })).toBeNull()
      expect(screen.getByRole('button', { name: 'Start' })).toHaveFocus()
    })

    it('leaves focus alone when it was not on a control', () => {
      const { rerender } = show(snap('focus', 'running'))
      expect(document.body).toHaveFocus()
      const after = snap('focus', 'ready', { revision: 2 })
      hook.mockReturnValue({ snapshot: after, remainingMs: after.remainingMs, send })
      rerender(<TimerScreen />)
      expect(document.body).toHaveFocus()
    })
  })

  it('keeps keyboard focus on the primary button across Start, Pause and Resume', () => {
    const { rerender } = show(snap('focus', 'ready'))
    screen.getByRole('button', { name: 'Start' }).focus()
    hook.mockReturnValue({ snapshot: snap('focus', 'running'), remainingMs: 25 * MIN, send })
    rerender(<TimerScreen />)
    expect(screen.getByRole('button', { name: 'Pause' })).toHaveFocus()
    hook.mockReturnValue({ snapshot: snap('focus', 'paused'), remainingMs: 25 * MIN, send })
    rerender(<TimerScreen />)
    expect(screen.getByRole('button', { name: 'Resume' })).toHaveFocus()
  })

  describe('AC-01 labels', () => {
    it('shows focus session 1 of 4 ready at 25:00 on launch', () => {
      show(snap('focus', 'ready'))
      expect(screen.getByRole('heading', { name: 'Focus session 1 of 4' })).toBeInTheDocument()
      expect(screen.getByRole('timer')).toHaveTextContent('25:00')
      expect(screen.getByText('Ready')).toBeInTheDocument()
    })

    it('keeps N = completed + 1 on a focus session after a skip or reset', () => {
      show(snap('focus', 'ready', { completedInCycle: 2 }))
      expect(screen.getByRole('heading', { name: 'Focus session 3 of 4' })).toBeInTheDocument()
    })

    it('shows «N of 4 completed» on a break', () => {
      show(snap('shortBreak', 'running', { completedInCycle: 2 }), 4 * MIN + 1_000)
      expect(screen.getByRole('heading', { name: 'Short break' })).toBeInTheDocument()
      expect(screen.getByText('2 of 4 completed')).toBeInTheDocument()
      expect(screen.getByRole('timer')).toHaveTextContent('04:01')
    })

    it('shows a ready long break with 4 of 4 completed', () => {
      show(snap('longBreak', 'ready', { completedInCycle: 4 }))
      expect(screen.getByRole('heading', { name: 'Long break' })).toBeInTheDocument()
      expect(screen.getByText('4 of 4 completed')).toBeInTheDocument()
      expect(screen.getByRole('timer')).toHaveTextContent('15:00')
    })

    it('shows a paused phase as paused with its frozen time', () => {
      show(snap('focus', 'paused', { remainingMs: 12 * MIN + 34_000 }))
      expect(screen.getByText('Paused')).toBeInTheDocument()
      expect(screen.getByRole('timer')).toHaveTextContent('12:34')
    })

    it('never shows a negative time', () => {
      show(snap('focus', 'running'), 0)
      expect(screen.getByRole('timer')).toHaveTextContent('00:00')
    })

    it('rounds a partial second up, so a fresh start reads 25:00', () => {
      show(snap('focus', 'running'), 25 * MIN - 250)
      expect(screen.getByRole('timer')).toHaveTextContent('25:00')
    })
  })

  describe('AC-02b controls: exactly the row, nothing else', () => {
    it.each<[string, TimerSnapshot, string[]]>([
      ['ready focus session', snap('focus', 'ready'), ['Start', 'Restart cycle']],
      [
        'ready short break',
        snap('shortBreak', 'ready', { completedInCycle: 1 }),
        ['Start', 'Skip', 'Restart cycle']
      ],
      [
        'ready long break',
        snap('longBreak', 'ready', { completedInCycle: 4 }),
        ['Start', 'Skip', 'Restart cycle']
      ],
      ['running focus', snap('focus', 'running'), ['Pause', 'Reset', 'Skip', 'Restart cycle']],
      [
        'running long break',
        snap('longBreak', 'running', { completedInCycle: 4 }),
        ['Pause', 'Reset', 'Skip', 'Restart cycle']
      ],
      ['paused focus', snap('focus', 'paused'), ['Resume', 'Reset', 'Skip', 'Restart cycle']],
      [
        'paused short break',
        snap('shortBreak', 'paused', { completedInCycle: 1 }),
        ['Resume', 'Reset', 'Skip', 'Restart cycle']
      ]
    ])('%s', (_name, snapshot, buttons) => {
      show(snapshot)
      expect(buttonNames()).toEqual(buttons)
    })

    it.each([
      ['Start', snap('focus', 'ready'), 'start'],
      ['Resume', snap('focus', 'paused'), 'start'],
      ['Pause', snap('focus', 'running'), 'pause'],
      ['Reset', snap('focus', 'running'), 'reset'],
      ['Skip', snap('shortBreak', 'ready'), 'skip']
    ] as const)('%s sends %s', (name, snapshot, type) => {
      show(snapshot)
      fireEvent.click(screen.getByRole('button', { name }))
      expect(send).toHaveBeenCalledWith(type)
    })
  })

  describe('AC-06 notice beside the ready phase', () => {
    it.each<[Notice, string]>([
      [{ kind: 'phaseEnded', endedPhase: 'focus', counted: true }, 'Focus session complete'],
      [{ kind: 'phaseEnded', endedPhase: 'shortBreak', counted: false }, 'Break over'],
      [{ kind: 'phaseEnded', endedPhase: 'longBreak', counted: false }, 'Break over'],
      [
        { kind: 'endedWhileAsleep', endedPhase: 'focus', counted: false },
        'Focus session ended while the Mac was asleep — not counted'
      ],
      [
        { kind: 'endedWhileAsleep', endedPhase: 'shortBreak', counted: false },
        'Break ended while the Mac was asleep'
      ]
    ])('%j', (notice, text) => {
      show(snap('shortBreak', 'ready', { completedInCycle: 1, notice }))
      expect(screen.getByRole('status')).toHaveTextContent(text)
    })

    it('shows no notice when there is none', () => {
      show(snap('focus', 'ready'))
      expect(screen.queryByRole('status')).toBeNull()
    })
  })

  it('shows a quiet placeholder and no controls while loading', () => {
    show(null)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(buttonNames()).toEqual([])
  })
})

describe('AC-12 Restart cycle confirmation', () => {
  const lossy = () => snap('focus', 'running', { revision: 7, completedInCycle: 3 })
  const needsConfirmation = (snapshot: TimerSnapshot): CommandOutcome => ({
    kind: 'needsConfirmation',
    loss: { completedInCycle: 3, phaseInProgress: 'focus' },
    snapshot
  })

  async function openDialog(snapshot = lossy()) {
    show(snapshot)
    send.mockResolvedValueOnce(needsConfirmation(snapshot))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Restart cycle' }))
    })
  }

  it('asks first, naming what will be lost', async () => {
    await openDialog()
    expect(send).toHaveBeenCalledWith('restartCycle', { confirmed: false })
    const dialog = screen.getByRole('dialog', { name: 'Restart the cycle?' })
    expect(dialog).toHaveTextContent(
      '3 completed focus sessions will no longer count toward the long break, and the focus session in progress will end uncounted.'
    )
  })

  it('names only the break in progress when no focus session is completed', async () => {
    const snapshot = snap('shortBreak', 'running', { revision: 2 })
    show(snapshot)
    send.mockResolvedValueOnce({
      kind: 'needsConfirmation',
      loss: { completedInCycle: 0, phaseInProgress: 'shortBreak' },
      snapshot
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Restart cycle' }))
    })
    expect(screen.getByRole('dialog')).toHaveTextContent('The short break in progress will end.')
  })

  it('confirm sends the confirmed command at the revision the User saw', async () => {
    await openDialog()
    send.mockResolvedValueOnce({
      kind: 'applied',
      snapshot: snap('focus', 'ready', { revision: 8 })
    })
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Restart cycle' })
      )
    })
    expect(send).toHaveBeenLastCalledWith('restartCycle', { confirmed: true, revision: 7 })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('cancel closes the dialog and sends nothing more', async () => {
    await openDialog()
    send.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(send).not.toHaveBeenCalled()
  })

  it('a stale confirmation is ignored: the dialog closes and the current state shows', async () => {
    await openDialog()
    send.mockResolvedValueOnce({
      kind: 'ignored',
      reason: 'staleRevision',
      snapshot: snap('shortBreak', 'ready', { revision: 8, completedInCycle: 4 })
    })
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Restart cycle' })
      )
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('acts at once without a dialog when nothing would be lost', async () => {
    show(snap('focus', 'ready'))
    send.mockResolvedValueOnce({
      kind: 'applied',
      snapshot: snap('focus', 'ready', { revision: 2 })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Restart cycle' }))
    })
    expect(send).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
