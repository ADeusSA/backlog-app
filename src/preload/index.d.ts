import type { AppEvent, ChannelInput, ChannelName, ChannelOutput } from '../shared/ipc-contract'
import type { IpcResult } from '../shared/errors'

export type BacklogApi = {
  [K in ChannelName]: (input: ChannelInput<K>) => Promise<IpcResult<ChannelOutput<K>>>
} & {
  on(handler: (event: AppEvent) => void): () => void
  versions: { electron: string; chrome: string; node: string }
}

declare global {
  interface Window {
    backlog: BacklogApi
  }
}

export {}
