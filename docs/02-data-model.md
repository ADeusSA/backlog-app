# 02 · Модель данных (SQLite)

Статус: **черновик v0.9**, финализируется вместе с ТЗ. Все решения ниже обязательны для реализации, если в других документах ТЗ явно не сказано иное.

## 1. Принципы

1. **Одна база — один файл** `backlog.db` (SQLite 3.4x). Картинки хранятся файлами рядом (см. §7). Это делает синхронизацию с облаком тривиальной: копируем файл БД + папку изображений.
2. **Идентификаторы — UUID v7** (текст, 36 символов, нижний регистр). Генерируются на клиенте. Причина: несколько ПК одного пользователя могут создавать записи офлайн; при будущем переходе на построчное слияние (merge) конфликтов id не будет.
3. **Время** — ISO 8601 в UTC с миллисекундами (`2026-09-07T12:34:56.789Z`) в полях `*_at`. Даты без времени (релиз, начал/закончил) — `YYYY-MM-DD`, допускается неполная дата `YYYY` или `YYYY-MM` (см. `precision`-поля).
4. **`created_at` / `updated_at`** есть у каждой пользовательской и каталожной сущности. `updated_at` обновляется приложением при каждой записи (не триггером), чтобы логика оставалась в одном месте.
5. **Удаления** — жёсткие (DELETE), но каждое удаление сущности первого уровня пишет строку в `tombstones`. Это дёшево и оставляет возможность построчного слияния в будущем.
6. **Ревизия базы** — `meta.db_revision` (целое) инкрементируется в той же транзакции, что и любая запись. Используется синхронизацией (см. документ 03).
7. **Внешние ключи включены** (`PRAGMA foreign_keys = ON`), режим журнала **WAL**, `synchronous = NORMAL`. Перед выгрузкой в облако выполняется `PRAGMA wal_checkpoint(TRUNCATE)` и снимок через `VACUUM INTO`.
8. **Справочники** (платформы, жанры, режимы, страны) сидируются миграцией; пользователь может добавлять свои.
9. **Каталог vs пользовательские данные.** «Каталог» (игры, компании, серии, жанры) описывает объективный мир и может быть импортирован из IGDB/Steam в будущем. «Пользовательские данные» (`user_game`, `playthroughs`, `play_sessions`, `lists`, `activity_log`) — субъективные. Разделение отражено в именовании и в правилах импорта (импорт никогда не трогает пользовательские таблицы).

## 2. Диаграмма сущностей (упрощённо)

```
profile 1─────────────────────────────┐
                                      │
companies ──< game_companies >── games ──< game_genres >── genres
    │                             │  │
    └─ parent_company_id          │  ├──< game_platforms >── platforms
                                  │  ├──< game_modes >── modes
series ──< series_games >─────────┘  ├──< game_tags >── tags
   └─ parent_series_id               ├── parent_game_id (DLC → базовая игра)
                                     │
                                     ├── user_game (1:1, статус, оценка, время…)
                                     ├──< playthroughs ──< play_sessions
                                     ├──< list_items >── lists
                                     ├──< external_ids
                                     └──< activity_log

images ← (cover_image_id / backdrop_image_id / logo_image_id / avatar…)
meta, tombstones, filter_presets, user_achievements
```

## 3. DDL

Ниже полный DDL первой миграции `0001_init.sql`. Тип столбцов указывается явно; `TEXT` для UUID и дат, `INTEGER` для булевых (0/1).

