import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { AppError } from '@shared/errors'
import { SCHEMA_VERSION } from '@shared/constants'
import { paths } from '../paths'
import { log } from '../log'
import { replaceDbFile, snapshotTo } from '../db/connection'
import { createBackup } from './backups.service'
import { createZip, readZip } from './zip'

/**
 * Экспорт/импорт всех данных в zip (06 §8, 10 §4 A12): снимок базы + папка `images/` целиком.
 * Контейнер — `./zip.ts` (store/deflate на `node:zlib`, без сторонних зависимостей, см. ADR 0003).
 */

const DB_ENTRY = 'backlog.db'
const IMAGES_PREFIX = 'images/'

function listFilesRecursive(dir: string, base: string): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFilesRecursive(full, base))
    else out.push(path.relative(base, full))
  }
  return out
}

export interface ExportResult {
  path: string
  sizeBytes: number
}

interface ExportDeps {
  dbPath: string
  imagesDir: string
  snapshotsDir: string
  snapshotTo: (target: string) => void
}

function defaultExportDeps(): ExportDeps {
  const p = paths()
  return { dbPath: p.dbPath, imagesDir: p.imagesDir, snapshotsDir: p.snapshotsDir, snapshotTo }
}

/** Экспорт: снимок базы (`VACUUM INTO`) + все файлы `images/` — один zip-файл. */
export function exportData(destZipPath: string, deps: Partial<ExportDeps> = {}): ExportResult {
  const d = { ...defaultExportDeps(), ...deps }
  fs.mkdirSync(d.snapshotsDir, { recursive: true })
  const tmpDb = path.join(d.snapshotsDir, 'export.db')
  try {
    d.snapshotTo(tmpDb)
    const entries = [{ name: DB_ENTRY, data: fs.readFileSync(tmpDb) }]
    for (const rel of listFilesRecursive(d.imagesDir, d.imagesDir)) {
      entries.push({ name: `${IMAGES_PREFIX}${rel.replace(/\\/g, '/')}`, data: fs.readFileSync(path.join(d.imagesDir, rel)) })
    }
    const zip = createZip(entries)
    fs.mkdirSync(path.dirname(destZipPath), { recursive: true })
    fs.writeFileSync(destZipPath, zip)
  } finally {
    fs.rmSync(tmpDb, { force: true })
  }
  const sizeBytes = fs.statSync(destZipPath).size
  log.info('[export] экспортировано в', destZipPath, `(${sizeBytes} байт)`)
  return { path: destZipPath, sizeBytes }
}

function assertDbVersionAndIntegrity(dbFilePath: string): void {
  let conn: Database.Database | null = null
  try {
    conn = new Database(dbFilePath, { readonly: true })
    const row = conn.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
      | { value: string }
      | undefined
    const version = row ? Number(row.value) : 0
    if (version > SCHEMA_VERSION) {
      throw new AppError(
        'db_schema_too_new',
        `Импортируемая база создана более новой версией приложения (schema_version=${version}). Обновите приложение.`
      )
    }
    const integrity = conn.prepare('PRAGMA integrity_check').get() as { integrity_check: string }
    if (integrity.integrity_check !== 'ok') {
      throw new AppError('io', 'Импортируемый файл базы повреждён (integrity_check)')
    }
  } finally {
    conn?.close()
  }
}

interface ImportDeps {
  dbPath: string
  imagesDir: string
  backupsDir: string
  snapshotsDir: string
  replaceDbFile: (source: string) => void
}

function defaultImportDeps(): ImportDeps {
  const p = paths()
  return { dbPath: p.dbPath, imagesDir: p.imagesDir, backupsDir: p.backupsDir, snapshotsDir: p.snapshotsDir, replaceDbFile }
}

/** Импорт: проверка версии/целостности → бэкап текущих данных → замена базы и картинок. */
export function importData(srcZipPath: string, deps: Partial<ImportDeps> = {}): { imported: boolean } {
  const d = { ...defaultImportDeps(), ...deps }
  const entries = readZip(fs.readFileSync(srcZipPath))
  const dbEntry = entries.find((e) => e.name === DB_ENTRY)
  if (!dbEntry) throw new AppError('validation', 'В архиве не найден backlog.db — это не экспорт из Backlog')

  fs.mkdirSync(d.snapshotsDir, { recursive: true })
  const tmpDb = path.join(d.snapshotsDir, 'import.db')
  fs.writeFileSync(tmpDb, dbEntry.data)
  try {
    assertDbVersionAndIntegrity(tmpDb)

    if (fs.existsSync(d.dbPath)) {
      try {
        createBackup('manual', d.backupsDir)
      } catch (err) {
        log.warn('[import] не удалось создать бэкап текущей базы перед импортом (продолжаем)', err)
      }
    }

    d.replaceDbFile(tmpDb)

    const imageEntries = entries.filter((e) => e.name.startsWith(IMAGES_PREFIX) && e.name.length > IMAGES_PREFIX.length)
    for (const entry of imageEntries) {
      const dest = path.join(d.imagesDir, entry.name.slice(IMAGES_PREFIX.length))
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.writeFileSync(dest, entry.data)
    }
    log.info('[import] импортировано', imageEntries.length, 'изображений из', srcZipPath)
    return { imported: true }
  } finally {
    fs.rmSync(tmpDb, { force: true })
  }
}
