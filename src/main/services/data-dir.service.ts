import fs from 'node:fs'
import path from 'node:path'
import { AppError } from '@shared/errors'
import { appBaseDir, paths, portableConfigFile } from '../paths'
import { closeDb } from '../db/connection'
import { log } from '../log'

/**
 * Перенос папки данных (06 §8, «Общие»): копирует содержимое `dataDir` в выбранную
 * папку, переписывает `backlog.config.json` рядом с exe и оставляет старую копию на месте.
 * Перезапуск делает вызывающий IPC-обработчик: пути вычисляются один раз до
 * `app.whenReady()`, поэтому продолжать работу со старым `paths()` нельзя.
 */

export interface MoveDataDirDeps {
  paths: () => ReturnType<typeof paths>
  closeDb: () => void
  configFile: () => string
  baseDir: () => string
}

function defaultDeps(): MoveDataDirDeps {
  return { paths, closeDb, configFile: portableConfigFile, baseDir: appBaseDir }
}

/** Лежит ли `child` внутри `parent` (или совпадает с ним). */
function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function assertWritable(dir: string): void {
  const probe = path.join(dir, `.write-probe-${process.pid}`)
  try {
    fs.writeFileSync(probe, 'x')
    fs.unlinkSync(probe)
  } catch {
    throw new AppError('validation', 'В выбранную папку нельзя писать')
  }
}

export function moveDataDir(targetRaw: string, deps: Partial<MoveDataDirDeps> = {}): { dataDir: string; previousDataDir: string } {
  const d = { ...defaultDeps(), ...deps }
  const p = d.paths()
  const current = path.resolve(p.dataDir)
  const target = path.resolve(targetRaw)

  if (!path.isAbsolute(targetRaw)) throw new AppError('validation', 'Нужен полный путь к папке')
  if (target === current) throw new AppError('validation', 'Данные уже лежат в этой папке')
  // Копирование папки внутрь самой себя разворачивается в бесконечную рекурсию.
  if (isInside(target, current)) {
    throw new AppError('validation', 'Нельзя перенести данные внутрь текущей папки данных')
  }

  fs.mkdirSync(target, { recursive: true })
  assertWritable(target)

  if (fs.existsSync(path.join(target, 'backlog.db'))) {
    throw new AppError('validation', 'В выбранной папке уже есть база Backlog')
  }

  // Соединение закрывается вместе с чекпоинтом WAL, иначе скопируется база без последних записей.
  d.closeDb()

  try {
    fs.cpSync(current, target, {
      recursive: true,
      // cache/ — кеш Chromium: файлы заняты процессом и пересоздаются на новом месте сами.
      filter: (src) => path.resolve(src) !== path.resolve(p.cacheDir)
    })
  } catch (err) {
    log.error('[data-dir] копирование не удалось', err)
    throw new AppError('unknown', 'Не удалось скопировать данные в новую папку')
  }

  // Внутри папки приложения путь сохраняем относительным — иначе portable-копия,
  // перенесённая на другой ПК, продолжит искать данные по чужому абсолютному пути.
  const base = d.baseDir()
  const value = isInside(target, base) ? `./${path.relative(base, target).split(path.sep).join('/')}` : target

  try {
    fs.writeFileSync(d.configFile(), `${JSON.stringify({ dataDir: value }, null, 2)}\n`, 'utf8')
  } catch (err) {
    log.error('[data-dir] не удалось записать backlog.config.json', err)
    throw new AppError('unknown', 'Данные скопированы, но приложение не смогло запомнить новую папку')
  }

  log.info('[data-dir] папка данных перенесена', current, '→', target)
  return { dataDir: target, previousDataDir: current }
}
