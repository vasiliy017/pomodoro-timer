import { beforeEach, describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => {
  const created: FakeWindow[] = []
  class FakeWindow {
    listeners = new Map<string, ((event: { preventDefault: () => void }) => void)[]>()
    show = vi.fn()
    hide = vi.fn()
    focus = vi.fn()
    restore = vi.fn()
    isMinimized = vi.fn(() => false)
    loadURL = vi.fn(() => Promise.resolve())
    loadFile = vi.fn(() => Promise.resolve())
    constructor(public options: Record<string, unknown>) {
      created.push(this)
    }
    on(event: string, listener: (event: { preventDefault: () => void }) => void) {
      this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener])
      return this
    }
    once(event: string, listener: (event: { preventDefault: () => void }) => void) {
      return this.on(event, listener)
    }
    /** Emits `close` and reports whether a listener prevented it. */
    close(): boolean {
      let prevented = false
      const event = { preventDefault: () => (prevented = true) }
      for (const listener of this.listeners.get('close') ?? []) listener(event)
      return prevented
    }
  }
  return { created, FakeWindow, app: { isPackaged: true } }
})

vi.mock('electron', () => ({ app: electron.app, BrowserWindow: electron.FakeWindow }))

const { createTimerWindow } = await import('./window')

beforeEach(() => {
  electron.created.length = 0
})

describe('createTimerWindow', () => {
  it('creates one window with the hardened webPreferences', () => {
    createTimerWindow()
    expect(electron.created).toHaveLength(1)
    expect(electron.created[0]?.options).toMatchObject({
      title: 'Pomodoro Timer',
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    expect(electron.created[0]?.loadFile).toHaveBeenCalledOnce()
  })

  it('hides instead of closing', () => {
    const timer = createTimerWindow()
    const prevented = electron.created[0]?.close()
    expect(prevented).toBe(true)
    expect(timer.window.hide).toHaveBeenCalledOnce()
  })

  it('lets the window close after allowClose()', () => {
    const timer = createTimerWindow()
    timer.allowClose()
    expect(electron.created[0]?.close()).toBe(false)
    expect(timer.window.hide).not.toHaveBeenCalled()
  })

  it('show() reopens the same window and focuses it, never a second one', () => {
    const timer = createTimerWindow()
    electron.created[0]?.close()
    timer.show()
    timer.show()
    expect(electron.created).toHaveLength(1)
    expect(timer.window.show).toHaveBeenCalledTimes(2)
    expect(timer.window.focus).toHaveBeenCalledTimes(2)
  })

  it('show() restores a minimized window', () => {
    const timer = createTimerWindow()
    electron.created[0]?.isMinimized.mockReturnValue(true)
    timer.show()
    expect(timer.window.restore).toHaveBeenCalledOnce()
  })
})
