import { describe, expect, it } from 'vitest'
import { parseSteamDate, parseSteamRef, stripHtml, toCanonical } from '../../src/main/providers/steam'

/**
 * Маппер Steam проверяется на сохранённом ответе `appdetails` (08 §4: «один файл
 * на провайдера с юнит-тестами на фикстурах»). Фикстура сокращена до полей, которые
 * мы действительно читаем, значения — из настоящего ответа по appid 1245620.
 */
const ELDEN_RING = {
  type: 'game',
  name: 'ELDEN RING',
  steam_appid: 1245620,
  required_age: 16,
  short_description: 'THE NEW FANTASY ACTION RPG.',
  about_the_game: '<h2>THE NEW FANTASY ACTION RPG.</h2><p>Rise, Tarnished.</p><br>Guided by grace.',
  website: '',
  developers: ['FromSoftware, Inc.'],
  publishers: ['FromSoftware, Inc.', 'Bandai Namco Entertainment'],
  metacritic: { score: 94, url: 'https://www.metacritic.com/game/pc/elden-ring?ftag=MCD-06-10aaa1f' },
  genres: [
    { id: '1', description: 'Action' },
    { id: '3', description: 'RPG' }
  ],
  categories: [
    { id: 2, description: 'Single-player' },
    { id: 1, description: 'Multi-player' },
    { id: 9, description: 'Co-op' },
    { id: 22, description: 'Steam Achievements' }
  ],
  platforms: { windows: true, mac: false, linux: false },
  release_date: { coming_soon: false, date: 'Feb 24, 2022' },
  dlc: [3655690]
}

describe('parseSteamRef', () => {
  it('берёт appid из ссылки магазина, steam:// и голого числа', () => {
    expect(parseSteamRef('https://store.steampowered.com/app/1245620/ELDEN_RING/')).toBe('1245620')
    expect(parseSteamRef('steam://store/1245620')).toBe('1245620')
    expect(parseSteamRef('  1245620 ')).toBe('1245620')
  })

  it('принимает ссылку SteamDB, но только чтобы взять из неё appid', () => {
    // Сам SteamDB не запрашивается: скрапить его нельзя (08 §2).
    expect(parseSteamRef('https://steamdb.info/app/1245620/charts/')).toBe('1245620')
  })

  it('на обычном названии возвращает null — значит, ищем по тексту', () => {
    expect(parseSteamRef('Elden Ring')).toBeNull()
    expect(parseSteamRef('https://www.igdb.com/games/elden-ring')).toBeNull()
  })
})

describe('parseSteamDate', () => {
  it('разбирает три формата локализованной строки', () => {
    expect(parseSteamDate('Feb 24, 2022')).toEqual({ date: '2022-02-24', precision: 'day' })
    expect(parseSteamDate('February 2022')).toEqual({ date: '2022-02', precision: 'month' })
    expect(parseSteamDate('2022')).toEqual({ date: '2022', precision: 'year' })
  })

  it('пустую строку и «скоро» отдаёт как tba', () => {
    expect(parseSteamDate('')).toEqual({ date: null, precision: 'tba' })
    expect(parseSteamDate('Coming soon')).toEqual({ date: null, precision: 'tba' })
  })
})

describe('stripHtml', () => {
  it('превращает разметку описания в текст', () => {
    expect(stripHtml('<p>Rise,<br>Tarnished.</p>')).toBe('Rise,\nTarnished.')
    expect(stripHtml('AT&amp;T &quot;test&quot;')).toBe('AT&T "test"')
    expect(stripHtml(undefined)).toBeNull()
  })
})