```sql
PRAGMA foreign_keys = ON;

-- 3.1 Служебные ---------------------------------------------------------------
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- ключи: schema_version, db_revision, device_id (UUID этого ПК),
--        created_at, last_local_write_at, last_sync_push_at, last_sync_pull_at

CREATE TABLE tombstones (
  entity_type TEXT NOT NULL,     -- 'game','company','series','list','image','tag','playthrough','play_session'
  entity_id   TEXT NOT NULL,
  deleted_at  TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);

-- 3.2 Профиль -------------------------------------------------------------------
CREATE TABLE profile (
  id               INTEGER PRIMARY KEY CHECK (id = 1),   -- ровно одна строка
  display_name     TEXT NOT NULL DEFAULT 'Игрок',
  bio              TEXT,
  avatar_image_id  TEXT REFERENCES images(id) ON DELETE SET NULL,
  banner_image_id  TEXT REFERENCES images(id) ON DELETE SET NULL,
  favorite_game_ids TEXT NOT NULL DEFAULT '[]',          -- JSON массив до 4 game.id («топ-4»)
  preferences_json TEXT NOT NULL DEFAULT '{}',           -- синхронизируемые настройки UI (вид по умолчанию, шкала оценок и т.п.)
  xp               INTEGER NOT NULL DEFAULT 0,           -- кеш XP, пересчитывается модулем достижений (документ 09)
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- 3.3 Изображения ---------------------------------------------------------------
CREATE TABLE images (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('cover','backdrop','logo','avatar','banner','screenshot','list_cover','series_cover')),
  file_name   TEXT NOT NULL UNIQUE,   -- относительный путь внутри папки images/, напр. '3f/3f2a…c9.webp'
  mime        TEXT NOT NULL,          -- 'image/webp' (всё конвертируется в webp), 'image/png' для логотипов с прозрачностью допустим
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  size_bytes  INTEGER NOT NULL,
  sha256      TEXT NOT NULL,
  dominant_color TEXT,                -- '#RRGGBB' — для фонов/свечений в UI, вычисляется при импорте
  source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','igdb','steam','steamgriddb','wikimedia','other')),
  source_url  TEXT,
  attribution TEXT,                   -- лицензия/автор, если требуется источником
  created_at  TEXT NOT NULL
);

-- 3.4 Справочники ---------------------------------------------------------------
CREATE TABLE platforms (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,   -- 'PlayStation 5'
  short_name  TEXT NOT NULL,          -- 'PS5'
  family      TEXT NOT NULL CHECK (family IN ('pc','playstation','xbox','nintendo','mobile','vr','retro','other')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_custom   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE genres (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,   -- 'Action RPG'
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  color       TEXT,                   -- '#RRGGBB' для чипов (опционально)
  is_custom   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE modes (                  -- режимы игры (IGDB game_modes)
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE,         -- 'Одиночная', 'Кооператив', 'Мультиплеер', 'Split-screen', 'MMO', 'Battle Royale'
  slug  TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tags (                   -- свободные пользовательские теги
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color      TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 3.5 Компании (студии и издатели) -----------------------------------------------
CREATE TABLE companies (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  sort_name         TEXT NOT NULL,             -- для сортировки без артиклей/кавычек
  is_developer      INTEGER NOT NULL DEFAULT 1,
  is_publisher      INTEGER NOT NULL DEFAULT 0,
  country_code      TEXT,                      -- ISO 3166-1 alpha-2 ('JP'); названия и флаги — из статической карты в коде
  country_numeric   INTEGER,                   -- ISO 3166-1 numeric (392) — так отдаёт IGDB; заполняется из той же карты
  city              TEXT,
  founded_year      INTEGER,
  closed_year       INTEGER,
  description       TEXT,
  website           TEXT,
  logo_image_id     TEXT REFERENCES images(id) ON DELETE SET NULL,
  banner_image_id   TEXT REFERENCES images(id) ON DELETE SET NULL,
  parent_company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,   -- Bethesda → ZeniMax → Xbox Game Studios
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX idx_companies_sort ON companies(sort_name);
CREATE INDEX idx_companies_parent ON companies(parent_company_id);

-- 3.6 Серии (франшизы) -----------------------------------------------------------
CREATE TABLE series (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  sort_name        TEXT NOT NULL,
  kind             TEXT NOT NULL DEFAULT 'series' CHECK (kind IN ('series','franchise')),
                   -- series = IGDB collection (Dark Souls), franchise = зонтик (Souls, Mario); в UI оба — «серия»
  description      TEXT,
  cover_image_id   TEXT REFERENCES images(id) ON DELETE SET NULL,
  banner_image_id  TEXT REFERENCES images(id) ON DELETE SET NULL,
  parent_series_id TEXT REFERENCES series(id) ON DELETE SET NULL,      -- 'Call of Duty' → 'Modern Warfare'
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX idx_series_parent ON series(parent_series_id);

-- 3.7 Игры (каталог) -------------------------------------------------------------
CREATE TABLE games (
  id                 TEXT PRIMARY KEY,
  title              TEXT NOT NULL,
  sort_title         TEXT NOT NULL,          -- 'Witcher 3: Wild Hunt, The'
  slug               TEXT NOT NULL UNIQUE,
  alt_titles_json    TEXT NOT NULL DEFAULT '[]',  -- JSON массив строк (локализованные названия, аббревиатуры)
  category           TEXT NOT NULL DEFAULT 'main'
                     CHECK (category IN ('main','dlc','expansion','standalone_expansion','remake','remaster','port','bundle','mod','episode','season')),
  parent_game_id     TEXT REFERENCES games(id) ON DELETE SET NULL,     -- для dlc/expansion/remake → исходная игра
  release_date       TEXT,                    -- 'YYYY-MM-DD' | 'YYYY-MM' | 'YYYY'
  release_date_precision TEXT NOT NULL DEFAULT 'day' CHECK (release_date_precision IN ('day','month','quarter','year','tba')),
  release_year       INTEGER,                 -- денормализация для фильтра «год от/до»
  release_status     TEXT NOT NULL DEFAULT 'released' CHECK (release_status IN ('released','early_access','announced','tba','cancelled')),
  summary            TEXT,                    -- краткое описание (до ~1000 симв.)
  storyline          TEXT,                    -- сюжет (опционально)
  cover_image_id     TEXT REFERENCES images(id) ON DELETE SET NULL,     -- вертикальная 3:4 (предпочтительно 600×800)
  backdrop_image_id  TEXT REFERENCES images(id) ON DELETE SET NULL,     -- горизонтальная 16:9 для hero
  logo_image_id      TEXT REFERENCES images(id) ON DELETE SET NULL,
  metacritic_score   INTEGER CHECK (metacritic_score BETWEEN 0 AND 100),
  metacritic_url     TEXT,
  opencritic_score   INTEGER CHECK (opencritic_score BETWEEN 0 AND 100),
  igdb_rating        REAL,                    -- 0–100, пользовательский рейтинг IGDB (будущее)
  hltb_main_min      INTEGER,                 -- минуты, Main Story
  hltb_extra_min     INTEGER,                 -- Main + Extras
  hltb_complete_min  INTEGER,                 -- Completionist
  age_rating         TEXT,                    -- 'PEGI 18', 'ESRB M' — свободная строка
  website            TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX idx_games_sort_title ON games(sort_title);
CREATE INDEX idx_games_release_year ON games(release_year);
CREATE INDEX idx_games_parent ON games(parent_game_id);
CREATE INDEX idx_games_category ON games(category);

CREATE TABLE game_companies (
  game_id    TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('developer','publisher','co_developer','porting','supporting')),
  PRIMARY KEY (game_id, company_id, role)
);
CREATE INDEX idx_game_companies_company ON game_companies(company_id, role);

CREATE TABLE game_genres (
  game_id  TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  genre_id TEXT NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0,      -- один основной жанр для карточки
  PRIMARY KEY (game_id, genre_id)
);
CREATE INDEX idx_game_genres_genre ON game_genres(genre_id);

CREATE TABLE game_platforms (
  game_id     TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, platform_id)
);
CREATE INDEX idx_game_platforms_platform ON game_platforms(platform_id);

CREATE TABLE game_modes (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  mode_id TEXT NOT NULL REFERENCES modes(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, mode_id)
);

CREATE TABLE game_tags (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, tag_id)
);

CREATE TABLE series_games (
  series_id  TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  game_id    TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,                -- порядок в серии (1..N), перенумеровывается при drag-n-drop
  label      TEXT,                            -- 'Спин-офф', 'Ремейк', 'Основная линия' — опционально
  is_primary INTEGER NOT NULL DEFAULT 1,      -- «главная» серия игры (для карточки/крошек), если игра в нескольких сериях
  PRIMARY KEY (series_id, game_id)
);
CREATE INDEX idx_series_games_game ON series_games(game_id);
CREATE UNIQUE INDEX uq_series_games_pos ON series_games(series_id, position);

-- 3.8 Пользовательские данные по игре --------------------------------------------
CREATE TABLE user_game (
  game_id            TEXT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'backlog'
                     CHECK (status IN ('wishlist','backlog','playing','completed','shelved','dropped','played')),
  -- wishlist  — хочу, не владею
  -- backlog   — в бэклоге (владею/доступна, не начата)
  -- playing   — прохожу сейчас
  -- completed — пройдена (сюжет/основная цель)
  -- shelved   — отложена, планирую вернуться
  -- dropped   — брошена, не вернусь
  -- played    — поиграл без цели «пройти» (мультиплеер, песочница, рогалик)
  is_favorite        INTEGER NOT NULL DEFAULT 0,
  is_mastered        INTEGER NOT NULL DEFAULT 0,   -- 100 % / платина
  priority           INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3), -- 0 нет, 1 низкий, 2 средний, 3 высокий (сортировка бэклога)
  rating             INTEGER CHECK (rating BETWEEN 1 AND 10),  -- шкала 1–10; UI показывает 5 звёзд с половинками (1 балл = ½ звезды)
  playtime_minutes   INTEGER NOT NULL DEFAULT 0,               -- суммарно по игре
  playtime_mode      TEXT NOT NULL DEFAULT 'manual' CHECK (playtime_mode IN ('manual','sessions')),
                     -- manual: пользователь вводит число; sessions: = SUM(play_sessions.minutes) (будущее)
  times_completed    INTEGER NOT NULL DEFAULT 0,               -- сколько раз пройдена (реплеи)
  platform_id        TEXT REFERENCES platforms(id) ON DELETE SET NULL,   -- на чём играю/прошёл
  ownership          TEXT NOT NULL DEFAULT 'unknown'
                     CHECK (ownership IN ('unknown','none','digital','physical','subscription','pirated','sold')),
                     -- pirated — «пиратка» (решение пользователя 2026-09-07): владение, а не платформа;
                     -- участвует в фильтре «Владение», пироге владения в профиле и достижениях наравне с остальными
  store              TEXT,                    -- 'steam','epic','gog','psn','xbox','nintendo','battle_net','ubisoft','ea','itch','other'
  subscription_service TEXT,                  -- 'Game Pass','PS Plus Extra'… (если ownership = subscription)
  started_at         TEXT,                    -- 'YYYY-MM-DD'
  finished_at        TEXT,                    -- 'YYYY-MM-DD'
  added_at           TEXT NOT NULL,           -- когда игра попала в мой список (дата добавления)
  status_changed_at  TEXT NOT NULL,
  last_activity_at   TEXT NOT NULL,           -- любая правка user-данных / сессия
  resume_note        TEXT,                    -- «на чём остановился»
  notes              TEXT,                    -- приватные заметки (markdown)
  review             TEXT,                    -- отзыв (markdown)
  review_has_spoilers INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX idx_user_game_status ON user_game(status);
CREATE INDEX idx_user_game_rating ON user_game(rating);
CREATE INDEX idx_user_game_added ON user_game(added_at);
CREATE INDEX idx_user_game_finished ON user_game(finished_at);
CREATE INDEX idx_user_game_activity ON user_game(last_activity_at);

-- 3.9 Прохождения и сессии (схема — итерация 1, UI — итерация 2) ------------------
CREATE TABLE playthroughs (
  id               TEXT PRIMARY KEY,
  game_id          TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  number           INTEGER NOT NULL DEFAULT 1,   -- порядковый номер прохождения
  title            TEXT,                          -- 'NG+', 'Пацифист', 'На английском'
  platform_id      TEXT REFERENCES platforms(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','dropped')),
  is_replay        INTEGER NOT NULL DEFAULT 0,
  is_mastered      INTEGER NOT NULL DEFAULT 0,
  rating           INTEGER CHECK (rating BETWEEN 1 AND 10),
  playtime_minutes INTEGER NOT NULL DEFAULT 0,
  started_at       TEXT,
  finished_at      TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX idx_playthroughs_game ON playthroughs(game_id);

CREATE TABLE play_sessions (
  id              TEXT PRIMARY KEY,
  game_id         TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  playthrough_id  TEXT REFERENCES playthroughs(id) ON DELETE SET NULL,
  played_on       TEXT NOT NULL,       -- 'YYYY-MM-DD'
  minutes         INTEGER NOT NULL CHECK (minutes > 0),
  note            TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX idx_sessions_game ON play_sessions(game_id);
CREATE INDEX idx_sessions_day ON play_sessions(played_on);

-- 3.10 Пользовательские списки --------------------------------------------------
CREATE TABLE lists (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  description    TEXT,
  icon           TEXT,                        -- имя иконки (lucide), напр. 'coffee'
  color          TEXT,                        -- '#RRGGBB' акцент списка
  cover_image_id TEXT REFERENCES images(id) ON DELETE SET NULL,
  is_ranked      INTEGER NOT NULL DEFAULT 0,  -- показывать номера позиций
  sort_mode      TEXT NOT NULL DEFAULT 'manual' CHECK (sort_mode IN ('manual','title','release_date','added_at','rating')),
  sort_order     INTEGER NOT NULL DEFAULT 0,  -- порядок списков в сайдбаре
  is_pinned      INTEGER NOT NULL DEFAULT 1,  -- показывать в сайдбаре
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE list_items (
  list_id  TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  game_id  TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  note     TEXT,                              -- комментарий к позиции («лучшая часть»)
  added_at TEXT NOT NULL,
  PRIMARY KEY (list_id, game_id)
);
CREATE INDEX idx_list_items_game ON list_items(game_id);
CREATE UNIQUE INDEX uq_list_items_pos ON list_items(list_id, position);

-- 3.11 Внешние идентификаторы (для будущего импорта) -----------------------------
CREATE TABLE external_ids (
  entity_type TEXT NOT NULL CHECK (entity_type IN ('game','company','series','genre','platform')),
  entity_id   TEXT NOT NULL,
  provider    TEXT NOT NULL CHECK (provider IN ('igdb','steam','steamgriddb','hltb','metacritic','opencritic','rawg','wikidata','pcgamingwiki','twitch')),
  external_id TEXT NOT NULL,                 -- строкой: IGDB id, Steam appid, Wikidata Q-id…
  url         TEXT,
  raw_json    TEXT,                          -- последний сырой ответ провайдера (для повторного маппинга без запроса)
  raw_hash    TEXT,                          -- IGDB checksum либо sha256 ответа — детект изменений без сравнения JSON
  synced_at   TEXT,
  PRIMARY KEY (entity_type, entity_id, provider),
  UNIQUE (provider, entity_type, external_id)
);

-- Происхождение каждого поля (аналог Playnite «источник на поле»). Заполняется импортом (итерация 3),
-- но locked = 1 выставляется УЖЕ в итерации 1 при любой ручной правке поля через страницу модерации,
-- чтобы будущий импорт не затирал то, что пользователь правил руками.
CREATE TABLE field_provenance (
  entity_type TEXT NOT NULL,                 -- 'game','company','series'
  entity_id   TEXT NOT NULL,
  field       TEXT NOT NULL,                 -- 'summary','release_date','cover_image_id','metacritic_score'…
  provider    TEXT NOT NULL,                 -- 'manual' | 'igdb' | 'steam' | …
  fetched_at  TEXT NOT NULL,
  locked      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (entity_type, entity_id, field)
);

-- 3.12 Пресеты фильтров ---------------------------------------------------------
CREATE TABLE filter_presets (
  id           TEXT PRIMARY KEY,
  scope        TEXT NOT NULL CHECK (scope IN ('library','list','series','company','all')),
  name         TEXT NOT NULL,
  filters_json TEXT NOT NULL,                -- сериализованное состояние панели фильтров (см. документ 07)
  sort_json    TEXT NOT NULL,                -- {field, dir}
  view         TEXT NOT NULL DEFAULT 'grid' CHECK (view IN ('grid','list')),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- 3.13 Лента активности ---------------------------------------------------------
CREATE TABLE activity_log (
  id           TEXT PRIMARY KEY,
  happened_at  TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN (
                 'game_added','status_changed','rating_set','playtime_set','session_logged',
                 'list_created','list_item_added','list_item_removed','review_written','mastered_set',
                 'catalog_created','catalog_edited','achievement_unlocked')),
  game_id      TEXT REFERENCES games(id) ON DELETE SET NULL,
  entity_type  TEXT,                         -- для catalog_*: 'game','company','series','genre'
  entity_id    TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}'    -- напр. {"from":"backlog","to":"playing"} или {"rating":9}
);
CREATE INDEX idx_activity_time ON activity_log(happened_at DESC);
CREATE INDEX idx_activity_game ON activity_log(game_id);

-- 3.14 Достижения (будущее; таблица создаётся сразу) ------------------------------
CREATE TABLE user_achievements (
  achievement_key TEXT NOT NULL,             -- 'first_blood','backlog_minus','platinum'… определения — в коде
  level           INTEGER NOT NULL DEFAULT 1,
  progress_json   TEXT NOT NULL DEFAULT '{}',
  unlocked_at     TEXT,                      -- NULL = ещё не открыто (хранится прогресс)
  PRIMARY KEY (achievement_key, level)
);

-- 3.15 Полнотекстовый поиск ------------------------------------------------------
-- Если FTS5 доступен в сборке SQLite (better-sqlite3 собирает SQLite с ENABLE_FTS5; для запасного node:sqlite — проверить при старте),
-- создаётся внешняя таблица контента; иначе поиск — LIKE по sort_title/alt_titles (деградация допустима).
CREATE VIRTUAL TABLE search_index USING fts5(
  entity_type UNINDEXED,   -- 'game','company','series','list'
  entity_id   UNINDEXED,
  title,
  alt_titles,
  tokenize = 'unicode61 remove_diacritics 2'
);
-- Обновляется приложением при записи в games/companies/series/lists (не триггерами — логика в одном месте).
```

