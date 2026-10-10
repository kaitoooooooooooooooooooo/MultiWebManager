import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { EVENT_CHANNELS, INVOKE_CHANNELS, type MwmApi } from '@shared/ipc'

const invokeChannels = new Set<string>(INVOKE_CHANNELS)
const eventChannels = new Set<string>(EVENT_CHANNELS)

const api: MwmApi = {
  invoke(channel, ...args) {
    if (!invokeChannels.has(channel)) return Promise.reject(new Error(`Canal IPC refusé : ${channel}`))
    return ipcRenderer.invoke(channel, ...args)
  },
  on(channel, listener) {
    if (!eventChannels.has(channel)) throw new Error(`Canal IPC refusé : ${channel}`)
    const wrapped = (_event: IpcRendererEvent, payload: Parameters<typeof listener>[0]) => listener(payload)
    ipcRenderer.on(channel, wrapped)
    return () => {
      ipcRenderer.removeListener(channel, wrapped)
    }
  }
}

contextBridge.exposeInMainWorld('mwm', api)
