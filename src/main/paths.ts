import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Portable-режим и папка данных (01 §8).
 * Рядом с exe лежит `backlog.config.json` вида { "dataDir": "./data" }.
 * Логика выполняется ДО app.whenReady(), потому что переопределяет userData/sessionData.
 */

interface PortableConfig {
  dataDir: string
}

const CONFIG_NAME = 'backlog.config.json'

let resolved: {
  dataDir: string
  dbPath: string
  imagesDir: string
  backupsDir: string
  logsDir: string
  syncDir: string
  snapshotsDir: string
  cacheDir: string
  providersDir: string
  portable: boolean
} | null = null

function baseDir(): string {
  // В упакованном виде — папка с exe; в dev — корень проекта.
  return app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath()
}

function isWritable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true })
    const probe = path.join(dir, `.write-probe-${process.pid}`)
    fs.writeFileSync(probe, 'x')
    fs.unlinkSync(probe)
    return true
  } catch {
    return false
  }
}

function readConfig(dir: string): PortableConfig | null {
  try {
    const raw = fs.readFileSync(path.join(dir, CONFIG_NAME), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && typeof (parsed as PortableConfig).dataDir === 'string') {
      return parsed as PortableConfig
    }
  } catch {
    /* нет конфига — не ошибка */
  }
  return null
}

/** Вычисляет и создаёт все пути. Вызывать один раз до `app.whenReady()`. */
export function resolvePaths(): NonNullable<typeof resolved> {
  if (resolved) return resolved

  const exeDir = baseDir()
  let dataDir: string
  let portable = true

  const cfg = readConfig(exeDir)
  if (cfg) {
    dataDir = path.isAbsolute(cfg.dataDir) ? cfg.dataDir : path.resolve(exeDir, cfg.dataDir)
  } else if (isWritable(exeDir)) {
    dataDir = path.join(exeDir, 'data')
    try {
      fs.writeFileSync(
        path.join(exeDir, CONFIG_NAME),
        `${JSON.stringify({ dataDir: './data' }, null, 2)}\n`,
        'utf8'
      )
    } catch {
      /* не критично */
    }
  } else {
    dataDir = path.join(app.getPath('appData'), 'Backlog', 'data')
    portable = false
  }

  const dirs = {
    dataDir,
    dbPath: path.join(dataDir, 'backlog.db'),
    imagesDir: path.join(dataDir, 'images'),
    backupsDir: path.join(dataDir, 'backups'),
    logsDir: path.join(dataDir, 'logs'),
    syncDir: path.join(dataDir, 'sync'),
    snapshotsDir: path.join(dataDir, 'sync', 'snapshots'),
    cacheDir: path.join(dataDir, 'cache'),
    // Ключи источников и кеш их ответов (08 §4): локально, вне бэкапов и синхронизации.
    providersDir: path.join(dataDir, 'providers'),
    portable
  }

  for (const dir of [
    dirs.dataDir,
    dirs.imagesDir,
    dirs.backupsDir,
    dirs.logsDir,
    dirs.syncDir,
    dirs.snapshotsDir,
    dirs.cacheDir,
    dirs.providersDir
  ]) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Кеш Chromium — внутри data/, но вне бэкапов и синхронизации.
  app.setPath('userData', dirs.cacheDir)
  app.setPath('sessionData', dirs.cacheDir)

  resolved = dirs
  return dirs
}

export function paths(): NonNullable<typeof resolved> {
  if (!resolved) return resolvePaths()
  return resolved
}

/** Путь к файлу изображения по относительному имени `ab/uuid.webp`. */
export function imagePath(fileName: string): string {
  return path.join(paths().imagesDir, fileName)
}

/** Папка внешних источников: ключи и кеш ответов (08 §4). */
export function providersDir(): string {
  return paths().providersDir
}

export function settingsFile(): string {
  return path.join(paths().dataDir, 'settings.json')
}
