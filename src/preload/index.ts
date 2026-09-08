import { contextBridge, ipcRenderer } from 'electron'
import { channelNames, type AppEvent } from '@shared/ipc-contract'

/** По одному методу на канал (01 §5). Сырой ipcRenderer наружу не выходит. */
const api: Record<string, unknown> = {}
for (const channel of channelNames) {
  api[channel] = (input: unknown) => ipcRenderer.invoke(channel, input)
}

api['on'] = (handler: (event: AppEvent) => void): (() => void) => {
  const listener = (_e: unknown, payload: AppEvent): void => handler(payload)
  ipcRenderer.on('backlog:event', listener)
  return () => {
    ipcRenderer.removeListener('backlog:event', listener)
  }
}

api['versions'] = {
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node
}

contextBridge.exposeInMainWorld('backlog', api)
