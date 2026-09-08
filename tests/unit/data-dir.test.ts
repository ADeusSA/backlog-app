import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { moveDataDir, type MoveDataDirDeps } from '../../src/main/services/data-dir.service'
import { AppError } from '../../src/shared/errors'

const roots: string[] = []

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'backlog-move-'))
  roots.push(root)
  return root
}

/** Папка данных с базой, картинкой, кешем Chromium и конфигом рядом с «exe». */
function scenario(): { deps: Partial<MoveDataDirDeps>; base: string; dataDir: string; configFile: string } {
  const base = makeRoot()
  const dataDir = path.join(base, 'data')
  const cacheDir = path.join(dataDir, 'cache')
  fs.mkdirSync(path.join(dataDir, 'images', 'ab'), { recursive: true })
  fs.mkdirSync(cacheDir, { recursive: true })
  fs.writeFileSync(path.join(dataDir, 'backlog.db'), 'db')
  fs.writeFileSync(path.join(dataDir, 'settings.json'), '{}')
  fs.writeFileSync(path.join(dataDir, 'images', 'ab', 'cover.webp'), 'img')
  fs.writeFileSync(path.join(cacheDir, 'chromium.bin'), 'cache')
  const configFile = path.join(base, 'backlog.config.json')

  return {
    base,
    dataDir,
    configFile,
    deps: {
      paths: () => ({ dataDir, cacheDir }) as ReturnType<MoveDataDirDeps['paths']>,
      closeDb: () => undefined,
      configFile: () => configFile,
      baseDir: () => base
    }
  }
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('перенос папки данных (06 §8)', () => {
  it('копирует базу и картинки, но не кеш Chromium', () => {
    const s = scenario()
    const target = path.join(s.base, 'moved')

    const result = moveDataDir(target, s.deps)

    expect(result.dataDir).toBe(target)
    expect(fs.readFileSync(path.join(target, 'backlog.db'), 'utf8')).toBe('db')
    expect(fs.readFileSync(path.join(target, 'images', 'ab', 'cover.webp'), 'utf8')).toBe('img')
    expect(fs.existsSync(path.join(target, 'cache'))).toBe(false)
    // Старая копия остаётся на месте: пользователь удаляет её сам.
    expect(fs.existsSync(path.join(s.dataDir, 'backlog.db'))).toBe(true)
  })

  it('внутри папки приложения запоминает относительный путь', () => {
    const s = scenario()
    moveDataDir(path.join(s.base, 'moved'), s.deps)
    expect(JSON.parse(fs.readFileSync(s.configFile, 'utf8'))).toEqual({ dataDir: './moved' })
  })

  it('вне папки приложения запоминает абсолютный путь', () => {
    const s = scenario()
    const outside = path.join(makeRoot(), 'elsewhere')
    moveDataDir(outside, s.deps)
    expect(JSON.parse(fs.readFileSync(s.configFile, 'utf8'))).toEqual({ dataDir: outside })
  })

  it('не переносит папку внутрь самой себя', () => {
    const s = scenario()
    expect(() => moveDataDir(path.join(s.dataDir, 'inner'), s.deps)).toThrow(AppError)
    expect(() => moveDataDir(s.dataDir, s.deps)).toThrow(AppError)
  })

  it('отказывается писать поверх чужой базы', () => {
    const s = scenario()
    const target = path.join(s.base, 'occupied')
    fs.mkdirSync(target, { recursive: true })
    fs.writeFileSync(path.join(target, 'backlog.db'), 'other')

    expect(() => moveDataDir(target, s.deps)).toThrow(AppError)
    expect(fs.readFileSync(path.join(target, 'backlog.db'), 'utf8')).toBe('other')
    expect(fs.existsSync(s.configFile)).toBe(false)
  })

  it('требует полный путь', () => {
    const s = scenario()
    expect(() => moveDataDir('relative/dir', s.deps)).toThrow(AppError)
  })
})
