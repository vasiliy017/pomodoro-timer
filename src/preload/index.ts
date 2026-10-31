import { contextBridge, ipcRenderer } from 'electron'
import { invokeChannels, type Api } from '@shared/ipc'

const api: Api = {
  ping: (...args) => ipcRenderer.invoke(invokeChannels.ping, ...args)
}

contextBridge.exposeInMainWorld('api', api)
