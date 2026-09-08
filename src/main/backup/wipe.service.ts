import fs from 'node:fs'
import path from 'node:path'
import { paths } from '../paths'
import { log } from '../log'
import { closeDb } from '../db/connection'
import { resetSettingsCache } from '../services/settings.service'

/**
 * `data.wipe` (06 §8, 01 §14): удаляет базу, картинки, бэкапы и состояние синхронизации
 * (включая зашифрованный токен в `sync/token.bin`). Подтверждение `confirm === 'УДАЛИТЬ'`
 * проверяется в IPC-обработчике; здесь — только сама операция.
 */

interface WipeDeps {
  paths: () => ReturnType<typeof paths>
  closeDb: () => void
}

function defaultDeps(): WipeDeps {
  return { paths, closeDb }
}

function removeIfExists(target: string): void {
  try {
    if (fs.existsSync(target)) fs.rmSync(target, { force: true })
  } catch (err) {
    log.warn('[wipe] не удалось удалить файл', target, err)
  }
}

function removeDirContents(dir: string): void {
  try {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir)) {
      fs.rmSync(path.join(dir, entry), { recursive: true, force: true })
    }
  } catch (err) {
    log.warn('[wipe] не удалось очистить папку', dir, err)
  }
}

export function wipeAllData(deps: Partial<WipeDeps> = {}): void {
  const d = { ...defaultDeps(), ...deps }
  const p = d.paths()

  d.closeDb()
  removeIfExists(p.dbPath)
  removeIfExists(`${p.dbPath}-wal`)
  removeIfExists(`${p.dbPath}-shm`)
  removeDirContents(p.imagesDir)
  removeDirContents(p.backupsDir)
  // sync/ содержит token.bin (шифрованный refresh-токен), state.json, log.json, snapshots/.
  removeDirContents(p.syncDir)
  // providers/ — зашифрованные ключи внешних источников и кеш их ответов (08 §4).
  removeDirContents(p.providersDir)
  // settings.json целиком, а не только sync-часть: после полного удаления данных пользователь
  // должен снова пройти мастер первого запуска, а не увидеть «синхронизация включена» без токена.
  removeIfExists(path.join(p.dataDir, 'settings.json'))
  resetSettingsCache()

  log.warn('[wipe] все локальные данные удалены по запросу пользователя')
}
