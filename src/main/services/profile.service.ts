import type { GameCardDto, ProfileDto, ProfilePatch } from '@shared/schema/entities'
import { getDb, write } from '../db/connection'
import { now } from '../db/utils'
import { getNowPlaying, getProfileDto, updateProfileRow } from '../db/repositories/profile.repo'
import { queryCardsRaw } from '../db/repositories/collection.repo'

/** Профиль (ТЗ 06 §1). Достижения и XP пересчитывает модуль achievements. */
export function getProfile(): ProfileDto {
  return getProfileDto(getDb())
}

export function patchProfile(patch: ProfilePatch): ProfileDto {
  return write(['profile'], (db) => {
    updateProfileRow(
      db,
      {
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
        ...(patch.avatarImageId !== undefined ? { avatarImageId: patch.avatarImageId } : {}),
        ...(patch.bannerImageId !== undefined ? { bannerImageId: patch.bannerImageId } : {}),
        ...(patch.favoriteGameIds !== undefined ? { favoriteGameIds: patch.favoriteGameIds } : {}),
        ...(patch.yearGoal !== undefined ? { yearGoal: patch.yearGoal } : {})
      },
      now()
    )
    return getProfileDto(db)
  })
}

/** Лента «Сейчас играю» (06 §1.3) — карточки в порядке последней активности. */
export function nowPlayingCards(): Array<GameCardDto & { resumeNote: string | null }> {
  const db = getDb()
  const rows = getNowPlaying(db)
  if (rows.length === 0) return []
  const ids = rows.map((row) => row.gameId)
  const cards = queryCardsRaw(db, `g.id IN (${ids.map(() => '?').join(',')})`, ids)
  const noteById = new Map(rows.map((row) => [row.gameId, row.resumeNote]))
  return ids
    .map((id) => cards.find((card) => card.id === id))
    .filter((card): card is GameCardDto => card != null)
    .map((card) => ({ ...card, resumeNote: noteById.get(card.id) ?? null }))
}
