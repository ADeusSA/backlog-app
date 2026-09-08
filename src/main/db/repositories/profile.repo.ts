/** Репозиторий профиля (02 §3.2, 06 §1). Ровно одна строка `id = 1`. */
import type { Db } from '../connection'
import { parseJson } from '../utils'
import { levelFromXp, levelTitle, XP_PER_LEVEL_STEP } from '../../achievements/definitions'
import { type ProfileDto, profileDtoSchema } from '@shared/schema/entities'
import { queryCardsRaw } from './collection.repo'

interface ProfileRow {
  display_name: string
  bio: string | null
  avatar_image_id: string | null
  banner_image_id: string | null
  favorite_game_ids: string
  preferences_json: string
  xp: number
  created_at: string
  updated_at: string
}

interface Preferences {
  yearGoal?: number | null
}

export function getProfileRow(db: Db): ProfileRow {
  const row = db.prepare('SELECT * FROM profile WHERE id = 1').get() as ProfileRow | undefined
  if (!row) throw new Error('Строка профиля отсутствует — миграция 0002 не применена')
  return row
}

function memberSinceYear(db: Db): number | null {
  const row = db.prepare("SELECT MIN(substr(added_at, 1, 4)) AS y FROM user_game").get() as { y: string | null }
  return row.y ? Number(row.y) : null
}

export function getProfileDto(db: Db): ProfileDto {
  const row = getProfileRow(db)
  const favoriteIds = parseJson<string[]>(row.favorite_game_ids, [])
  const prefs = parseJson<Preferences>(row.preferences_json, {})

  const avatarFile = row.avatar_image_id
    ? ((db.prepare('SELECT file_name FROM images WHERE id = ?').get(row.avatar_image_id) as { file_name: string } | undefined)
        ?.file_name ?? null)
    : null
  const bannerFile = row.banner_image_id
    ? ((db.prepare('SELECT file_name FROM images WHERE id = ?').get(row.banner_image_id) as { file_name: string } | undefined)
        ?.file_name ?? null)
    : null

  const favoriteGamesUnordered = favoriteIds.length
    ? queryCardsRaw(db, `g.id IN (${favoriteIds.map(() => '?').join(',')})`, favoriteIds)
    : []
  const favoriteGames = favoriteIds
    .map((id) => favoriteGamesUnordered.find((g) => g.id === id))
    .filter((g): g is (typeof favoriteGamesUnordered)[number] => g != null)

  const xp = row.xp
  const level = levelFromXp(xp)
  const { key: levelTitleKey } = levelTitle(level)
  const xpIntoLevel = xp % XP_PER_LEVEL_STEP

  return profileDtoSchema.parse({
    displayName: row.display_name,
    bio: row.bio,
    avatarImageId: row.avatar_image_id,
    avatarFile,
    bannerImageId: row.banner_image_id,
    bannerFile,
    favoriteGameIds: favoriteIds,
    favoriteGames,
    yearGoal: prefs.yearGoal ?? null,
    xp,
    level,
    levelTitleKey,
    xpToNextLevel: XP_PER_LEVEL_STEP - xpIntoLevel,
    levelProgress: xpIntoLevel / XP_PER_LEVEL_STEP,
    memberSinceYear: memberSinceYear(db),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })
}

export interface ProfilePatchColumns {
  displayName?: string
  bio?: string | null
  avatarImageId?: string | null
  bannerImageId?: string | null
  favoriteGameIds?: string[]
  yearGoal?: number | null
}

export function updateProfileRow(db: Db, patch: ProfilePatchColumns, nowTs: string): void {
  const current = getProfileRow(db)
  const prefs = parseJson<Preferences>(current.preferences_json, {})
  const nextPrefs: Preferences = { ...prefs }
  if (patch.yearGoal !== undefined) nextPrefs.yearGoal = patch.yearGoal

  db.prepare(
    `UPDATE profile SET
       display_name = ?, bio = ?, avatar_image_id = ?, banner_image_id = ?, favorite_game_ids = ?,
       preferences_json = ?, updated_at = ?
     WHERE id = 1`
  ).run(
    patch.displayName ?? current.display_name,
    patch.bio !== undefined ? patch.bio : current.bio,
    patch.avatarImageId !== undefined ? patch.avatarImageId : current.avatar_image_id,
    patch.bannerImageId !== undefined ? patch.bannerImageId : current.banner_image_id,
    patch.favoriteGameIds !== undefined ? JSON.stringify(patch.favoriteGameIds) : current.favorite_game_ids,
    JSON.stringify(nextPrefs),
    nowTs
  )
}

/** «Сейчас играю» (06 §1.3): статус playing, по последней активности, с `resume_note`. */
export function getNowPlaying(db: Db): Array<{ gameId: string; resumeNote: string | null }> {
  const rows = db
    .prepare("SELECT game_id AS gameId, resume_note AS resumeNote FROM user_game WHERE status = 'playing' ORDER BY last_activity_at DESC")
    .all() as Array<{ gameId: string; resumeNote: string | null }>
  return rows
}
