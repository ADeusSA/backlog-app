/**
 * Ключи внешних источников (08 §4 «Секреты»). Хранятся зашифрованными средствами ОС
 * (`safeStorage`, на Windows это DPAPI) в `<dataDir>/providers/credentials.bin`.
 *
 * Никогда не попадают в `backlog.db`, `settings.json`, логи и экспорт данных, и никогда
 * не передаются в renderer: наружу отдаётся только флаг «ключи заданы».
 */
import fs from 'node:fs'
import path from 'node:path'
import { safeStorage } from 'electron'
import { AppError } from '@shared/errors'
import type { ImportProvider } from '@shared/constants'
import { providersDir } from '../paths'
import { log } from '../log'

export interface Credentials {
  /** IGDB — Client ID приложения Twitch; RAWG — сам ключ (второго поля у него нет). */
  clientId: string
  clientSecret?: string
}

type Store = Partial<Record<ImportProvider, Credentials>>

function file(): string {
  return path.join(providersDir(), 'credentials.bin')
}

export function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

function readStore(): Store {
  try {
    const target = file()
    if (!fs.existsSync(target)) return {}
    if (!isEncryptionAvailable()) return {}
    return JSON.parse(safeStorage.decryptString(fs.readFileSync(target))) as Store
  } catch (err) {
    log.warn('[providers] не удалось прочитать ключи источников', err)
    return {}
  }
}

function writeStore(store: Store): void {
  if (!isEncryptionAvailable()) {
    throw new AppError(
      'io',
      'Защищённое хранилище Windows (DPAPI) недоступно — ключи негде сохранить в зашифрованном виде.'
    )
  }
  const dir = providersDir()
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file(), safeStorage.encryptString(JSON.stringify(store)))
}

export function getCredentials(provider: ImportProvider): Credentials | null {
  return readStore()[provider] ?? null
}

export function setCredentials(provider: ImportProvider, value: Credentials): void {
  const store = readStore()
  store[provider] = {
    clientId: value.clientId.trim(),
    ...(value.clientSecret ? { clientSecret: value.clientSecret.trim() } : {})
  }
  writeStore(store)
}

export function clearCredentials(provider: ImportProvider): void {
  const store = readStore()
  delete store[provider]
  writeStore(store)
}

/** Есть ли файл ключей вообще — для `data.wipe` и раздела настроек. */
export function credentialsFileExists(): boolean {
  return fs.existsSync(file())
}

export function deleteCredentialsFile(): void {
  try {
    if (credentialsFileExists()) fs.rmSync(file(), { force: true })
  } catch (err) {
    log.warn('[providers] не удалось удалить файл ключей', err)
  }
}
