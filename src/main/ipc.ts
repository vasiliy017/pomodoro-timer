import { ipcMain } from 'electron'
import { invokeChannels, type InvokeArgs, type InvokeName, type InvokeResult } from '@shared/ipc'
import { err, ok } from '@shared/result'

type Handlers = {
  [K in InvokeName]: (...args: InvokeArgs<K>) => InvokeResult<K> | Promise<InvokeResult<K>>
}

const handlers: Handlers = {
  ping: (message) => `pong: ${message}`
}

/** Registers every handler of the shared IPC contract. The only place main touches ipcMain. */
export function registerIpcHandlers(): void {
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
