import { uuidv7 } from 'uuidv7'

/** Новый идентификатор сущности — UUID v7 в нижнем регистре (02 §1). */
export function newId(): string {
  return uuidv7().toLowerCase()
}

/** Момент времени ISO 8601 UTC с миллисекундами. */
export function now(): string {
  return new Date().toISOString()
}

/** Сегодняшняя дата YYYY-MM-DD в локальной зоне пользователя. */
export function today(): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function toBool(value: unknown): boolean {
  return value === 1 || value === true || value === '1'
}

export function fromBool(value: boolean | undefined | null): 0 | 1 {
  return value ? 1 : 0
}

/** JSON.parse с безопасным значением по умолчанию. */
export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
