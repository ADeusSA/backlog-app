/**
 * Бизнес-правила формы игры каталога (06 §7.3, 02 §4): слаг/sort_title, release_year,
 * происхождение полей, поддержка поиска, лог активности, автосоздание в библиотеке.
 */
import { getDb, write } from '../db/connection'
import type { Db } from '../db/connection'
import { newId, now } from '../db/utils'
import { ensureUniqueSlug, makeSlug, makeSortTitle, yearFromDate } from '@shared/text'
import { AppError } from '@shared/errors'
import {
  deleteGameRow,
  findSimilarTitles,
  gameExists,
  getGameEditData,
  insertGameRow,
  quickSearchGames,
  setGameCompanyLinks,
  setGameGenreLinks,
  setGameModeLinks,
  setGamePlatformLinks,
  setGameSeriesLink,
  slugTaken,
  updateGameRow,
  type GameWriteColumns
} from '../db/repositories/games.repo'
import { setGameTags } from '../db/repositories/taxonomy.repo'
import { deleteEntity } from '../db/connection'
import { removeFromSearchIndex, upsertSearchIndex } from './search-index.service'
import { lockManualFields, markImportedFields, saveExternalId } from './field-provenance.service'
import { IMPORT_TABLES, resolveImportedEntities } from './import-entities.service'
import { ensureUserGame } from './user-game.service'
import type { GameCardDto, GameInput } from '@shared/schema/entities'
import { gameInputSchema } from '@shared/schema/entities'

/**
 * Поля, чьё происхождение отслеживаем (02 §3.11). Названия совпадают со строками
 * диалога импорта (`FieldId` в renderer): что пришло из источника — помечается им,
 * что не пришло — считается ручным вводом и блокируется от перезаписи.
 */
const TRACKED_FIELDS = [
  'title',
  'altTitles',
  'category',
  'releaseDate',
  'releaseStatus',
  'summary',
  'storyline',
  'ageRating',
  'website',
  'coverImageId',
  'backdropImageId',
  'logoImageId',
  'metacriticScore',
  'hltb',
  'developers',
  'publishers',
  'genres',
  'platforms',
  'modes',
  'tags',
  'series'
]

export function getGameForEdit(id: string): GameInput | null {
  const conn = getDb()
  const data = getGameEditData(conn, id)
  if (!data) return null
  return gameInputSchema.parse({
    id,
      title: data.title,
      sortTitle: data.sortTitle,
      slug: data.slug,
      altTitles: data.altTitles,
      category: data.category,
      parentGameId: data.parentGameId,
      releaseDate: data.releaseDate,
      releaseDatePrecision: data.releaseDatePrecision,
      releaseStatus: data.releaseStatus,
      summary: data.summary,
      storyline: data.storyline,
      coverImageId: data.coverImageId,
      backdropImageId: data.backdropImageId,
      logoImageId: data.logoImageId,
      metacriticScore: data.metacriticScore,
      metacriticUrl: data.metacriticUrl,
      opencriticScore: data.opencriticScore,
      hltbMainMin: data.hltbMainMin,
      hltbExtraMin: data.hltbExtraMin,
      hltbCompleteMin: data.hltbCompleteMin,
      ageRating: data.ageRating,
      website: data.website,
      developerIds: data.developerIds,
      publisherIds: data.publisherIds,
      supportingIds: data.supportingIds,
      portingIds: data.portingIds,
      genreIds: data.genreIds,
      primaryGenreId: data.primaryGenreId,
      platformIds: data.platformIds,
      modeIds: data.modeIds,
      tagIds: data.tagIds,
    seriesId: data.seriesId,
    seriesPosition: data.seriesPosition
  })
}

/**
 * Чистое сохранение игры на уже открытом соединении — используется и `write()`-обёрткой,
 * и юнит-тестами (10 §3 п.4: тесты на слаги/`sort_title`/`release_year`).
 */
