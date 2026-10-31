import { app } from 'electron'
import { systemClock } from './clock'
import { broadcast, registerIpcHandlers } from './ipc'
import { installQuitGuard, showQuitConfirmation } from './quit-guard'
import { createSignals } from './signals'
import { createSettingsStore } from './store'
import { subscribeSystemEvents } from './system-events'
import { resolveTimerConfig } from './timer-config'
import { createTimerService } from './timer-service'
import { createTimerWindow } from './window'

function start(): void {
  createSettingsStore(app.getPath('userData')).load()

  // Called only after the window below exists: by a notification click, the Dock or a relaunch.
  const showTimerWindow = () => timerWindow.show()

  const timer = createTimerService({
    clock: systemClock,
    signals: createSignals({ onClick: showTimerWindow }),
    broadcast: (snapshot) => broadcast('timerState', snapshot),
    config: resolveTimerConfig(app.isPackaged, process.env['POMODORO_TEST_TIMER_CONFIG'])
  })
  registerIpcHandlers({ timer })
  const timerWindow = createTimerWindow()

  const quitGuard = installQuitGuard({
    app,
    getLoss: () => timer.getRestartLoss(),
    showConfirm: showQuitConfirmation,
    onQuitAllowed: () => timerWindow.allowClose()
  })
  subscribeSystemEvents({
    onSleep: () => timer.sleep(),
    onWake: () => timer.wake(),
    onClockChanged: () => timer.clockChanged(),
    onShutdown: () => quitGuard.markOsInitiatedQuit()
  })

  // The Dock icon and a second launch reopen the one timer window (ADR-0009).
  app.on('activate', showTimerWindow)
  app.on('second-instance', showTimerWindow)
}

// One process per macOS account (AC-03): a second launch hands over to the first and quits.
if (app.requestSingleInstanceLock()) {
  void app.whenReady().then(start)
} else {
  app.quit()
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