## 4. Правила целостности, реализуемые в коде (не в SQL)

| Правило | Где применяется |
|---|---|
| При смене `user_game.status` обновляются `status_changed_at`, `last_activity_at`; при переходе в `playing` без `started_at` — проставляется сегодня; при переходе в `completed` без `finished_at` — сегодня, `times_completed += 1` (если было `playing`/`backlog`/`shelved`) | сервис `userGame.setStatus` |
| `is_mastered = 1` допустим только при статусе `completed` или `played` | UI дизейблит чекбокс, сервис валидирует |
| `rating` можно ставить при любом статусе кроме `wishlist`/`backlog` (нельзя оценивать не игранное) | сервис + UI |
| `release_year` всегда = первые 4 цифры `release_date`, иначе NULL | сервис `games.save` |
| `sort_title` = title без ведущих артиклей (`The`, `A`, `An`), с переносом артикля в конец через запятую; для кириллицы — без изменений | утилита `makeSortTitle` |
| `slug` = транслит/латиница, lower-kebab, уникальность обеспечивается суффиксом `-2`, `-3` | утилита `makeSlug` |
| `series_games.position` и `list_items.position` перенумеровываются 1..N одной транзакцией после drag-n-drop | сервисы `series.reorder`, `lists.reorder` |
| `user_game` создаётся автоматически при первом действии пользователя над игрой (статус/оценка/список). Игра **без** `user_game` — «в каталоге, но не в моей библиотеке»; в списках библиотеки не показывается | сервис |
| При удалении `images` файл удаляется с диска в той же операции; при удалении сущности — все её изображения, не используемые другими | сервис `images.gc` |
| Каждая пишущая операция: `BEGIN; …; UPDATE meta SET value = value + 1 WHERE key = 'db_revision'; UPDATE meta … last_local_write_at; COMMIT;` | обёртка `db.write(fn)` |
| Все удаления сущностей первого уровня пишут `tombstones` | обёртка `db.deleteEntity(type,id)` |

