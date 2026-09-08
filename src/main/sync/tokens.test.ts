import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '@shared/errors'
import {
  clearCachedAccessToken,
  clearRefreshToken,
  getCachedAccessToken,
  hasStoredRefreshToken,
  isEncryptionAvailable,
  loadRefreshToken,
  saveRefreshToken,
  setCachedAccessToken
} from './tokens'

// В юнит-тестах `electron` подменена заглушкой (tests/stubs/electron.ts), где
// `safeStorage.isEncryptionAvailable()` всегда возвращает false — так и должно быть отражено
// в поведении: сохранить токен нельзя, синхронизация должна сообщать об этом явно (01 §10).

describe('tokens.ts — safeStorage недоступен (окружение теста)', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backlog-tokens-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('isEncryptionAvailable() отражает состояние safeStorage', () => {
    expect(isEncryptionAvailable()).toBe(false)
  })

  it('saveRefreshToken бросает sync_disabled, если шифрование недоступно', () => {
    try {
      saveRefreshToken('secret', dir)
      expect.unreachable('должен был бросить исключение')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).code).toBe('sync_disabled')
    }
    expect(hasStoredRefreshToken(dir)).toBe(false)
  })

  it('loadRefreshToken возвращает null при отсутствии файла', () => {
    expect(loadRefreshToken(dir)).toBeNull()
  })

  it('loadRefreshToken возвращает null, если файл есть, но расшифровать нельзя', () => {
    fs.writeFileSync(path.join(dir, 'token.bin'), Buffer.from('garbage'))
    expect(loadRefreshToken(dir)).toBeNull()
  })

  it('clearRefreshToken не падает, если файла нет', () => {
    expect(() => clearRefreshToken(dir)).not.toThrow()
  })
})

describe('кеш access-токена (в памяти, не зависит от safeStorage)', () => {
  afterEach(() => {
    clearCachedAccessToken()
  })

  it('возвращает null, пока токен не установлен', () => {
    expect(getCachedAccessToken()).toBeNull()
  })

  it('возвращает установленный токен до истечения срока', () => {
    const now = 1_000_000
    setCachedAccessToken('tok', 3600, now)
    expect(getCachedAccessToken(now + 1000)).toBe('tok')
  })

  it('перестаёт отдавать токен за 30с до истечения (запас)', () => {
    const now = 1_000_000
    setCachedAccessToken('tok', 60, now)
    expect(getCachedAccessToken(now + 40_000)).toBeNull()
  })

  it('clearCachedAccessToken сбрасывает кеш', () => {
    setCachedAccessToken('tok', 3600)
    clearCachedAccessToken()
    expect(getCachedAccessToken()).toBeNull()
  })
})
