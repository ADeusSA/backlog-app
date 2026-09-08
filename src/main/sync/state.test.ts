import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  appendSyncLog,
  buildHistorySnapshotName,
  decideInitialReconciliation,
  decideSync,
  defaultSyncState,
  diffImages,
  findRemoteNamesForDeletedIds,
  isValidManifest,
  pruneToKeep,
  readSyncLog,
  readSyncState,
  writeSyncState
} from './state'

describe('decideSync (03 §4-§5)', () => {
  const base = { knownSchemaVersion: 2, remoteSchemaVersion: 2 }

  it('noop, когда ничего не менялось ни локально, ни в облаке', () => {
    expect(
      decideSync({ ...base, localRevision: 5, lastPushedRevision: 5, baseRevision: 10, remoteRevision: 10 })
    ).toEqual({ action: 'noop' })
  })

  it('push, когда облако не менялось, но есть локальные изменения', () => {
    expect(
      decideSync({ ...base, localRevision: 6, lastPushedRevision: 5, baseRevision: 10, remoteRevision: 10 })
    ).toEqual({ action: 'push' })
  })

  it('pull, когда облако менялось, а локальных изменений нет', () => {
    expect(
      decideSync({ ...base, localRevision: 5, lastPushedRevision: 5, baseRevision: 10, remoteRevision: 12 })
    ).toEqual({ action: 'pull' })
  })

  it('conflict, когда менялись оба', () => {
    expect(
      decideSync({ ...base, localRevision: 6, lastPushedRevision: 5, baseRevision: 10, remoteRevision: 12 })
    ).toEqual({ action: 'conflict' })
  })

  it('schema_too_new важнее любого другого решения', () => {
    expect(
      decideSync({
        knownSchemaVersion: 2,
        remoteSchemaVersion: 3,
        localRevision: 6,
        lastPushedRevision: 5,
        baseRevision: 10,
        remoteRevision: 12
      })
    ).toEqual({ action: 'schema_too_new', remoteSchemaVersion: 3 })
  })

  it('откат ревизии в облаке (< base) тоже трактуется как «изменения есть»', () => {
    expect(
      decideSync({ ...base, localRevision: 5, lastPushedRevision: 5, baseRevision: 10, remoteRevision: 3 })
    ).toEqual({ action: 'pull' })
  })
})

describe('decideInitialReconciliation (03 §5.4)', () => {
  it('push, если в облаке ничего нет', () => {
    expect(decideInitialReconciliation({ remoteExists: false, localRevision: 40 })).toBe('push')
  })

  it('pull без вопросов, если локальная база пустая (только сид)', () => {
    expect(decideInitialReconciliation({ remoteExists: true, localRevision: 0 })).toBe('pull')
  })

  it('ask, если обе базы непустые', () => {
    expect(decideInitialReconciliation({ remoteExists: true, localRevision: 42 })).toBe('ask')
  })

  it('уважает нестандартную сидовую ревизию', () => {
    expect(decideInitialReconciliation({ remoteExists: true, localRevision: 3, seedRevision: 5 })).toBe('pull')
    expect(decideInitialReconciliation({ remoteExists: true, localRevision: 6, seedRevision: 5 })).toBe('ask')
  })
})

describe('diffImages (03 §5.3)', () => {
  it('вычисляет докачку/выгрузку по именам без хешей', () => {
    const result = diffImages(['a.webp', 'b.webp'], ['b.webp', 'c.webp'])
    expect(result.toUpload).toEqual(['a.webp'])
    expect(result.toDownload).toEqual(['c.webp'])
  })

  it('пустые списки дают пустой результат', () => {
    expect(diffImages([], [])).toEqual({ toUpload: [], toDownload: [] })
  })
})

describe('pruneToKeep', () => {
  it('оставляет только первые keep элементов', () => {
    expect(pruneToKeep(['1', '2', '3', '4'], 2)).toEqual({ toRemove: ['3', '4'] })
  })

  it('ничего не удаляет, если элементов меньше или равно keep', () => {
    expect(pruneToKeep(['1', '2'], 10)).toEqual({ toRemove: [] })
  })
})

describe('findRemoteNamesForDeletedIds', () => {
  it('находит по префиксу id независимо от расширения', () => {
    const remote = ['abc.webp', 'def.png', 'ghi.webp']
    expect(findRemoteNamesForDeletedIds(['abc', 'ghi'], remote)).toEqual(['abc.webp', 'ghi.webp'])
  })

  it('не находит ложных совпадений по частичному префиксу', () => {
    expect(findRemoteNamesForDeletedIds(['ab'], ['abc.webp'])).toEqual([])
  })
})

describe('buildHistorySnapshotName', () => {
  it('форматирует имя по образцу из 03 §3', () => {
    const name = buildHistorySnapshotName('2026-09-07T12:31:05.120Z', 1532, 'DESKTOP-BARMIN')
    expect(name).toBe('backlog-2026-09-07T12-31-05Z-r1532-DESKTOP-BARMIN.db')
  })

  it('заменяет недопустимые символы в имени устройства', () => {
    const name = buildHistorySnapshotName('2026-01-01T00:00:00.000Z', 1, 'моё ПК/1')
    // Точка допустима только в расширении; в самом имени — только латиница, цифры, дефис и подчёркивание.
    expect(name).toMatch(/^backlog-[0-9T-]+Z-r\d+-[A-Za-z0-9_-]+\.db$/)
    expect(name).not.toContain('/')
  })
})

describe('isValidManifest', () => {
  it('принимает корректный манифест', () => {
    expect(
      isValidManifest({
        format: 1,
        schemaVersion: 2,
        revision: 1,
        deviceId: 'd1',
        deviceName: 'PC',
        updatedAt: '2026-01-01T00:00:00.000Z',
        db: { fileId: 'f1', sha256: 'abc', sizeBytes: 10 },
        images: { count: 0, totalBytes: 0 },
        appVersion: '1.0.0'
      })
    ).toBe(true)
  })

  it('отклоняет мусор', () => {
    expect(isValidManifest(null)).toBe(false)
    expect(isValidManifest({})).toBe(false)
    expect(isValidManifest({ schemaVersion: 2, revision: 1 })).toBe(false)
  })
})

describe('файлы state.json и log.json', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backlog-sync-state-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('readSyncState возвращает значения по умолчанию, если файла нет', () => {
    expect(readSyncState(dir)).toEqual(defaultSyncState())
  })

  it('writeSyncState/readSyncState — round-trip', () => {
    const state = {
      ...defaultSyncState(),
      folderId: 'F1',
      base: { revision: 5, sha256: 'x', updatedAt: '2026-01-01T00:00:00.000Z' },
      lastPushedRevision: 5,
      remoteImages: ['a.webp']
    }
    writeSyncState(state, dir)
    expect(readSyncState(dir)).toEqual(state)
  })

  it('readSyncState устойчив к повреждённому файлу', () => {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'state.json'), '{ не json')
    expect(readSyncState(dir)).toEqual(defaultSyncState())
  })

  it('appendSyncLog обрезает журнал до 20 записей', () => {
    let list: ReturnType<typeof readSyncLog> = []
    for (let i = 0; i < 25; i++) {
      list = appendSyncLog({ at: `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z`, kind: 'push', message: `#${i}` }, dir)
    }
    expect(list).toHaveLength(20)
    expect(list[0]?.message).toBe('#5')
    expect(list.at(-1)?.message).toBe('#24')
    expect(readSyncLog(dir)).toEqual(list)
  })
})
