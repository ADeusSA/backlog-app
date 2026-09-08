import { describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { createTestDb } from '../helpers/test-db'
import { resolveImportedEntities } from '../../src/main/services/import-entities.service'
import { applySaveGame } from '../../src/main/services/catalog-games.service'
import { gameInputSchema } from '../../src/shared/schema/entities'
import type { Db } from '../../src/main/db/connection'

/**
 * Приёмка 08 §7 п. 2 и п. 5: импорт не создаёт дубликаты справочников и не трогает
 * поля, которых в нём не было (они остаются заблокированными как ручной ввод).
 */

const ref = (slug: string, name: string): { slug: string; name: string } => ({ slug, name })

const EMPTY = {
  developers: [],
  publishers: [],
  genres: [],
  platforms: [],
  modes: [],
  tags: [],
  series: null
}

function countOf(db: Database.Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
}

describe('resolveImportedEntities', () => {
  it('находит существующие жанры и режимы по slug, не создавая новых', () => {
    const db = createTestDb()
    const before = countOf(db, 'genres')

    const resolved = resolveImportedEntities(db as unknown as Db, {
      ...EMPTY,
      // Так их называет Steam/IGDB; в каталоге они лежат как «Экшен» и «RPG».
      genres: [ref('action', 'Action'), ref('rpg', 'Role-playing (RPG)')],
      modes: [ref('single-player', 'Single-player')]
    })

    expect(resolved.genreIds).toHaveLength(2)
    expect(countOf(db, 'genres')).toBe(before)
    const names = db
      .prepare(`SELECT name FROM genres WHERE id IN (${resolved.genreIds.map(() => '?').join(',')}) ORDER BY name`)
      .all(...resolved.genreIds) as Array<{ name: string }>
    expect(names.map((r) => r.name)).toEqual(['RPG', 'Экшен'])
  })

  it('создаёт то, чего в каталоге нет, и переиспользует при повторном импорте', () => {
    const db = createTestDb()

    const first = resolveImportedEntities(db as unknown as Db, {
      ...EMPTY,
      developers: [ref('fromsoftware', 'FromSoftware')],
      genres: [ref('immersive-sim', 'Immersive sim')]
    })
    expect(first.developerIds).toHaveLength(1)

    const second = resolveImportedEntities(db as unknown as Db, {
      ...EMPTY,
      developers: [ref('fromsoftware', 'FromSoftware')],
      genres: [ref('immersive-sim', 'Immersive sim')]
    })
    expect(second.developerIds).toEqual(first.developerIds)
    expect(second.genreIds).toEqual(first.genreIds)
    expect(countOf(db, 'companies')).toBe(1)
  })

  it('студии, пришедшей и как разработчик, и как издатель, ставит обе роли', () => {
    const db = createTestDb()
    resolveImportedEntities(db as unknown as Db, { ...EMPTY, developers: [ref('fromsoftware', 'FromSoftware, Inc.')] })
    resolveImportedEntities(db as unknown as Db, { ...EMPTY, publishers: [ref('fromsoftware', 'FromSoftware, Inc.')] })

    const row = db.prepare('SELECT is_developer, is_publisher FROM companies').get() as {
      is_developer: number
      is_publisher: number
    }
    expect(row).toEqual({ is_developer: 1, is_publisher: 1 })
    expect(countOf(db, 'companies')).toBe(1)
  })

  it('платформе, которой нет в каталоге, подбирает семейство по названию', () => {
    const db = createTestDb()
    const resolved = resolveImportedEntities(db as unknown as Db, {
      ...EMPTY,
      platforms: [ref('atari-2600', 'Atari 2600'), ref('playstation-portal', 'PlayStation Portal')]
    })
    const rows = db
      .prepare(`SELECT name, family FROM platforms WHERE id IN (${resolved.platformIds.map(() => '?').join(',')})`)
      .all(...resolved.platformIds) as Array<{ name: string; family: string }>
    expect(rows.find((r) => r.name === 'Atari 2600')?.family).toBe('other')
    expect(rows.find((r) => r.name === 'PlayStation Portal')?.family).toBe('playstation')
  })
})

describe('applySaveGame с импортом', () => {
  const input = gameInputSchema.parse({
    title: 'Elden Ring',
    createEntities: {
      ...EMPTY,
      developers: [ref('fromsoftware', 'FromSoftware')],
      genres: [ref('action', 'Action')],
      series: ref('elden-ring', 'Elden Ring')
    },
    provenance: [
      {
        provider: 'steam',
        externalId: '1245620',
        url: 'https://store.steampowered.com/app/1245620',
        rawHash: 'abc123',
        rawJson: '{"name":"ELDEN RING"}',
        fields: ['title', 'summary', 'metacriticScore', 'genres', 'developers']
      }
    ]
  })

  it('создаёт связи и записывает external_ids', () => {
    const db = createTestDb()
    const id = applySaveGame(db as unknown as Db, input)

    const genres = db.prepare('SELECT COUNT(*) AS n FROM game_genres WHERE game_id = ?').get(id) as { n: number }
    expect(genres.n).toBe(1)
    const companies = db.prepare('SELECT COUNT(*) AS n FROM game_companies WHERE game_id = ?').get(id) as { n: number }
    expect(companies.n).toBe(1)
    const series = db.prepare('SELECT COUNT(*) AS n FROM series_games WHERE game_id = ?').get(id) as { n: number }
    expect(series.n).toBe(1)

    const external = db.prepare('SELECT * FROM external_ids WHERE entity_id = ?').get(id) as {
      provider: string
      external_id: string
      raw_hash: string
    }
    expect(external.provider).toBe('steam')
    expect(external.external_id).toBe('1245620')
    expect(external.raw_hash).toBe('abc123')
  })

  it('поля из источника не блокирует, остальные помечает ручными', () => {
    const db = createTestDb()
    const id = applySaveGame(db as unknown as Db, input)

    const rows = db.prepare('SELECT field, provider, locked FROM field_provenance WHERE entity_id = ?').all(id) as Array<{
      field: string
      provider: string
      locked: number
    }>
    const byField = new Map(rows.map((row) => [row.field, row]))

    // Пришло из Steam — источник может обновить в следующий раз.
    expect(byField.get('title')).toMatchObject({ provider: 'steam', locked: 0 })
    expect(byField.get('metacriticScore')).toMatchObject({ provider: 'steam', locked: 0 })
    // Не приходило — считаем ручным вводом и защищаем от перезаписи.
    expect(byField.get('storyline')).toMatchObject({ provider: 'manual', locked: 1 })
    expect(byField.get('hltb')).toMatchObject({ provider: 'manual', locked: 1 })
  })

  it('повторное сохранение обновляет ту же строку external_ids, а не добавляет вторую', () => {
    const db = createTestDb()
    const id = applySaveGame(db as unknown as Db, input)
    applySaveGame(db as unknown as Db, {
      ...input,
      id,
      provenance: [{ ...input.provenance![0]!, rawHash: 'def456' }]
    })

    const rows = db.prepare('SELECT raw_hash FROM external_ids WHERE entity_id = ?').all(id) as Array<{ raw_hash: string }>
    expect(rows).toHaveLength(1)
    expect(rows[0]?.raw_hash).toBe('def456')
  })
})
