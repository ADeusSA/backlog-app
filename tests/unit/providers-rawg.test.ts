import { describe, expect, it } from 'vitest'
import {
  isTechnicalTag,
  mapDate,
  parseRawgRef,
  splitDescription,
  splitTags,
  toCanonical
} from '../../src/main/providers/rawg'

/**
 * RAWG — источник для тех, кому недоступно приложение Twitch (оно требует
 * двухфакторной аутентификации по телефону). Фикстура сокращена до полей, которые
 * мы читаем; структура — из https://api.rawg.io/docs/#operation/games_read.
 */
const WITCHER = {
  id: 3328,
  slug: 'the-witcher-3-wild-hunt',
  name: 'The Witcher 3: Wild Hunt',
  name_original: 'The Witcher 3: Wild Hunt',
  released: '2015-05-18',
  tba: false,
  description_raw:
    'The third game in a series, it holds nothing back from the player.\n\nGeralt of Rivia is a monster hunter.',
  background_image: 'https://media.rawg.io/media/games/618/61833.jpg',
  website: 'https://thewitcher.com/en/witcher3',
  metacritic: 92,
  metacritic_url: 'https://www.metacritic.com/game/pc/the-witcher-3-wild-hunt?ftag=x',
  playtime: 46,
  esrb_rating: { name: 'Mature' },
  genres: [
    { name: 'Action', slug: 'action' },
    { name: 'RPG', slug: 'role-playing-games-rpg' }
  ],
  tags: [
    { name: 'Singleplayer', slug: 'singleplayer', language: 'eng', games_count: 200000 },
    { name: 'Steam Achievements', slug: 'steam-achievements', language: 'eng', games_count: 150000 },
    { name: 'Atmospheric', slug: 'atmospheric', language: 'eng', games_count: 30000 },
    { name: 'Open World', slug: 'open-world', language: 'eng', games_count: 12000 },
    { name: 'Атмосферная', slug: 'atmosfernaia', language: 'rus', games_count: 9000 },
    { name: 'Сюжет', slug: 'siuzhet', language: 'rus', games_count: 7000 }
  ],
  platforms: [
    { platform: { name: 'PC', slug: 'pc' } },
    { platform: { name: 'PlayStation 5', slug: 'playstation5' } },
    { platform: { name: 'Nintendo Switch', slug: 'nintendo-switch' } }
  ],
  developers: [{ name: 'CD PROJEKT RED', slug: 'cd-projekt-red' }],
  publishers: [{ name: 'CD PROJEKT RED', slug: 'cd-projekt-red' }]
}

describe('parseRawgRef', () => {
  it('достаёт slug из ссылки rawg.io', () => {
    expect(parseRawgRef('https://rawg.io/games/the-witcher-3-wild-hunt')).toBe('the-witcher-3-wild-hunt')
    expect(parseRawgRef('The Witcher 3')).toBeNull()
  })
})

describe('mapDate', () => {
  it('полная дата — точность «день», без даты или tba — «TBA»', () => {
    expect(mapDate('2015-05-18', false)).toEqual({ date: '2015-05-18', precision: 'day' })
    expect(mapDate(null, false)).toEqual({ date: null, precision: 'tba' })
    expect(mapDate('2015-05-18', true)).toEqual({ date: null, precision: 'tba' })
  })
})

describe('splitDescription', () => {
  it('первый абзац идёт в аннотацию, остальные — в сюжет, без дублирования', () => {
    const { summary, storyline } = splitDescription('Первый абзац.\n\nВторой абзац.\n\nТретий.')
    expect(summary).toBe('Первый абзац.')
    expect(storyline).toBe('Второй абзац.\n\nТретий.')
  })

  it('пустое описание не создаёт пустых строк', () => {
    expect(splitDescription(undefined)).toEqual({ summary: null, storyline: null })
  })

  it('описание в один абзац не дублируется в «Сюжет»', () => {
    expect(splitDescription('Один абзац и всё.')).toEqual({
      summary: 'Один абзац и всё.',
      storyline: null
    })
  })

  it('разбирает абзацы, разделённые CRLF — именно так их отдаёт RAWG', () => {
    // Регрессия: `\n{2,}` не совпадал с «\r\n\r\n», и весь текст попадал в оба поля.
    const { summary, storyline } = splitDescription('Первый абзац.\r\n\r\nВторой абзац.')
    expect(summary).toBe('Первый абзац.')
    expect(storyline).toBe('Второй абзац.')
  })

  it('длинное описание одним абзацем целиком уходит в аннотацию, без дубля в «Сюжете»', () => {
    // Регрессия: у Celeste это 812 символов одним абзацем, и при пороге 600
    // текст попадал сразу в оба поля.
    const long = 'a'.repeat(812)
    const { summary, storyline } = splitDescription(long)
    expect(summary).toBe(long)
    expect(storyline).toBeNull()
  })

  it('абзац длиннее лимита схемы обрезается, но целиком остаётся в «Сюжете»', () => {
    const huge = 'a'.repeat(4500)
    const { summary, storyline } = splitDescription(huge)
    expect(summary).toHaveLength(4000)
    expect(storyline).toBe(huge)
  })
})