## 5. Ключевые запросы (справочно)

**Прогресс списка / статуса** (кольцо «44/100»):
```sql
-- Для бэклога-библиотеки: числитель — completed (+ mastered), знаменатель — все игры пользователя кроме wishlist
SELECT
  SUM(status = 'completed') AS done,
  COUNT(*)                  AS total
FROM user_game WHERE status <> 'wishlist';

-- Для пользовательского списка
SELECT SUM(ug.status = 'completed') AS done, COUNT(*) AS total
FROM list_items li LEFT JOIN user_game ug ON ug.game_id = li.game_id
WHERE li.list_id = :list_id;

-- Для серии / студии — аналогично через series_games / game_companies
```

**Карточка игры в сетке** (одна строка на игру, без N+1):
```sql
SELECT g.id, g.title, g.release_year, g.category, g.metacritic_score,
       c.file_name AS cover_file, c.dominant_color,
       ug.status, ug.rating, ug.playtime_minutes, ug.is_mastered, ug.is_favorite, ug.priority, ug.added_at,
       (SELECT group_concat(ge.name, ', ') FROM game_genres gg JOIN genres ge ON ge.id = gg.genre_id WHERE gg.game_id = g.id ORDER BY gg.is_primary DESC) AS genres,
       (SELECT co.name FROM game_companies gc JOIN companies co ON co.id = gc.company_id WHERE gc.game_id = g.id AND gc.role = 'developer' LIMIT 1) AS developer
FROM games g
JOIN user_game ug ON ug.game_id = g.id
LEFT JOIN images c ON c.id = g.cover_image_id
WHERE /* фильтры, см. документ 07 */ 1
ORDER BY ug.added_at DESC
LIMIT :limit OFFSET :offset;
```

