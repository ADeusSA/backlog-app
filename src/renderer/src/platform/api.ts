import { AppError } from '@shared/errors'
import type { ChannelInput, ChannelName, ChannelOutput } from '@shared/ipc-contract'

/**
 * Единственная точка обращения renderer к backend (01 §5).
 * Разворачивает `IpcResult` и бросает `AppError`, чтобы вызывающий код работал с обычными промисами.
 */
export async function call<K extends ChannelName>(
  channel: K,
  ...args: undefined extends ChannelInput<K> ? [input?: ChannelInput<K>] : [input: ChannelInput<K>]
): Promise<ChannelOutput<K>> {
  const bridge = window.backlog
  if (!bridge) throw new AppError('unknown', 'Мост IPC недоступен')
  const fn = bridge[channel] as (input: unknown) => Promise<unknown>
  const result = (await fn(args[0])) as
    | { ok: true; data: ChannelOutput<K> }
    | { ok: false; error: { code: never; message: string; details?: Record<string, unknown> } }
  if (!result.ok) throw new AppError(result.error.code, result.error.message, result.error.details)
  return result.data
}

export const versions = (): { electron: string; chrome: string; node: string } =>
  window.backlog?.versions ?? { electron: '', chrome: '', node: '' }
