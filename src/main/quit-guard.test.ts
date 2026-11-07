import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lossMessage, type RestartLoss } from '@shared/timer'

const electron = vi.hoisted(() => ({ dialog: { showMessageBox: vi.fn() } }))
vi.mock('electron', () => ({ dialog: electron.dialog }))

const { installQuitGuard, showQuitConfirmation } = await import('./quit-guard')

class FakeApp extends EventEmitter {
  quit = vi.fn(() => {
    this.requestQuit()
  })

  /** Emits `before-quit` like Electron and reports whether a listener prevented it. */
  requestQuit(): boolean {
    let prevented = false
    this.emit('before-quit', { preventDefault: () => (prevented = true) })
    return prevented
  }
}

const atStake: RestartLoss = { completedInCycle: 2, phaseInProgress: 'focus' }
let app: FakeApp
let loss: RestartLoss
let showConfirm: ReturnType<typeof vi.fn<(loss: RestartLoss) => Promise<boolean>>>
let onQuitAllowed: ReturnType<typeof vi.fn<() => void>>

function install() {
  return installQuitGuard({ app, getLoss: () => loss, showConfirm, onQuitAllowed })
}

beforeEach(() => {
  app = new FakeApp()
  loss = atStake
  showConfirm = vi.fn<(loss: RestartLoss) => Promise<boolean>>()
  onQuitAllowed = vi.fn<() => void>()
})

describe('installQuitGuard', () => {
  it('asks before quitting when progress would be lost; confirm → the quit proceeds', async () => {
    showConfirm.mockResolvedValue(true)
    install()
    expect(app.requestQuit()).toBe(true)
    expect(showConfirm).toHaveBeenCalledWith(atStake)
    await vi.waitFor(() => expect(app.quit).toHaveBeenCalledOnce())
    expect(onQuitAllowed).toHaveBeenCalledOnce()
    expect(showConfirm).toHaveBeenCalledOnce()
  })

  it('cancel → the quit stays prevented and nothing else happens', async () => {
    showConfirm.mockResolvedValue(false)
    install()
    expect(app.requestQuit()).toBe(true)
    await Promise.resolve()
    await Promise.resolve()
    expect(app.quit).not.toHaveBeenCalled()
    expect(onQuitAllowed).not.toHaveBeenCalled()
  })

  it('quits at once without a dialog when nothing would be lost', () => {
    loss = { completedInCycle: 0, phaseInProgress: null }
    install()
    expect(app.requestQuit()).toBe(false)
    expect(showConfirm).not.toHaveBeenCalled()
    expect(onQuitAllowed).toHaveBeenCalledOnce()
  })

  it('never asks or blocks when macOS quits for logout, restart or shutdown', () => {
    const guard = install()
    guard.markOsInitiatedQuit()
    expect(app.requestQuit()).toBe(false)
    expect(showConfirm).not.toHaveBeenCalled()
    expect(onQuitAllowed).toHaveBeenCalledOnce()
  })

  it('a second Cmd+Q while the dialog is open shows no second dialog', async () => {
    let answer: (ok: boolean) => void = () => {}
    showConfirm.mockReturnValue(new Promise((resolve) => (answer = resolve)))
    install()
    expect(app.requestQuit()).toBe(true)
    expect(app.requestQuit()).toBe(true)
    expect(showConfirm).toHaveBeenCalledOnce()
    answer(false)
    await Promise.resolve()
    showConfirm.mockResolvedValue(false)
    app.requestQuit()
    expect(showConfirm).toHaveBeenCalledTimes(2)
  })
})

describe('showQuitConfirmation', () => {
  it('shows a native warning naming the loss and resolves true only for Quit', async () => {
    electron.dialog.showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: false })
    await expect(showQuitConfirmation(atStake)).resolves.toBe(true)
    expect(electron.dialog.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'warning',
        buttons: ['Quit', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        detail: lossMessage(atStake)
      })
    )
    electron.dialog.showMessageBox.mockResolvedValue({ response: 1, checkboxChecked: false })
    await expect(showQuitConfirmation(atStake)).resolves.toBe(false)
  })
})