**Статистика профиля** — набор агрегатов одним запросом по `user_game` (`COUNT`/`SUM` по статусам, `SUM(playtime_minutes)`, `AVG(rating)`), плюс распределение оценок `GROUP BY rating`, плюс «пройдено по годам» `GROUP BY substr(finished_at,1,4)`, плюс жанры `JOIN game_genres … GROUP BY genre` и платформы. Все запросы — в одном модуле `stats.ts`, результаты кешируются в памяти и инвалидируются при любой записи.

## 6. Сид-данные (миграция `0002_seed.sql`)

- **Платформы** (~35): PC (Windows), Mac, Linux, Steam Deck, PS1–PS5, PSP, PS Vita, Xbox, Xbox 360, Xbox One, Xbox Series X|S, NES, SNES, N64, GameCube, Wii, Wii U, Switch, Switch 2, Game Boy, GBA, DS, 3DS, iOS, Android, Meta Quest, Sega Genesis, Dreamcast, Arcade, Browser, Other.
- **Жанры** (~25, по IGDB): Adventure, Action, Action RPG, RPG, JRPG, Shooter, Platformer, Puzzle, Strategy, RTS, Turn-based strategy, Tactical, Simulator, Sport, Racing, Fighting, Hack and slash, Point-and-click, Visual Novel, Roguelike, Metroidvania, Survival, Horror, Stealth, Sandbox, MOBA, Card & Board, Music, Indie (как тег-жанр), Arcade.
- **Режимы**: Одиночная, Кооператив, Мультиплеер, Split-screen, MMO, Battle Royale.
- **Профиль**: одна строка `id = 1`.
- **Meta**: `schema_version = 2`, `db_revision = 0`, `device_id` генерируется при первом запуске (и дублируется в локальный `settings.json`).

