-- Миграция 0001: полная схема (ТЗ 02 §3).
PRAGMA foreign_keys = ON;

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE tombstones (
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  deleted_at  TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE TABLE images (
  id             TEXT PRIMARY KEY,
  kind           TEXT NOT NULL CHECK (kind IN ('cover','backdrop','logo','avatar','banner','screenshot','list_cover','series_cover')),
  file_name      TEXT NOT NULL UNIQUE,
  mime           TEXT NOT NULL,
  width          INTEGER NOT NULL,
  height         INTEGER NOT NULL,
  size_bytes     INTEGER NOT NULL,
  sha256         TEXT NOT NULL,
  dominant_color TEXT,
  source         TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','igdb','steam','steamgriddb','wikimedia','other')),
  source_url     TEXT,
  attribution    TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX idx_images_sha ON images(sha256);

CREATE TABLE profile (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  display_name      TEXT NOT NULL DEFAULT 'Игрок',
  bio               TEXT,
  avatar_image_id   TEXT REFERENCES images(id) ON DELETE SET NULL,
  banner_image_id   TEXT REFERENCES images(id) ON DELETE SET NULL,
  favorite_game_ids TEXT NOT NULL DEFAULT '[]',
  preferences_json  TEXT NOT NULL DEFAULT '{}',
  xp                INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE platforms (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  short_name TEXT NOT NULL,
  family     TEXT NOT NULL CHECK (family IN ('pc','playstation','xbox','nintendo','mobile','vr','retro','other')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_custom  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE genres (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  color       TEXT,
  is_custom   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE modes (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  slug       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tags (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color      TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE companies (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  sort_name         TEXT NOT NULL,
  is_developer      INTEGER NOT NULL DEFAULT 1,
  is_publisher      INTEGER NOT NULL DEFAULT 0,
  country_code      TEXT,
  country_numeric   INTEGER,
  city              TEXT,
  founded_year      INTEGER,
  closed_year       INTEGER,
  description       TEXT,
  website           TEXT,
  logo_image_id     TEXT REFERENCES images(id) ON DELETE SET NULL,
  banner_image_id   TEXT REFERENCES images(id) ON DELETE SET NULL,
  parent_company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX idx_companies_sort ON companies(sort_name);
CREATE INDEX idx_companies_parent ON companies(parent_company_id);

CREATE TABLE series (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  sort_name        TEXT NOT NULL,
  kind             TEXT NOT NULL DEFAULT 'series' CHECK (kind IN ('series','franchise')),
  description      TEXT,
  cover_image_id   TEXT REFERENCES images(id) ON DELETE SET NULL,
  banner_image_id  TEXT REFERENCES images(id) ON DELETE SET NULL,
  parent_series_id TEXT REFERENCES series(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX idx_series_parent ON series(parent_series_id);
CREATE INDEX idx_series_sort ON series(sort_name);

CREATE TABLE games (
  id                     TEXT PRIMARY KEY,
  title                  TEXT NOT NULL,
  sort_title             TEXT NOT NULL,
  slug                   TEXT NOT NULL UNIQUE,
  alt_titles_json        TEXT NOT NULL DEFAULT '[]',
  category               TEXT NOT NULL DEFAULT 'main'
                         CHECK (category IN ('main','dlc','expansion','standalone_expansion','remake','remaster','port','bundle','mod','episode','season')),
  parent_game_id         TEXT REFERENCES games(id) ON DELETE SET NULL,
  release_date           TEXT,
  release_date_precision TEXT NOT NULL DEFAULT 'day' CHECK (release_date_precision IN ('day','month','quarter','year','tba')),
  release_year           INTEGER,
  release_status         TEXT NOT NULL DEFAULT 'released' CHECK (release_status IN ('released','early_access','announced','tba','cancelled')),
  summary                TEXT,
  storyline              TEXT,
  cover_image_id         TEXT REFERENCES images(id) ON DELETE SET NULL,
  backdrop_image_id      TEXT REFERENCES images(id) ON DELETE SET NULL,
  logo_image_id          TEXT REFERENCES images(id) ON DELETE SET NULL,
  metacritic_score       INTEGER CHECK (metacritic_score BETWEEN 0 AND 100),
  metacritic_url         TEXT,
  opencritic_score       INTEGER CHECK (opencritic_score BETWEEN 0 AND 100),
  igdb_rating            REAL,
  hltb_main_min          INTEGER,
  hltb_extra_min         INTEGER,
  hltb_complete_min      INTEGER,
  age_rating             TEXT,
  website                TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
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
  game_id    TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  genre_id   TEXT NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0,
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
CREATE INDEX idx_game_tags_tag ON game_tags(tag_id);

CREATE TABLE series_games (
  series_id  TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  game_id    TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  label      TEXT,
  is_primary INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (series_id, game_id)
);
CREATE INDEX idx_series_games_game ON series_games(game_id);
CREATE UNIQUE INDEX uq_series_games_pos ON series_games(series_id, position);

CREATE TABLE user_game (
  game_id              TEXT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
  status               TEXT NOT NULL DEFAULT 'backlog'
                       CHECK (status IN ('wishlist','backlog','playing','completed','shelved','dropped','played')),
  is_favorite          INTEGER NOT NULL DEFAULT 0,
  is_mastered          INTEGER NOT NULL DEFAULT 0,
  priority             INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
  rating               INTEGER CHECK (rating BETWEEN 1 AND 10),
  playtime_minutes     INTEGER NOT NULL DEFAULT 0,
  playtime_mode        TEXT NOT NULL DEFAULT 'manual' CHECK (playtime_mode IN ('manual','sessions')),
  times_completed      INTEGER NOT NULL DEFAULT 0,
  platform_id          TEXT REFERENCES platforms(id) ON DELETE SET NULL,
  ownership            TEXT NOT NULL DEFAULT 'unknown'
                       CHECK (ownership IN ('unknown','none','digital','physical','subscription','pirated','sold')),
  store                TEXT,
  subscription_service TEXT,
  started_at           TEXT,
  finished_at          TEXT,
  added_at             TEXT NOT NULL,
  status_changed_at    TEXT NOT NULL,
  last_activity_at     TEXT NOT NULL,
  resume_note          TEXT,
  notes                TEXT,
  review               TEXT,
  review_has_spoilers  INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX idx_user_game_status ON user_game(status);
CREATE INDEX idx_user_game_rating ON user_game(rating);
CREATE INDEX idx_user_game_added ON user_game(added_at);
CREATE INDEX idx_user_game_finished ON user_game(finished_at);
CREATE INDEX idx_user_game_activity ON user_game(last_activity_at);

CREATE TABLE playthroughs (
  id               TEXT PRIMARY KEY,
  game_id          TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  number           INTEGER NOT NULL DEFAULT 1,
  title            TEXT,
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
  id             TEXT PRIMARY KEY,
  game_id        TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  playthrough_id TEXT REFERENCES playthroughs(id) ON DELETE SET NULL,
  played_on      TEXT NOT NULL,
  minutes        INTEGER NOT NULL CHECK (minutes > 0),
  note           TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX idx_sessions_game ON play_sessions(game_id);
CREATE INDEX idx_sessions_day ON play_sessions(played_on);

CREATE TABLE lists (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  description    TEXT,
  icon           TEXT,
  color          TEXT,
  cover_image_id TEXT REFERENCES images(id) ON DELETE SET NULL,
  is_ranked      INTEGER NOT NULL DEFAULT 0,
  sort_mode      TEXT NOT NULL DEFAULT 'manual' CHECK (sort_mode IN ('manual','title','release_date','added_at','rating')),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_pinned      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE list_items (
  list_id  TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  game_id  TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  note     TEXT,
  added_at TEXT NOT NULL,
  PRIMARY KEY (list_id, game_id)
);
CREATE INDEX idx_list_items_game ON list_items(game_id);
CREATE UNIQUE INDEX uq_list_items_pos ON list_items(list_id, position);

CREATE TABLE external_ids (
  entity_type TEXT NOT NULL CHECK (entity_type IN ('game','company','series','genre','platform')),
  entity_id   TEXT NOT NULL,
  provider    TEXT NOT NULL CHECK (provider IN ('igdb','steam','steamgriddb','hltb','metacritic','opencritic','rawg','wikidata','pcgamingwiki','twitch')),
  external_id TEXT NOT NULL,
  url         TEXT,
  raw_json    TEXT,
  raw_hash    TEXT,
  synced_at   TEXT,
  PRIMARY KEY (entity_type, entity_id, provider),
  UNIQUE (provider, entity_type, external_id)
);

CREATE TABLE field_provenance (
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  field       TEXT NOT NULL,
  provider    TEXT NOT NULL,
  fetched_at  TEXT NOT NULL,
  locked      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (entity_type, entity_id, field)
);

CREATE TABLE filter_presets (
  id           TEXT PRIMARY KEY,
  scope        TEXT NOT NULL,
  name         TEXT NOT NULL,
  filters_json TEXT NOT NULL,
  sort_json    TEXT NOT NULL,
  view         TEXT NOT NULL DEFAULT 'grid' CHECK (view IN ('grid','list')),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE activity_log (
  id           TEXT PRIMARY KEY,
  happened_at  TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN (
                 'game_added','status_changed','rating_set','playtime_set','session_logged',
                 'list_created','list_item_added','list_item_removed','review_written','mastered_set',
                 'catalog_created','catalog_edited','achievement_unlocked')),
  game_id      TEXT REFERENCES games(id) ON DELETE SET NULL,
  entity_type  TEXT,
  entity_id    TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_activity_time ON activity_log(happened_at DESC);
CREATE INDEX idx_activity_game ON activity_log(game_id);

CREATE TABLE user_achievements (
  achievement_key TEXT NOT NULL,
  level           INTEGER NOT NULL DEFAULT 1,
  progress_json   TEXT NOT NULL DEFAULT '{}',
  unlocked_at     TEXT,
  PRIMARY KEY (achievement_key, level)
);

CREATE VIRTUAL TABLE search_index USING fts5(
  entity_type UNINDEXED,
  entity_id   UNINDEXED,
  title,
  alt_titles,
  tokenize = 'unicode61 remove_diacritics 2'
);
