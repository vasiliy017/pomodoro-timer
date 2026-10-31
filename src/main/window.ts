import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'

export interface TimerWindow {
  window: BrowserWindow
  /** The one reopen path: Dock, notification click and second launch all call it. */
  show(): void
  /** Lets the next `close` really close the window (a quit the quit guard let through). */
  allowClose(): void
}

/**
 * The single timer window (ADR-0009). Closing it only hides it, so there is never a second
 * timer window and reopening is instant.
 */
export function createTimerWindow(): TimerWindow {
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
  let closable = false

  window.once('ready-to-show', () => window.show())
  window.on('close', (event) => {
    if (closable) return
    event.preventDefault()
    window.hide()
  })

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServerUrl) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  return {
    window,
    show() {
      if (window.isMinimized()) window.restore()
      window.show()
      window.focus()
    },
    allowClose() {
      closable = true
    }
  }
}
