import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { eventChannels, invokeChannels, type Api } from '@shared/ipc'
import type { TimerSnapshot } from '@shared/timer'

const api: Api = {
  ping: (...args) => ipcRenderer.invoke(invokeChannels.ping, ...args),
  timerGetState: (...args) => ipcRenderer.invoke(invokeChannels.timerGetState, ...args),
  timerCommand: (...args) => ipcRenderer.invoke(invokeChannels.timerCommand, ...args),
  onTimerState: (listener) => {
    const handler = (_event: IpcRendererEvent, snapshot: TimerSnapshot) => listener(snapshot)
    ipcRenderer.on(eventChannels.timerState, handler)
    return () => {
      ipcRenderer.removeListener(eventChannels.timerState, handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
