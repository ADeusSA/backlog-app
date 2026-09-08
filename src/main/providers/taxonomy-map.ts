/**
 * Словарь «название у провайдера → запись нашего каталога» (08 §5).
 *
 * Каталог заполнен по-русски («Экшен», «Одиночная»), а Steam и IGDB отдают английские
 * названия, поэтому сопоставляем по slug: у жанров и режимов он есть в схеме и совпадает
 * с английским термином. Что не нашлось в таблице — превращается в slug автоматически
 * и в форме будет помечено как «будет создан».
 */
import { makeSlug } from '@shared/text'
import type { NamedRef } from '@shared/schema/providers'

/** Жанры Steam и IGDB → slug из миграции 0001 (`genres.slug`). */
const GENRE_SLUGS: Record<string, string> = {
  action: 'action',
  adventure: 'adventure',
  'point-and-click': 'point-and-click',
  'hack-and-slash-beat-em-up': 'hack-and-slash',
  'hack-and-slash': 'hack-and-slash',
  'role-playing-rpg': 'rpg',
  // Свой вариант того же слага у RAWG.
  'role-playing-games-rpg': 'rpg',
  rpg: 'rpg',
  'massively-multiplayer': 'mmo',
  'board-games': 'card-and-board',
  casual: 'arcade',
  jrpg: 'jrpg',
  shooter: 'shooter',
  fps: 'shooter',
  platform: 'platformer',
  platformer: 'platformer',
  puzzle: 'puzzle',
  strategy: 'strategy',
  'real-time-strategy-rts': 'rts',
  rts: 'rts',
  'turn-based-strategy-tbs': 'turn-based-strategy',
  tactical: 'tactical',
  simulator: 'simulator',
  simulation: 'simulator',
  sport: 'sport',
  sports: 'sport',
  racing: 'racing',
  fighting: 'fighting',
  'visual-novel': 'visual-novel',
  'card-board-game': 'card-and-board',
  'card-game': 'card-and-board',
  music: 'music',
  arcade: 'arcade',
  indie: 'indie',
  // Темы IGDB, которые в нашем каталоге живут как жанры.
  horror: 'horror',
  survival: 'survival',
  stealth: 'stealth',
  sandbox: 'sandbox',
  'open-world': 'sandbox',
  moba: 'moba',
  roguelike: 'roguelike',
  'roguelike-roguelite': 'roguelike',
  metroidvania: 'metroidvania'
}

/** Режимы: Steam отдаёт их в `categories`, IGDB — в `game_modes`. */
const MODE_SLUGS: Record<string, string> = {
  'single-player': 'single-player',
  singleplayer: 'single-player',
  'multi-player': 'multiplayer',
  multiplayer: 'multiplayer',
  'online-multi-player': 'multiplayer',
  'pvp': 'multiplayer',
  'online-pvp': 'multiplayer',
  'co-op': 'co-op',
  // IGDB называет режим «Co-operative», Steam — «Co-op» и «Online Co-op».
  'co-operative': 'co-op',
  cooperative: 'co-op',
  'online-co-op': 'co-op',
  'lan-co-op': 'co-op',
  'shared-split-screen': 'split-screen',
  'shared-split-screen-co-op': 'split-screen',
  'shared-split-screen-pvp': 'split-screen',
  'split-screen': 'split-screen',
  mmo: 'mmo',
  'massively-multiplayer-online-mmo': 'mmo',
  'battle-royale': 'battle-royale'
}

/**
 * Платформы сопоставляются по имени: в таблице `platforms` нет slug, зато `name` уникально.
 * Ключ — сокращение IGDB или ключ Steam, значение — точное имя из каталога.
 */
const PLATFORM_NAMES: Record<string, string> = {
  win: 'PC (Windows)',
  pc: 'PC (Windows)',
  windows: 'PC (Windows)',
  mac: 'macOS',
  macos: 'macOS',
  linux: 'Linux',
  'steam-deck': 'Steam Deck',
  ps1: 'PlayStation',
  ps: 'PlayStation',
  ps2: 'PlayStation 2',
  ps3: 'PlayStation 3',
  ps4: 'PlayStation 4',
  ps5: 'PlayStation 5',
  psp: 'PSP',
  psvita: 'PlayStation Vita',
  vita: 'PlayStation Vita',
  xbox: 'Xbox',
  x360: 'Xbox 360',
  xone: 'Xbox One',
  'series-x-s': 'Xbox Series X|S',
  'series-x': 'Xbox Series X|S',
  nes: 'NES',
  snes: 'SNES',
  n64: 'Nintendo 64',
  ngc: 'GameCube',
  gamecube: 'GameCube',
  wii: 'Wii',
  'wii-u': 'Wii U',
  switch: 'Nintendo Switch',
  'switch-2': 'Nintendo Switch 2',
  gb: 'Game Boy',
  gba: 'Game Boy Advance',
  nds: 'Nintendo DS',
  '3ds': 'Nintendo 3DS',
  ios: 'iOS',
  android: 'Android',
  'meta-quest': 'Meta Quest',
  quest: 'Meta Quest',
  // Слаги RAWG — они длиннее сокращений IGDB и ключей Steam.
  playstation1: 'PlayStation',
  playstation2: 'PlayStation 2',
  playstation3: 'PlayStation 3',
  playstation4: 'PlayStation 4',
  playstation5: 'PlayStation 5',
  'ps-vita': 'PlayStation Vita',
  'xbox-one': 'Xbox One',
  xbox360: 'Xbox 360',
  'xbox-old': 'Xbox',
  'xbox-series-x': 'Xbox Series X|S',
  'nintendo-switch': 'Nintendo Switch',
  'nintendo-3ds': 'Nintendo 3DS',
  'nintendo-ds': 'Nintendo DS',
  'nintendo-64': 'Nintendo 64',
  'game-boy': 'Game Boy',
  'game-boy-advance': 'Game Boy Advance'
}

/** Жанр провайдера → ссылка на каталог. */
export function mapGenre(name: string): NamedRef {
  const key = makeSlug(name)
  return { slug: GENRE_SLUGS[key] ?? key, name }
}

/** Режим провайдера; `null` — категория Steam, которая режимом не является. */
export function mapMode(name: string): NamedRef | null {
  const slug = MODE_SLUGS[makeSlug(name)]
  return slug ? { slug, name } : null
}

/** Платформа провайдера; для незнакомых оставляем имя как есть, чтобы не терять данные. */
export function mapPlatform(key: string, fallbackName = key): NamedRef {
  const normalized = makeSlug(key)
  const name = PLATFORM_NAMES[normalized] ?? fallbackName
  return { slug: makeSlug(name), name }
}

/** Компания/серия/тег: своего словаря нет, slug считается из имени. */
export function asRef(name: string): NamedRef {
  return { slug: makeSlug(name), name }
}

/** Уникализация по slug с сохранением порядка. */
export function uniqueRefs(refs: Array<NamedRef | null>): NamedRef[] {
  const seen = new Set<string>()
  const out: NamedRef[] = []
  for (const ref of refs) {
    if (!ref || seen.has(ref.slug)) continue
    seen.add(ref.slug)
    out.push(ref)
  }
  return out
}
