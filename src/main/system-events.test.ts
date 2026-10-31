import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { SystemEventHandlers } from './system-events'

vi.mock('electron', () => ({ powerMonitor: new EventEmitter(), systemPreferences: {} }))

const { subscribeSystemEvents } = await import('./system-events')

type Callback = (event: string, userInfo: unknown, object: string) => void

/** Records subscriptions so a test can fire a macOS notification by name. */
function fakeSystemPreferences() {
  let nextId = 1
  const local = new Map<number, [string, Callback]>()
  const distributed = new Map<number, [string, Callback]>()
  const fire = (subs: Map<number, [string, Callback]>, name: string) => {
    for (const [event, callback] of subs.values()) if (event === name) callback(name, {}, '')
  }
  return {
    local,
    distributed,
    subscribeLocalNotification: vi.fn((event: string, callback: Callback) => {
      local.set(nextId, [event, callback])
      return nextId++
    }),
    unsubscribeLocalNotification: vi.fn((id: number) => void local.delete(id)),
    subscribeNotification: vi.fn((event: string, callback: Callback) => {
      distributed.set(nextId, [event, callback])
      return nextId++
    }),
    unsubscribeNotification: vi.fn((id: number) => void distributed.delete(id)),
    fireLocal: (name: string) => fire(local, name),
    fireDistributed: (name: string) => fire(distributed, name)
  }
}

let powerMonitor: EventEmitter
let systemPreferences: ReturnType<typeof fakeSystemPreferences>
let handlers: Record<keyof SystemEventHandlers, Mock<() => void>>

beforeEach(() => {
  powerMonitor = new EventEmitter()
  systemPreferences = fakeSystemPreferences()
  handlers = {
    onSleep: vi.fn<() => void>(),
    onWake: vi.fn<() => void>(),
    onShutdown: vi.fn<() => void>(),
    onClockChanged: vi.fn<() => void>()
  }
})

function subscribe() {
  return subscribeSystemEvents(handlers, { powerMonitor, systemPreferences })
}

describe('subscribeSystemEvents', () => {
  it.each([
    ['suspend', 'onSleep'],
    ['resume', 'onWake'],
    ['shutdown', 'onShutdown']
  ] as const)('powerMonitor %s → %s', (event, handler) => {
    subscribe()
    powerMonitor.emit(event)
    expect(handlers[handler]).toHaveBeenCalledOnce()
  })

  it('resume without a preceding suspend still calls onWake', () => {
    subscribe()
    powerMonitor.emit('resume')
    expect(handlers.onWake).toHaveBeenCalledOnce()
    expect(handlers.onSleep).not.toHaveBeenCalled()
  })

  it.each(['lock-screen', 'unlock-screen', 'user-did-resign-active', 'on-battery'])(
    '%s is not sleep: no callback',
    (event) => {
      subscribe()
      powerMonitor.emit(event)
      for (const handler of Object.values(handlers)) expect(handler).not.toHaveBeenCalled()
    }
  )

  it('a system clock change → onClockChanged', () => {
    subscribe()
    systemPreferences.fireLocal('NSSystemClockDidChangeNotification')
    expect(handlers.onClockChanged).toHaveBeenCalledOnce()
  })

  it('a time-zone change → onClockChanged', () => {
    subscribe()
    systemPreferences.fireDistributed('NSSystemTimeZoneDidChangeDistributedNotification')
    expect(handlers.onClockChanged).toHaveBeenCalledOnce()
  })

  it('unsubscribe removes every listener', () => {
    const unsubscribe = subscribe()
    unsubscribe()
    for (const event of ['suspend', 'resume', 'shutdown']) {
      expect(powerMonitor.listenerCount(event)).toBe(0)
    }
    expect(systemPreferences.local.size).toBe(0)
    expect(systemPreferences.distributed.size).toBe(0)
  })

  it('skips the macOS notifications where they are unavailable, without throwing', () => {
    const unsubscribe = subscribeSystemEvents(handlers, { powerMonitor, systemPreferences: {} })
    powerMonitor.emit('suspend')
    expect(handlers.onSleep).toHaveBeenCalledOnce()
    expect(() => unsubscribe()).not.toThrow()
  })
})