Демо-контент (несколько игр/студий/серий) **не** сидируется в релизной базе; для разработки существует отдельная команда `seed:demo`.

## 7. Файловая структура папки данных

```
<DataDir>/                      по умолчанию — <папка exe>/data/ (portable); переопределяется в настройках
├── backlog.db                  основная БД (WAL: backlog.db-wal, backlog.db-shm рядом — НЕ синхронизируются)
├── images/
│   └── ab/abf3…9c.webp         2 первых символа id = подпапка; всё в WebP (качество 85), логотипы могут быть PNG
├── settings.json               ЛОКАЛЬНЫЕ настройки этого ПК (путь к данным, окно, тема, параметры синка, device_id)
├── sync/
│   ├── state.json              состояние синхронизации (последняя ревизия/время, id файла на Диске)
│   └── snapshots/              временные снимки VACUUM INTO перед выгрузкой (очищаются)
├── backups/                    локальные автобэкапы backlog-YYYYMMDD-HHMM.db (хранить 10 последних)
└── logs/                       app.log с ротацией (5 × 2 МБ)
```

Размеры изображений при импорте/загрузке: обложка — вписать в 600×800 (3:4), фон — 1920×1080 max, логотип — 512×512 max, аватар — 512×512. Оригинал не хранится. Пересжатие в WebP выполняется на стороне приложения (renderer через Canvas/OffscreenCanvas либо нативно, см. документ 01).

