import { dialog } from 'electron'
import { isRestartLossEmpty, type PhaseKind, type RestartLoss } from '@shared/timer'

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

const PHASE_NAMES: Record<PhaseKind, string> = {
  focus: 'focus session',
  shortBreak: 'short break',
  longBreak: 'long break'
}

/** Names exactly what a quit or a Restart cycle would lose (AC-12, AC-13). */
export function lossMessage({ completedInCycle, phaseInProgress }: RestartLoss): string {
  const parts: string[] = []
  if (completedInCycle > 0) {
    const sessions = completedInCycle === 1 ? 'focus session' : 'focus sessions'
    parts.push(
      `${completedInCycle} completed ${sessions} will no longer count toward the long break`
    )
  }
  if (phaseInProgress !== null) {
    const uncounted = phaseInProgress === 'focus' ? ' uncounted' : ''
    parts.push(`the ${PHASE_NAMES[phaseInProgress]} in progress will end${uncounted}`)
  }
  const sentence = parts.join(', and ')
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`
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
