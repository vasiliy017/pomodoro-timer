import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eventChannels, invokeChannels } from '@shared/ipc'
import type { CommandOutcome, TimerSnapshot } from '@shared/timer'

const electron = vi.hoisted(() => {
  type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>
  const handlers = new Map<string, Handler>()
  const windows: { webContents: { send: ReturnType<typeof vi.fn> } }[] = []
  return {
    handlers,
    windows,
    ipcMain: {
      handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler))
    },
    BrowserWindow: { getAllWindows: () => windows }
  }
})

vi.mock('electron', () => ({ ipcMain: electron.ipcMain, BrowserWindow: electron.BrowserWindow }))

const { broadcast, registerIpcHandlers } = await import('./ipc')

const snapshot = { revision: 3, phase: 'focus', status: 'ready' } as TimerSnapshot
const timer = {
  getSnapshot: vi.fn(() => snapshot),
  command: vi.fn((payload: unknown): CommandOutcome =>
    typeof payload === 'object' && payload !== null && 'type' in payload && payload.type === 'start'
      ? { kind: 'applied', snapshot }
      : { kind: 'ignored', reason: 'malformed', snapshot }
  )
}

function invoke(channel: string, ...args: unknown[]) {
  const handler = electron.handlers.get(channel)
  if (!handler) throw new Error(`no handler for ${channel}`)
  return handler({}, ...args)
}

beforeEach(() => {
  electron.handlers.clear()
  electron.windows.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
  registerIpcHandlers({ timer })
})

describe('registerIpcHandlers', () => {
  it('registers every invoke channel of the contract', () => {
    expect([...electron.handlers.keys()].sort()).toEqual(Object.values(invokeChannels).sort())
  })

  it('timerGetState returns the current snapshot wrapped in ok', async () => {
    await expect(invoke(invokeChannels.timerGetState)).resolves.toEqual({
      ok: true,
      value: snapshot
    })
  })

  it('timerCommand passes the payload to the service and wraps the outcome', async () => {
    await expect(
      invoke(invokeChannels.timerCommand, { type: 'start', revision: 3 })
    ).resolves.toEqual({ ok: true, value: { kind: 'applied', snapshot } })
    expect(timer.command).toHaveBeenCalledWith({ type: 'start', revision: 3 })
  })

  it('a malformed payload is an ok, ignored/malformed outcome, not an error', async () => {
    await expect(invoke(invokeChannels.timerCommand, { type: 'setTime', ms: 0 })).resolves.toEqual({
      ok: true,
      value: { kind: 'ignored', reason: 'malformed', snapshot }
    })
  })

  it('an unexpected throw becomes ok: false and is logged', async () => {
    timer.command.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    await expect(
      invoke(invokeChannels.timerCommand, { type: 'start', revision: 3 })
    ).resolves.toEqual({ ok: false, error: 'boom' })
    expect(console.error).toHaveBeenCalledWith('[ipc] timerCommand failed', expect.any(Error))
  })

  it('keeps ping working', async () => {
    await expect(invoke(invokeChannels.ping, 'x')).resolves.toEqual({ ok: true, value: 'pong: x' })
  })
})

describe('broadcast', () => {
  it('sends the event on its contract channel to every open window', () => {
    const a = { webContents: { send: vi.fn() } }
    const b = { webContents: { send: vi.fn() } }
    electron.windows.push(a, b)
    broadcast('timerState', snapshot)
    expect(a.webContents.send).toHaveBeenCalledWith(eventChannels.timerState, snapshot)
    expect(b.webContents.send).toHaveBeenCalledWith(eventChannels.timerState, snapshot)
  })
})

describe('the contract', () => {
  it('declares the timer channels once', () => {
    expect(invokeChannels).toMatchObject({
      timerGetState: 'timer:get-state',
      timerCommand: 'timer:command'
    })
    expect(eventChannels).toEqual({ timerState: 'timer:state' })
  })
})
