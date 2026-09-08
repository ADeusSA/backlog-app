/** Счётчики и «недавно добавлено» для хаба каталога (06 §7.1). */
import type { Db } from '../connection'

export interface CatalogCounts {
  games: number
  companies: number
  series: number
  genres: number
  platforms: number
  tags: number
}

export function getCatalogCounts(db: Db): CatalogCounts {
  const count = (table: string): number => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
  return {
    games: count('games'),
    companies: count('companies'),
    series: count('series'),
    genres: count('genres'),
    platforms: count('platforms'),
    tags: count('tags')
  }
}

export interface RecentCatalogEntity {
  entityType: string
  id: string
  name: string
  createdAt: string
  coverFile: string | null
}

export function getRecentCatalogEntities(db: Db, limit: number): RecentCatalogEntity[] {
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT 'game' AS entityType, g.id AS id, g.title AS name, g.created_at AS createdAt,
                cov.file_name AS coverFile
         FROM games g LEFT JOIN images cov ON cov.id = g.cover_image_id
         UNION ALL
         SELECT 'company' AS entityType, c.id AS id, c.name AS name, c.created_at AS createdAt,
                logo.file_name AS coverFile
         FROM companies c LEFT JOIN images logo ON logo.id = c.logo_image_id
         UNION ALL
         SELECT 'series' AS entityType, s.id AS id, s.name AS name, s.created_at AS createdAt,
                cov.file_name AS coverFile
         FROM series s LEFT JOIN images cov ON cov.id = s.cover_image_id
       )
       ORDER BY createdAt DESC LIMIT ?`
    )
    .all(limit) as RecentCatalogEntity[]
  return rows
}
