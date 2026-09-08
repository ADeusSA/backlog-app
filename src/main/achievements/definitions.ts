/**
 * Каталог достижений (ТЗ 09 §3). Условия считаются детерминированно из данных,
 * `user_achievements` — только кеш прогресса и даты открытия.
 */

export interface AchievementLevel {
  threshold: number
  xp: number
}

export interface AchievementDefinition {
  key: string
  titleKey: string
  descriptionKey: string
  /** Русские строки — запасной вариант, если ключа нет в словаре. */
  title: string
  description: string
  icon: string
  levels: AchievementLevel[]
  /** Требует журнала сессий — активируется в итерации 2 (ТЗ 09 §3). */
  comingSoon?: boolean
  /** Параметризованные («серийный», «жанровый гурман») генерируются по данным. */
  parameterized?: 'series' | 'genre'
}

const XP_PER_LEVEL = 20

const levels = (...thresholds: number[]): AchievementLevel[] =>
  thresholds.map((threshold) => ({ threshold, xp: XP_PER_LEVEL }))

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    key: 'first_blood',
    titleKey: 'achievement.first_blood.title',
    descriptionKey: 'achievement.first_blood.desc',
    title: 'Первая кровь',
    description: 'Первая пройденная игра',
    icon: 'flag',
    levels: levels(1)
  },
  {
    key: 'backlog_minus',
    titleKey: 'achievement.backlog_minus.title',
    descriptionKey: 'achievement.backlog_minus.desc',
    title: 'Минус бэклог',
    description: 'Пройдено игр: {{threshold}}',
    icon: 'circle-check-big',
    levels: levels(10, 50, 100, 250, 500, 1000)
  },
  {
    key: 'platinum',
    titleKey: 'achievement.platinum.title',
    descriptionKey: 'achievement.platinum.desc',
    title: 'Платиновый',
    description: 'Игр на 100 %: {{threshold}}',
    icon: 'trophy',
    levels: levels(1, 5, 25, 100)
  },
  {
    key: 'marathon',
    titleKey: 'achievement.marathon.title',
    descriptionKey: 'achievement.marathon.desc',
    title: 'Марафонец',
    description: 'Часов наиграно: {{threshold}}',
    icon: 'clock-3',
    levels: levels(100, 500, 2000, 10000)
  },
  {
    key: 'streak',
    titleKey: 'achievement.streak.title',
    descriptionKey: 'achievement.streak.desc',
    title: 'Стрик',
    description: 'Дней подряд с игровой сессией: {{threshold}}',
    icon: 'flame',
    levels: levels(7, 30, 100),
    comingSoon: true
  },
  {
    key: 'retro',
    titleKey: 'achievement.retro.title',
    descriptionKey: 'achievement.retro.desc',
    title: 'Ретроман',
    description: 'Пройдено игр до 2000 года: {{threshold}}',
    icon: 'joystick',
    levels: levels(10, 30)
  },
  {
    key: 'series_complete',
    titleKey: 'achievement.series_complete.title',
    descriptionKey: 'achievement.series_complete.desc',
    title: 'Серийный',
    description: 'Пройдены все основные игры серии «{{name}}»',
    icon: 'layers',
    levels: levels(1),
    parameterized: 'series'
  },
  {
    key: 'genre_gourmet',
    titleKey: 'achievement.genre_gourmet.title',
    descriptionKey: 'achievement.genre_gourmet.desc',
    title: 'Жанровый гурман',
    description: 'Пройдено в жанре «{{name}}»: {{threshold}}',
    icon: 'tags',
    levels: levels(5, 15, 40),
    parameterized: 'genre'
  },
  {
    key: 'year_balance',
    titleKey: 'achievement.year_balance.title',
    descriptionKey: 'achievement.year_balance.desc',
    title: 'Годовой баланс',
    description: 'За календарный год пройдено не меньше, чем добавлено',
    icon: 'scale',
    levels: levels(1)
  },
  {
    key: 'excavator',
    titleKey: 'achievement.excavator.title',
    descriptionKey: 'achievement.excavator.desc',
    title: 'Разгребатель',
    description: 'Пройдена игра, пролежавшая в бэклоге больше двух лет',
    icon: 'shovel',
    levels: levels(1)
  },
  {
    key: 'speedrunner',
    titleKey: 'achievement.speedrunner.title',
    descriptionKey: 'achievement.speedrunner.desc',
    title: 'Скороход',
    description: 'Игр пройдено быстрее «основного сюжета» HLTB: {{threshold}}',
    icon: 'zap',
    levels: levels(5)
  },
  {
    key: 'multiplatform',
    titleKey: 'achievement.multiplatform.title',
    descriptionKey: 'achievement.multiplatform.desc',
    title: 'Мультиплатформенник',
    description: 'Разных платформ среди прохождений: {{threshold}}',
    icon: 'monitor-smartphone',
    levels: levels(3, 6, 10)
  },
  {
    key: 'critic',
    titleKey: 'achievement.critic.title',
    descriptionKey: 'achievement.critic.desc',
    title: 'Критик',
    description: 'Написано отзывов: {{threshold}}',
    icon: 'pen-line',
    levels: levels(10, 50, 200)
  },
  {
    key: 'curator',
    titleKey: 'achievement.curator.title',
    descriptionKey: 'achievement.curator.desc',
    title: 'Куратор',
    description: 'Пять списков или один список из 50+ игр',
    icon: 'list-checks',
    levels: levels(1)
  },
  {
    key: 'fair_judge',
    titleKey: 'achievement.fair_judge.title',
    descriptionKey: 'achievement.fair_judge.desc',
    title: 'Честный судья',
    description: '100 оценок и не меньше шести разных значений шкалы',
    icon: 'gavel',
    levels: levels(1)
  },
  {
    key: 'night_owl',
    titleKey: 'achievement.night_owl.title',
    descriptionKey: 'achievement.night_owl.desc',
    title: 'Сова',
    description: 'Двадцать сессий, начатых после 23:00',
    icon: 'moon',
    levels: levels(20),
    comingSoon: true
  },
  {
    key: 'comeback',
    titleKey: 'achievement.comeback.title',
    descriptionKey: 'achievement.comeback.desc',
    title: 'Возвращение',
    description: 'Пройдена игра, побывавшая в статусе «Отложена»',
    icon: 'undo-2',
    levels: levels(1)
  }
]

export const ACHIEVEMENT_BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]))

/** Титулы уровней (ТЗ 09 §2). */
export const LEVEL_TITLES: Array<{ from: number; key: string; title: string }> = [
  { from: 50, key: 'level.title.50', title: 'Точка невозврата' },
  { from: 30, key: 'level.title.30', title: 'Легенда бэклога' },
  { from: 20, key: 'level.title.20', title: 'Куратор' },
  { from: 15, key: 'level.title.15', title: 'Ветеран' },
  { from: 10, key: 'level.title.10', title: 'Проходимец' },
  { from: 5, key: 'level.title.5', title: 'Коллекционер' },
  { from: 1, key: 'level.title.1', title: 'Новичок' }
]

export const XP_PER_LEVEL_STEP = 500

export function levelFromXp(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL_STEP) + 1
}

export function levelTitle(level: number): { key: string; title: string } {
  const found = LEVEL_TITLES.find((entry) => level >= entry.from) ?? LEVEL_TITLES[LEVEL_TITLES.length - 1]
  return { key: found!.key, title: found!.title }
}
