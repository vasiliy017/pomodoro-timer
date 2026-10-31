import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { DEFAULT_TIMER_CONFIG } from '@shared/timer'
import { systemClock } from './clock'
import { broadcast, registerIpcHandlers } from './ipc'
import { createSignals } from './signals'
import { createSettingsStore } from './store'
import { createTimerService } from './timer-service'

let mainWindow: BrowserWindow | undefined

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 420,
    height: 560,
    show: false,
    title: 'Pomodoro Timer',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.once('ready-to-show', () => window.show())

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServerUrl) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  return window
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow()
    return
  }
  mainWindow.show()
  mainWindow.focus()
}

void app.whenReady().then(() => {
  createSettingsStore(app.getPath('userData')).load()
  const timer = createTimerService({
    clock: systemClock,
    signals: createSignals({ onClick: showMainWindow }),
    broadcast: (snapshot) => broadcast('timerState', snapshot),
    config: DEFAULT_TIMER_CONFIG
  })
  registerIpcHandlers({ timer })
  mainWindow = createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) showMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
