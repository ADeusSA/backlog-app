import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { channels, type ChannelInput, type ChannelName, type ChannelOutput } from '@shared/ipc-contract'
import { AppError, serializeError, type IpcResult } from '@shared/errors'
import { log } from '../log'

type Handler<K extends ChannelName> = (
  input: ChannelInput<K>,
  event: IpcMainInvokeEvent
) => ChannelOutput<K> | Promise<ChannelOutput<K>>

const registered = new Set<ChannelName>()

/** Разрешённые источники вызова: только наш renderer (01 §5). */
function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? ''
  return url.startsWith('file://') || url.startsWith('http://localhost') || url.startsWith('devtools://')
}

/**
 * Типизированная регистрация обработчика: валидация входа и выхода zod-схемами
 * из общего контракта, единый формат ошибки.
 */
export function handle<K extends ChannelName>(channel: K, handler: Handler<K>): void {
  if (registered.has(channel)) throw new Error(`Канал ${channel} уже зарегистрирован`)
  registered.add(channel)

  ipcMain.handle(channel, async (event, rawInput: unknown): Promise<IpcResult<unknown>> => {
    try {
      if (!isTrustedSender(event)) {
        throw new AppError('validation', 'Недоверенный источник IPC-вызова')
      }
      const spec = channels[channel]
      const parsedInput = spec.input.safeParse(rawInput)
      if (!parsedInput.success) {
        log.warn(`[ipc] ${channel}: неверный вход`, parsedInput.error.issues)
        throw new AppError('validation', `Неверные аргументы канала ${channel}`, {
          issues: parsedInput.error.issues
        })
      }
      const output = await handler(parsedInput.data as ChannelInput<K>, event)
      return { ok: true, data: output }
    } catch (err) {
      if (!(err instanceof AppError)) log.error(`[ipc] ${channel}`, err)
      return { ok: false, error: serializeError(err) }
    }
  })
}

export function registeredChannels(): ChannelName[] {
  return [...registered]
}

/** Проверка на старте dev-сборки: все каналы контракта реализованы. */
export function assertAllChannelsRegistered(): void {
  const missing = (Object.keys(channels) as ChannelName[]).filter((c) => !registered.has(c))
  if (missing.length > 0) {
    log.warn(`[ipc] не реализованы каналы (${missing.length}): ${missing.join(', ')}`)
  }
}