describe('isTechnicalTag', () => {
  it('отсеивает возможности витрины Steam', () => {
    for (const slug of [
      'steam-achievements',
      'steam-cloud',
      'steam-trading-cards',
      'full-controller-support',
      'partial-controller-support',
      'remote-play-together',
      'captions-available',
      'includes-level-editor',
      'cross-platform-multiplayer',
      'controller',
      'stats'
    ]) {
      expect(isTechnicalTag(slug), slug).toBe(true)
    }
  })

  it('оставляет теги, которые описывают саму игру', () => {
    for (const slug of ['2d', 'atmospheric', 'exploration', 'story-rich', 'cute', 'pixel-graphics']) {
      expect(isTechnicalTag(slug), slug).toBe(false)
    }
  })
})

describe('splitTags', () => {
  it('теги-режимы уходят в режимы и не дублируются в тегах', () => {
    const { modes, tags } = splitTags(WITCHER.tags, 'eng')
    expect(modes.map((m) => m.slug)).toEqual(['single-player'])
    expect(tags.map((t) => t.name)).not.toContain('Singleplayer')
  })

  it('технические теги витрины в каталог не попадают', () => {
    const { tags } = splitTags(WITCHER.tags, 'eng')
    expect(tags.map((t) => t.name)).toEqual(['Atmospheric', 'Open World'])
  })

  it('при русском интерфейсе берутся русские теги', () => {
    const { tags } = splitTags(WITCHER.tags, 'rus')
    expect(tags.map((t) => t.name)).toEqual(['Атмосферная', 'Сюжет'])
  })

  it('если тегов на нужном языке нет, показываются английские', () => {
    const onlyEng = WITCHER.tags.filter((tag) => tag.language === 'eng')
    const { tags } = splitTags(onlyEng, 'rus')
    expect(tags.map((t) => t.name)).toContain('Atmospheric')
  })
})

describe('rawg.toCanonical', () => {
  const game = toCanonical(WITCHER, 'eng')

  it('переносит основные поля', () => {
    expect(game.title).toBe('The Witcher 3: Wild Hunt')
    expect(game.releaseDate).toBe('2015-05-18')
    expect(game.releaseStatus).toBe('released')
    expect(game.ageRating).toBe('Mature')
    expect(game.website).toBe('https://thewitcher.com/en/witcher3')
  })

  it('оценку Metacritic берёт со ссылкой без партнёрского хвоста', () => {
    expect(game.metacriticScore).toBe(92)
    expect(game.metacriticUrl).toBe('https://www.metacritic.com/game/pc/the-witcher-3-wild-hunt')
  })

  it('среднее время в часах превращает в минуты и кладёт только в «сюжет»', () => {
    // У RAWG одно усреднённое число, раздельных «с побочными / на 100 %» нет.
    expect(game.hltbMainMin).toBe(46 * 60)
    expect(game.hltbExtraMin).toBeNull()
    expect(game.hltbCompleteMin).toBeNull()
  })

  it('сопоставляет жанры и платформы со справочниками', () => {
    expect(game.genres.map((g) => g.slug)).toEqual(['action', 'rpg'])
    expect(game.platforms.map((p) => p.name)).toEqual(['PC (Windows)', 'PlayStation 5', 'Nintendo Switch'])
  })

  it('вертикальной обложки и серии не даёт — только фон', () => {
    expect(game.images.cover).toBeNull()
    expect(game.images.backdrop).toBe('https://media.rawg.io/media/games/618/61833.jpg')
    expect(game.series).toBeNull()
  })

  it('игру без даты помечает анонсом', () => {
    const tba = toCanonical({ ...WITCHER, released: null, tba: true }, 'eng')
    expect(tba.releaseStatus).toBe('announced')
    expect(tba.releaseDatePrecision).toBe('tba')
  })
})
