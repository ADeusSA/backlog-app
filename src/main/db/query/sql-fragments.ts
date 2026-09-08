/**
 * Общие SQL-фрагменты для билдера коллекции и фасетов (07 §5, §7).
 * Вынесены в константы, чтобы одинаковый текст использовался и в SELECT, и в ORDER BY/GROUP BY —
 * SQLite не позволяет ссылаться на алиас выходной колонки внутри произвольного выражения ORDER BY.
 */

/** Основной жанр игры (для карточки и для группировки). */
export const PRIMARY_GENRE_SQL =
  "(SELECT ge.name FROM game_genres gg JOIN genres ge ON ge.id = gg.genre_id " +
  'WHERE gg.game_id = g.id ORDER BY gg.is_primary DESC, ge.name LIMIT 1)'

/** Все жанры игры через запятую, основной — первым. */
export const GENRES_CONCAT_SQL =
  "(SELECT group_concat(x.name, ', ') FROM (SELECT ge.name FROM game_genres gg JOIN genres ge ON ge.id = gg.genre_id " +
  'WHERE gg.game_id = g.id ORDER BY gg.is_primary DESC, ge.name) x)'

/** Первый разработчик игры (для карточки и группировки). */
export const DEVELOPER_SQL =
  "(SELECT co.name FROM game_companies gc JOIN companies co ON co.id = gc.company_id " +
  "WHERE gc.game_id = g.id AND gc.role = 'developer' ORDER BY co.sort_name LIMIT 1)"

/** Платформы релиза через запятую (короткие имена, по sort_order). */
export const PLATFORMS_CONCAT_SQL =
  "(SELECT group_concat(x.short_name, ', ') FROM (SELECT p.short_name FROM game_platforms gp JOIN platforms p ON p.id = gp.platform_id " +
  'WHERE gp.game_id = g.id ORDER BY p.sort_order) x)'

/** Основная серия игры (is_primary), для карточки и группировки. */
export const SERIES_NAME_SQL =
  '(SELECT s.name FROM series_games sgx JOIN series s ON s.id = sgx.series_id ' +
  'WHERE sgx.game_id = g.id AND sgx.is_primary = 1 LIMIT 1)'

/** Заполненность каталожных полей 0..100 (только для scope=catalog, см. 06 §7.2). */
export const COMPLETENESS_SQL =
  'CAST(ROUND(100.0 * (' +
  '(CASE WHEN g.cover_image_id IS NOT NULL THEN 1 ELSE 0 END) + ' +
  '(CASE WHEN g.release_date IS NOT NULL THEN 1 ELSE 0 END) + ' +
  "(CASE WHEN g.summary IS NOT NULL AND g.summary <> '' THEN 1 ELSE 0 END) + " +
  '(CASE WHEN EXISTS(SELECT 1 FROM game_genres WHERE game_id = g.id) THEN 1 ELSE 0 END) + ' +
  "(CASE WHEN EXISTS(SELECT 1 FROM game_companies WHERE game_id = g.id AND role = 'developer') THEN 1 ELSE 0 END) + " +
  "(CASE WHEN EXISTS(SELECT 1 FROM game_companies WHERE game_id = g.id AND role = 'publisher') THEN 1 ELSE 0 END) + " +
  '(CASE WHEN EXISTS(SELECT 1 FROM game_platforms WHERE game_id = g.id) THEN 1 ELSE 0 END) + ' +
  '(CASE WHEN EXISTS(SELECT 1 FROM series_games WHERE game_id = g.id) THEN 1 ELSE 0 END) + ' +
  '(CASE WHEN g.metacritic_score IS NOT NULL THEN 1 ELSE 0 END)' +
  ') / 9.0) AS INTEGER)'

/** Экранирование спецсимволов LIKE (`%`, `_`, `\`) и обрамление в `%…%`. */
export function likeContains(value: string): string {
  const escaped = value.replace(/[\\%_]/g, (ch) => `\\${ch}`)
  return `%${escaped}%`
}

export function likePrefix(value: string): string {
  const escaped = value.replace(/[\\%_]/g, (ch) => `\\${ch}`)
  return `${escaped}%`
}

/** `expr DIR` с NULL всегда в конце, независимо от направления (07 §5). */
export function nullsLastTerm(expr: string, dir: 'asc' | 'desc'): string {
  return `(${expr} IS NULL) ASC, ${expr} ${dir.toUpperCase()}`
}

/**
 * Детерминированный «случайный» порядок по seed (07 §5): без пагинации выдаётся весь
 * набор строк, поэтому достаточно устойчивой псевдослучайной проекции id+seed,
 * а не настоящего ГПСЧ. Один и тот же seed всегда даёт один и тот же порядок.
 * Seed умножается на вес каждого символа id (а не просто прибавляется), иначе
 * равномерный сдвиг почти никогда не меняет взаимный порядок небольшого набора строк.
 */
// Символы берутся из последних 4 позиций id: для UUIDv7 это случайные биты (`rand_b`),
// а не таймстамп — гарантированно различаются даже у записей, созданных в одну и ту же
// миллисекунду. Четыре символа упаковываются в псевдо-32-битное число и прогоняются
// через мультипликативное хеширование (константа Фибоначчи 2654435761 = 2^32 / φ) —
// в отличие от простого сложения/масштабирования, оно даёт «лавинный эффект»: разные
// seed переставляют строки местами, а не просто одинаково сдвигают весь порядок.
export const RANDOM_ORDER_SQL =
  '(((unicode(substr(g.id, -4, 1)) + unicode(substr(g.id, -3, 1)) * 256 + ' +
  'unicode(substr(g.id, -2, 1)) * 65536 + unicode(substr(g.id, -1, 1)) * 16777216 + ?) * 2654435761) % 4294967296)'

/** Сколько раз параметр `seed` нужно передать в {@link RANDOM_ORDER_SQL} (по числу вхождений `?`). */
export const RANDOM_ORDER_SEED_ARITY = 1
