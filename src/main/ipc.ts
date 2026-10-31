import { BrowserWindow, ipcMain } from 'electron'
import {
  eventChannels,
  invokeChannels,
  type EventContract,
  type EventName,
  type InvokeArgs,
  type InvokeName,
  type InvokeResult
} from '@shared/ipc'
import { err, ok } from '@shared/result'
import type { TimerService } from './timer-service'

type Handlers = {
  [K in InvokeName]: (...args: InvokeArgs<K>) => InvokeResult<K> | Promise<InvokeResult<K>>
}

export interface IpcDependencies {
  timer: Pick<TimerService, 'getSnapshot' | 'command'>
}

function createHandlers({ timer }: IpcDependencies): Handlers {
  return {
    ping: (message) => `pong: ${message}`,
    timerGetState: () => timer.getSnapshot(),
    // The payload is untrusted at runtime: the service checks it with isTimerCommand.
    timerCommand: (command) => timer.command(command)
  }
}

/** Registers every handler of the shared IPC contract. The only place main touches ipcMain. */
export function registerIpcHandlers(dependencies: IpcDependencies): void {
  const handlers = createHandlers(dependencies)
  for (const name of Object.keys(handlers) as InvokeName[]) {
    const handler = handlers[name] as (...args: unknown[]) => unknown
    ipcMain.handle(invokeChannels[name], async (_event, ...args: unknown[]) => {
      try {
        return ok(await handler(...args))
      } catch (error) {
        console.error(`[ipc] ${name} failed`, error)
        return err(error instanceof Error ? error.message : String(error))
      }
    })
  }
}

/** Sends an event of the shared contract to every open window. The only way main pushes to the UI. */
export function broadcast<K extends EventName>(name: K, payload: EventContract[K]): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(eventChannels[name], payload)
  }
}