export function applySaveGame(conn: Db, rawInput: GameInput): string {
  // Импорт приносит связанные сущности именами; превращаем их в id и дополняем
  // ими то, что пользователь выбрал руками (08 §3 п. 3).
  const input = rawInput.createEntities ? mergeImportedEntities(conn, rawInput) : rawInput

  const nowTs = now()
  const isCreate = !input.id || !gameExists(conn, input.id)
  const id = input.id ?? newId()

  const sortTitle = input.sortTitle?.trim() || makeSortTitle(input.title)
  const releaseYear = yearFromDate(input.releaseDate ?? null)
  let slug = input.slug?.trim()
  if (!slug) {
    slug = ensureUniqueSlug(makeSlug(input.title), (s) => slugTaken(conn, s, isCreate ? undefined : id))
  } else if (slugTaken(conn, slug, isCreate ? undefined : id)) {
    throw new AppError('duplicate_slug', `Slug «${slug}» уже занят`)
  }

  const columns: GameWriteColumns = {
    title: input.title,
    sortTitle,
    slug,
    altTitlesJson: JSON.stringify(input.altTitles ?? []),
    category: input.category,
    parentGameId: input.parentGameId ?? null,
    releaseDate: input.releaseDate ?? null,
    releaseDatePrecision: input.releaseDatePrecision,
    releaseYear,
    releaseStatus: input.releaseStatus,
    summary: input.summary ?? null,
    storyline: input.storyline ?? null,
    coverImageId: input.coverImageId ?? null,
    backdropImageId: input.backdropImageId ?? null,
    logoImageId: input.logoImageId ?? null,
    metacriticScore: input.metacriticScore ?? null,
    metacriticUrl: input.metacriticUrl ?? null,
    opencriticScore: input.opencriticScore ?? null,
    hltbMainMin: input.hltbMainMin ?? null,
    hltbExtraMin: input.hltbExtraMin ?? null,
    hltbCompleteMin: input.hltbCompleteMin ?? null,
    ageRating: input.ageRating ?? null,
    website: input.website ?? null
  }

  if (isCreate) insertGameRow(conn, id, columns, nowTs)
  else updateGameRow(conn, id, columns, nowTs)

  setGameGenreLinks(conn, id, input.genreIds ?? [], input.primaryGenreId ?? null)
  setGamePlatformLinks(conn, id, input.platformIds ?? [])
  setGameModeLinks(conn, id, input.modeIds ?? [])
  setGameTags(conn, id, input.tagIds ?? [])
  setGameCompanyLinks(conn, id, {
    developer: input.developerIds ?? [],
    publisher: input.publisherIds ?? [],
    supporting: input.supportingIds ?? [],
    porting: input.portingIds ?? []
  })
  setGameSeriesLink(conn, id, input.seriesId ?? null, input.seriesPosition ?? null)

  // Поля из источника помечаем этим источником (импорт вправе их обновлять),
  // остальные считаем ручным вводом и блокируем (08 §3 п. 4, §7 п. 2).
  const sources = input.provenance ?? []
  const importedFields = new Set(sources.flatMap((source) => source.fields))
  lockManualFields(
    conn,
    'game',
    id,
    TRACKED_FIELDS.filter((field) => !importedFields.has(field))
  )
  for (const source of sources) {
    markImportedFields(conn, 'game', id, source.provider, source.fields)
    saveExternalId(conn, 'game', id, source)
  }
  upsertSearchIndex(conn, 'game', id, input.title, input.altTitles ?? [])

  logActivityCatalog(conn, isCreate, id, input.title)

  if (isCreate && input.addToLibrary) {
    ensureUserGame(conn, id, input.addStatus ?? 'backlog')
  }

  return id
}

/** Дополняет выбранное пользователем тем, что импорт принёс именами. */
function mergeImportedEntities(conn: Db, input: GameInput): GameInput {
  const resolved = resolveImportedEntities(conn, input.createEntities!)
  const union = (a: string[] | undefined, b: string[]): string[] => [...new Set([...(a ?? []), ...b])]
  return {
    ...input,
    developerIds: union(input.developerIds, resolved.developerIds),
    publisherIds: union(input.publisherIds, resolved.publisherIds),
    genreIds: union(input.genreIds, resolved.genreIds),
    platformIds: union(input.platformIds, resolved.platformIds),
    modeIds: union(input.modeIds, resolved.modeIds),
    tagIds: union(input.tagIds, resolved.tagIds),
    seriesId: input.seriesId ?? resolved.seriesId
  }
}

function logActivityCatalog(conn: Db, isCreate: boolean, gameId: string, title: string): void {
  // logActivity живёт в activity.service, но чтобы не тянуть лишний импорт-цикл, пишем напрямую.
  conn
    .prepare('INSERT INTO activity_log(id, happened_at, type, game_id, entity_type, entity_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(newId(), now(), isCreate ? 'catalog_created' : 'catalog_edited', gameId, 'game', gameId, JSON.stringify({ title }))
}

export function saveGame(input: GameInput): string {
  // Импорт может создать студию, жанр или серию — эти таблицы тоже попадают в транзакцию.
  const tables = [
    'games', 'game_genres', 'game_platforms', 'game_modes', 'game_tags', 'game_companies', 'series_games', 'user_game',
    ...(input.createEntities ? IMPORT_TABLES : [])
  ]
  return write(tables, (conn) => applySaveGame(conn, input))
}

export function deleteGames(ids: string[]): void {
  write(['games'], (conn) => {
    for (const id of ids) {
      if (!gameExists(conn, id)) continue
      removeFromSearchIndex(conn, 'game', id)
      deleteGameRow(conn, id) // ON DELETE CASCADE подчищает связи, user_game, list_items, series_games…
      deleteEntity(conn, 'game', id)
    }
  })
}

export function similarTitles(title: string, excludeId?: string): Array<{ id: string; title: string; releaseYear: number | null }> {
  return findSimilarTitles(getDb(), title, excludeId)
}

export function bulkAssign(gameIds: string[], genreIds?: string[], platformIds?: string[], seriesId?: string | null): void {
  write(['games', 'game_genres', 'game_platforms', 'series_games'], (conn) => {
    for (const gameId of gameIds) {
      if (genreIds) {
        const existing = conn.prepare('SELECT genre_id FROM game_genres WHERE game_id = ?').all(gameId) as Array<{ genre_id: string }>
        const merged = new Set([...existing.map((r) => r.genre_id), ...genreIds])
        const primary = existing.find(() => true)?.genre_id ?? genreIds[0] ?? null
        setGameGenreLinks(conn, gameId, [...merged], primary)
      }
      if (platformIds) {
        const existing = conn.prepare('SELECT platform_id FROM game_platforms WHERE game_id = ?').all(gameId) as Array<{
          platform_id: string
        }>
        setGamePlatformLinks(conn, gameId, [...new Set([...existing.map((r) => r.platform_id), ...platformIds])])
      }
      if (seriesId !== undefined) setGameSeriesLink(conn, gameId, seriesId)
    }
  })
}

export function quickSearch(q: string, opts: { limit: number; onlyLibrary?: boolean; excludeIds?: string[] }): GameCardDto[] {
  return quickSearchGames(getDb(), q, opts)
}
