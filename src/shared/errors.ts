/** Коды ошибок приложения; локализуются в UI по ключу `error.<code>` (01 §14). */
export const ERROR_CODES = [
  'unknown',
  'validation',
  'not_found',
  'conflict',
  'constraint',
  'company_has_games',
  'duplicate_slug',
  'db_locked',
  'db_schema_too_new',
  'image_too_large',
  'image_unsupported',
  'io',
  'sync_auth',
  'sync_network',
  'sync_conflict',
  'sync_disabled',
  'not_implemented'
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export class AppError extends Error {
  readonly code: ErrorCode
  readonly details?: Record<string, unknown>

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'AppError'
    this.code = code
    this.details = details
  }
}

export interface SerializedError {
  code: ErrorCode
  message: string
  details?: Record<string, unknown>
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: SerializedError }

export function serializeError(err: unknown): SerializedError {
  if (err instanceof AppError) {
    return { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) }
  }
  if (err instanceof Error) return { code: 'unknown', message: err.message }
  return { code: 'unknown', message: String(err) }
}
