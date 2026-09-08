/**
 * HTTP-слой внешних источников (08 §4). Все запросы к провайдерам идут только отсюда,
 * из main-процесса: у IGDB и Steam нет CORS-заголовков, а ключи не должны попадать
 * в renderer (08 §7 п. 4).
 */
import { app } from 'electron'
import { AppError } from '@shared/errors'
import { log } from '../log'

const TIMEOUT_MS = 15_000

/** Контакт в User-Agent — требование Wikidata и хороший тон для остальных (E §3). */
function userAgent(): string {
  const version = (() => {
    try {
      return app.getVersion()
    } catch {
      return '0.0.0'
    }
  })()
  return `BacklogApp/${version} (personal game backlog; +https://github.com/barmin/backlog)`
}

export interface HttpOptions {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  /** Имя источника — попадает в текст ошибки и в лог. */
  label: string
}

/**
 * Одна попытка запроса. 429/403 у Steam означают «сбавь темп», поэтому переводятся
 * в понятную пользователю ошибку с числом секунд, а не в общий сбой сети.
 */
async function once(url: string, options: HttpOptions): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, {
      method: options.method ?? 'GET',
      headers: { 'User-Agent': userAgent(), Accept: 'application/json', ...options.headers },
      ...(options.body === undefined ? {} : { body: options.body }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
  } catch (err) {
    const aborted = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
    throw new AppError(
      'sync_network',
      aborted
        ? `${options.label} не ответил за ${TIMEOUT_MS / 1000} с`
        : `Нет связи с ${options.label}: проверьте интернет`
    )
  }

  if (res.status === 429 || res.status === 403) {
    const retryAfter = Number(res.headers.get('retry-after') ?? '')
    const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : res.status === 429 ? 10 : 300
    throw new AppError('sync_network', `${options.label} временно ограничил запросы. Повторите через ${seconds} с`, {
      retryAfterSeconds: seconds
    })
  }
  if (res.status === 401) {
    throw new AppError('sync_auth', `${options.label} отклонил ключи: проверьте их в настройках`)
  }
  if (!res.ok) {
    throw new AppError('io', `${options.label} ответил ошибкой HTTP ${res.status}`)
  }
  return res
}

/** Запрос с разбором JSON; сетевые сбои повторяются один раз через 700 мс. */
export async function httpJson<T>(url: string, options: HttpOptions): Promise<T> {
  let attempt = 0
  for (;;) {
    try {
      const res = await once(url, options)
      return (await res.json()) as T
    } catch (err) {
      const retriable = err instanceof AppError && err.code === 'sync_network' && !err.details
      if (!retriable || attempt >= 1) throw err
      attempt += 1
      log.warn(`[providers] ${options.label}: повтор запроса после сбоя сети`)
      await new Promise((resolve) => setTimeout(resolve, 700))
    }
  }
}