## 8. Миграции

- Файлы `migrations/NNNN_name.sql`, применяются последовательно в транзакции; текущая версия хранится в `meta.schema_version`.
- Миграции **только вперёд**. Перед применением миграции приложение делает копию базы в `backups/`.
- При синхронизации: если из облака пришла база с `schema_version` выше, чем знает приложение, — показать блокирующее сообщение «Обновите приложение» и не открывать базу (не ломать данные).

## 9. Что из этого используется в итерации 1

| Таблица | Итерация 1 | Комментарий |
|---|---|---|
| meta, tombstones, profile, images | да | |
| platforms, genres, modes, tags | да | теги — минимально (создать/назначить/фильтр) |
| companies, series, games + связи | да | ручной ввод через страницу модерации |
| user_game | да | полный набор полей, кроме `playtime_mode = sessions` |
| playthroughs, play_sessions | схема да, UI нет | UI — итерация 2 |
| lists, list_items | да | |
| external_ids | схема да, запись нет | заполняется импортом (итерация 3) |
| field_provenance | да (только `provider = manual`, `locked = 1`) | полноценно — итерация 3 |
| filter_presets | да | |
| activity_log | да (запись + «последняя активность» в профиле) | heatmap/итоги года — итерация 2 |
| user_achievements | да | определения достижений — в коде (документ 09); `streak`/`night_owl` считаются с итерации 2 |
| search_index (FTS5) | да | глобальный поиск / Ctrl+K |