describe('steam.toCanonical', () => {
  const game = toCanonical('1245620', ELDEN_RING)

  it('переносит основные поля', () => {
    expect(game.title).toBe('ELDEN RING')
    expect(game.category).toBe('main')
    expect(game.releaseDate).toBe('2022-02-24')
    expect(game.releaseDatePrecision).toBe('day')
    expect(game.releaseStatus).toBe('released')
    expect(game.ageRating).toBe('16+')
    expect(game.summary).toBe('THE NEW FANTASY ACTION RPG.')
  })

  it('раскодирует HTML-сущности и в коротком описании', () => {
    // Реальный текст Portal 2: `The &quot;Perpetual Testing Initiative&quot; has been expanded…`
    const quoted = toCanonical('620', {
      ...ELDEN_RING,
      short_description: 'The &quot;Perpetual Testing Initiative&quot; &amp; friends'
    })
    expect(quoted.summary).toBe('The "Perpetual Testing Initiative" & friends')
  })

  it('берёт оценку Metacritic и чистит партнёрский хвост ссылки', () => {
    expect(game.metacriticScore).toBe(94)
    expect(game.metacriticUrl).toBe('https://www.metacritic.com/game/pc/elden-ring')
  })

  it('сопоставляет жанры и режимы со slug нашего каталога', () => {
    expect(game.genres.map((g) => g.slug)).toEqual(['action', 'rpg'])
    // «Steam Achievements» — не режим и в список попасть не должен.
    expect(game.modes.map((m) => m.slug)).toEqual(['single-player', 'multiplayer', 'co-op'])
  })

  it('переводит ключ платформы в имя из каталога', () => {
    expect(game.platforms.map((p) => p.name)).toEqual(['PC (Windows)'])
  })

  it('различает разработчика и издателя', () => {
    expect(game.developers.map((c) => c.name)).toEqual(['FromSoftware, Inc.'])
    expect(game.publishers.map((c) => c.name)).toEqual(['FromSoftware, Inc.', 'Bandai Namco Entertainment'])
  })

  it('собирает ссылки на картинки библиотеки Steam', () => {
    expect(game.images.cover).toContain('/1245620/library_600x900_2x.jpg')
    expect(game.images.backdrop).toContain('/1245620/library_hero.jpg')
    expect(game.images.logo).toContain('/1245620/logo.png')
  })

  it('времени прохождения у Steam нет — его приносит IGDB', () => {
    expect(game.hltbMainMin).toBeNull()
    expect(game.hltbCompleteMin).toBeNull()
  })

  it('«Early Access» из жанров становится статусом релиза, а не жанром', () => {
    const ea = toCanonical('1', {
      ...ELDEN_RING,
      genres: [{ id: '1', description: 'Action' }, { id: '70', description: 'Early Access' }]
    })
    expect(ea.releaseStatus).toBe('early_access')
    expect(ea.genres.map((g) => g.slug)).toEqual(['action'])
  })

  it('DLC получает категорию dlc', () => {
    expect(toCanonical('2', { ...ELDEN_RING, type: 'dlc' }).category).toBe('dlc')
  })
})

/**
 * Локализация (запрос пользователя): при русском интерфейсе тексты берутся из русского
 * ответа, а жанры, режимы и дата — по-прежнему из английского, иначе рассыпается
 * сопоставление со справочниками и разбор даты («18 апр. 2011 г.»).
 */
describe('steam.toCanonical с русским ответом', () => {
  const RU = {
    ...ELDEN_RING,
    name: '«Ведьмак 3: Дикая Охота — Полное издание»',
    short_description: 'Ведьмак 3 — приключенческая ролевая игра.',
    about_the_game: '<p>Вы — Геральт из Ривии.</p>',
    genres: [{ id: '1', description: 'Экшены' }, { id: '3', description: 'Ролевые игры' }],
    categories: [{ id: 2, description: 'Для одного игрока' }],
    release_date: { coming_soon: false, date: '18 мая 2015 г.' }
  }

  const game = toCanonical('292030', { ...ELDEN_RING, name: 'The Witcher 3: Wild Hunt - Complete Edition' }, RU)

  it('локализованное название становится основным, оригинальное — альтернативным', () => {
    // Ёлочки, в которые витрина оборачивает русские издания, снимаются.
    expect(game.title).toBe('Ведьмак 3: Дикая Охота — Полное издание')
    expect(game.altTitles).toEqual(['The Witcher 3: Wild Hunt - Complete Edition'])
  })

  it('описания берутся из локализованного ответа', () => {
    expect(game.summary).toBe('Ведьмак 3 — приключенческая ролевая игра.')
    expect(game.storyline).toBe('Вы — Геральт из Ривии.')
  })

  it('жанры, режимы и дата — из английского ответа', () => {
    expect(game.genres.map((g) => g.slug)).toEqual(['action', 'rpg'])
    expect(game.modes.map((m) => m.slug)).toEqual(['single-player', 'multiplayer', 'co-op'])
    expect(game.releaseDate).toBe('2022-02-24')
  })

  it('без локализованного ответа поведение прежнее', () => {
    const en = toCanonical('1245620', ELDEN_RING)
    expect(en.title).toBe('ELDEN RING')
    expect(en.altTitles).toEqual([])
  })

  it('одинаковые названия не дублируются в альтернативных', () => {
    const same = toCanonical('1145350', ELDEN_RING, { ...RU, name: 'ELDEN RING' })
    expect(same.title).toBe('ELDEN RING')
    expect(same.altTitles).toEqual([])
  })
})
