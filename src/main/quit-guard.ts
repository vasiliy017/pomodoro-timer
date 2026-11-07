import { dialog } from 'electron'
import { isRestartLossEmpty, lossMessage, type RestartLoss } from '@shared/timer'

export interface QuitGuardOptions {
  app: Pick<NodeJS.EventEmitter, 'on'> & { quit(): void }
  /** What a quit would throw away right now. */
  getLoss(): RestartLoss
  /** Asks the User; resolves true to quit. */
  showConfirm(loss: RestartLoss): Promise<boolean>
  /** Called once the quit may proceed, so the timer window can really close. */
  onQuitAllowed(): void
}

/**
 * Asks before a User quit (Cmd+Q, Dock, app menu) that would lose progress (AC-13, sad.md §6
 * Flow 8). A quit macOS starts for logout, restart or shutdown is never asked about or blocked.
 */
export function installQuitGuard(options: QuitGuardOptions): { markOsInitiatedQuit(): void } {
  const { app, getLoss, showConfirm, onQuitAllowed } = options
  let osInitiated = false
  let confirmed = false
  let asking = false

  app.on('before-quit', (event: { preventDefault(): void }) => {
    if (osInitiated || confirmed || isRestartLossEmpty(getLoss())) {
      onQuitAllowed()
      return
    }
    event.preventDefault()
    if (asking) return
    asking = true
    void showConfirm(getLoss()).then((quit) => {
      asking = false
      if (!quit) return
      confirmed = true
      app.quit()
    })
  })

  return {
    markOsInitiatedQuit() {
      osInitiated = true
    }
  }
}

/** The native confirmation: main shows it because the timer window may be closed. */
export async function showQuitConfirmation(loss: RestartLoss): Promise<boolean> {
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    message: 'Quit Pomodoro Timer?',
    detail: lossMessage(loss),
    buttons: ['Quit', 'Cancel'],
    defaultId: 1,
    cancelId: 1
  })
  return response === 0
}
