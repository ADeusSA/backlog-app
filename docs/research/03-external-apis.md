# Исследование: публичные источники метаданных для будущего импорта

> Подготовлено исследовательским агентом 2026-09-07; факты проверены по официальным страницам на эту дату.
> В итерации 1 импорт не реализуется. Документ фиксирует требования к схеме и архитектуре, чтобы импорт был возможен позже без миграции данных.

## A) Таблица источников

| Источник | Доступ | Стоимость | Лимиты | Что даёт | Качество / ограничения ToS |
|---|---|---|---|---|---|
| **IGDB v4** ([docs](https://api-docs.igdb.com/)) | Twitch dev-app: `client_id`+`client_secret` → app access token (POST `https://id.twitch.tv/oauth2/token?...&grant_type=client_credentials`), заголовки `Client-ID` + `Authorization: Bearer` ([#authentication](https://api-docs.igdb.com/#authentication)) | Бесплатно и для non-commercial, и для commercial ([FAQ](https://api-docs.igdb.com/#business-related-faq)) | 4 req/s, ≤8 открытых запросов, 429 при превышении ([#rate-limits](https://api-docs.igdb.com/#rate-limits)); `limit` ≤500; multiquery ≤10 запросов; токен живёт 60 дней, ≤25 активных токенов | Игры, компании (страна, дата основания, parent, лого), **collections = серии**, franchises, жанры, темы, режимы, платформы, обложки/арты/скриншоты, external_games (Steam appid!), release_dates, age_ratings, websites, **game_time_to_beats** | Лучшая структура. FAQ: «Am I allowed to store/cache the data locally? Yes. In fact, we prefer if you store and serve the data». Нет CORS ([#cors](https://api-docs.igdb.com/#cors)) — запросы только из main/backend-процесса. |
| **Steam Store `appdetails`** | Без ключа: `https://store.steampowered.com/api/appdetails?appids=1245620&cc=us&l=en` | Бесплатно | Неофициально ~200 успешных запросов / 5 мин, затем 429/403; несколько `appids` работают только с `filters=price_overview` | name, developers, publishers, genres, categories, release_date (локализованная строка), **metacritic {score,url}**, header/capsule images, short/detailed_description, platforms, dlc[], achievements.total, recommendations.total | Недокументирован, «may change at any time». Нет CORS. Обложки CDN: `…/store_item_assets/steam/apps/{appid}/library_600x900_2x.jpg`, `library_hero.jpg`, `logo.png` (размеры по [Steamworks](https://partner.steamgames.com/doc/store/assets/libraryassets)). |
| **Steam Web API** | Ключ на [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) | Бесплатно | 100 000 вызовов/день ([Terms](https://steamcommunity.com/dev/apiterms)) | `IPlayerService/GetOwnedGames/v1` (appid, name, `playtime_forever` в минутах, rtime_last_played) — только если профиль публичен; `ISteamUserStats/GetPlayerAchievements/v1`, `GetSchemaForGame/v2`; `IStoreService/GetAppList/v1` | Нужна privacy policy при хранении непубличных данных. |
| **SteamDB** | — | — | — | — | Публичного API **нет**, скрапинг запрещён, авто-бан ([FAQ](https://steamdb.info/faq/)). |
| **SteamGridDB v2** ([docs](https://www.steamgriddb.com/api/v2)) | Ключ в профиле, `Authorization: Bearer` | Бесплатно | Лимиты не документированы; `limit` ≤50/страница | `/search/autocomplete/{term}`, `/games/steam/{appid}`, `/grids/game/{id}`, `/heroes/…`, `/logos/…`, `/icons/…`; фильтры `dimensions=600x900,…`, `styles`, `mimes`, `types`, `nsfw/humor/epilepsy` | Пользовательский контент, качество разное. [ToS](https://www.steamgriddb.com/terms): только personal, non-commercial use. |
| **RAWG** ([apidocs](https://rawg.io/apidocs)) | Ключ `?key=` | Free: 20 000 req/мес, non-commercial, **обязательный backlink на RAWG**; Business $149/мес | ≤100k MAU | games (search, metacritic, released, background_image, rating, playtime, stores, developers, publishers, genres, tags, game-series) | Большая база, но серии и роли компаний беднее IGDB. |
| **HowLongToBeat** | Официального API нет | — | — | main/extra/completionist | Неофициальные библиотеки регулярно ломаются; Ziff Davis судится со скраперами. **Безопасная альтернатива: IGDB `game_time_to_beats`** (hastily/normally/completely в секундах + count). |
| **Metacritic** | Публичного API нет | — | — | — | Легально: `metacritic.score/url` из Steam appdetails, поле `metacritic` в RAWG. |
| **OpenCritic** | Официальный API через [RapidAPI](https://rapidapi.com/opencritic-opencritic-default/api/opencritic-api) | Basic бесплатно: ~200 req/день | см. план | search, game details (score, tier), reviews | Хорошо для релизов с 2015+. |
| **PCGamingWiki** ([API](https://www.pcgamingwiki.com/wiki/PCGamingWiki:API)) | MediaWiki API; `cargoquery` требует логин по Bot Password | Бесплатно | 60 req/мин; обязателен User-Agent с контактами | Таблица `Game`: Developers, Publishers, Released, Cover_URL, Steam_AppID, GOGcom_ID… | Контент CC BY-NC-SA. |
| **Wikidata SPARQL** | Без ключа, `https://query.wikidata.org/sparql`, **User-Agent с контактом обязателен** | Бесплатно, CC0 | 60 с таймаут; 5 параллельных; 429 + Retry-After | Компании: P571 inception, P159 HQ, P17 country, P749 parent, P154 logo (Commons), P856 сайт, P576 dissolved. Игры: P178 dev, P123 pub, P577 дата, P179 серия. ID: P1733 Steam, P9043 IGDB numeric, P9650 IGDB company, P2816 HLTB, P1712 Metacritic, P2864 OpenCritic, P12561 SteamGridDB | Лицензия лого — у файла на Commons: `imageinfo&iiprop=extmetadata` → `LicenseShortName, Artist, AttributionRequired`. |
| **Playnite** (референс) | — | — | — | — | Плагин объявляет `SupportedFields`; пользователь на каждое поле задаёт упорядоченный список источников, первый non-null побеждает; `SkipExistingValues` = «только отсутствующие» ([docs](https://api.playnite.link/docs/tutorials/extensions/metadataPlugins.html)). |

## B) Приоритет провайдеров по полям

| Поле | 1-й | 2-й | 3-й |
|---|---|---|---|
| Название, slug, summary, storyline, дата первого релиза, жанры/темы/режимы, платформы | IGDB | Steam appdetails | RAWG |
| Серия (collection), франшиза | IGDB `collections`/`franchises` | Wikidata P179 | RAWG game-series |
| Разработчик/издатель + роли | IGDB `involved_companies` | Steam `developers/publishers` (строки, без ID) | Wikidata P178/P123 |
| Metacritic | Steam `metacritic` | RAWG `metacritic` | — |
| Критики / OpenCritic | OpenCritic API | IGDB `aggregated_rating` | — |
| Пользовательская оценка | IGDB `rating` | Steam `recommendations.total` | RAWG `rating` |
| Вертикальная обложка 600×900 | IGDB `cover` (`t_cover_big_2x`) | SteamGridDB `dimensions=600x900` | Steam CDN `library_600x900_2x.jpg` |
| Hero/фон | Steam `library_hero.jpg` | SteamGridDB heroes | IGDB artworks `t_1080p` |
| Логотип игры | SteamGridDB logos | Steam `logo.png` | — |
| Логотип студии | IGDB `company.logo` (`t_logo_med`) | Wikidata P154 → Commons (+лицензия) | — |
| Страна / год основания / parent студии | IGDB `company.country` (ISO numeric), `start_date`, `parent` | Wikidata P17/P571/P749/P159 | PCGW |
| Время прохождения | IGDB `game_time_to_beats` | ручной ввод | — |
| Playtime/achievements | Steam Web API | — | — |
| Маппинг Steam appid ↔ IGDB | IGDB `external_games` (source steam=1, gog=5, epic=26) | Wikidata P1733↔P9043 | SteamGridDB `/games/steam/{appid}` |
| Age rating | IGDB `age_ratings` | Steam `required_age` | RAWG `esrb_rating` |

## C) Требования к схеме (учтены в документе 02)

- `external_ids(entity_type, entity_id, provider, external_id, url, raw_json, raw_hash, synced_at)` с двумя уникальными индексами.
- `field_provenance(entity_type, entity_id, field, provider, fetched_at, locked)` — источник каждого поля; `locked = 1` после ручной правки, импорт такие поля не трогает.
- `images`: `source`, `source_url`, `attribution`, лицензия.
- Даты: ISO + точность (`day|month|year|tba`); страна: alpha-2 (+ numeric для IGDB).
- Роли компаний — флаги как в IGDB `involved_companies` (developer/publisher/porting/supporting).
- Игра может входить в несколько серий (IGDB collections — M:N).
- `provider_settings(provider, enabled, priority_json, credentials_ref, token_expires_at)` — итерация 3.

## D) Примеры запросов/ответов

**IGDB (Apicalypse)** — `POST https://api.igdb.com/v4/games`, заголовки `Client-ID`, `Authorization: Bearer …`, тело:

```
search "Elden Ring";
fields name, slug, summary, storyline, first_release_date, game_type.type, url, updated_at, checksum,
  aggregated_rating, aggregated_rating_count, rating, rating_count, total_rating,
  cover.image_id, cover.width, cover.height,
  genres.name, genres.slug, themes.name, game_modes.name, platforms.abbreviation,
  involved_companies.developer, involved_companies.publisher, involved_companies.porting, involved_companies.supporting,
  involved_companies.company.name, involved_companies.company.slug, involved_companies.company.country,
  involved_companies.company.start_date, involved_companies.company.logo.image_id,
  collections.name, collections.slug, franchises.name, franchises.slug,
  external_games.uid, external_games.url, external_games.external_game_source.name,
  release_dates.date, release_dates.human, release_dates.platform.abbreviation,
  websites.url, websites.type.type;
where version_parent = null;
limit 5;
```

Ответ (сокращённо, значения иллюстративные):

```json
[{
  "id": 119133, "name": "Elden Ring", "slug": "elden-ring",
  "first_release_date": 1645747200,
  "aggregated_rating": 94.6, "aggregated_rating_count": 31, "rating": 91.8, "rating_count": 1900,
  "summary": "...", "storyline": "...",
  "game_type": {"id": 0, "type": "Main Game"},
  "cover": {"id": 224932, "image_id": "co4jni", "width": 1200, "height": 1600},
  "genres": [{"id": 12, "name": "Role-playing (RPG)", "slug": "role-playing-rpg"}],
  "involved_companies": [
    {"developer": true, "publisher": false, "porting": false, "supporting": false,
     "company": {"id": 248, "name": "FromSoftware", "slug": "fromsoftware", "country": 392,
                 "start_date": 531187200, "logo": {"image_id": "cl1xy"}}},
    {"developer": false, "publisher": true, "company": {"name": "Bandai Namco Entertainment", "slug": "bandai-namco-entertainment", "country": 392}}
  ],
  "collections": [{"name": "Elden Ring", "slug": "elden-ring"}],
  "franchises": [{"name": "Elden Ring", "slug": "elden-ring"}],
  "external_games": [{"uid": "1245620", "url": "https://store.steampowered.com/app/1245620",
                      "external_game_source": {"name": "Steam"}}],
  "url": "https://www.igdb.com/games/elden-ring", "updated_at": 1725000000
}]
```

URL картинки: `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co4jni.jpg` (размеры: cover_small 90×128, cover_big 264×374, logo_med 284×160, screenshot_huge 1280×720, 720p, 1080p; `_2x` retina) ([#images](https://api-docs.igdb.com/#images)).

**Steam appdetails** (сокращён): `GET https://store.steampowered.com/api/appdetails?appids=1245620&cc=us&l=en`

```json
{"1245620": {"success": true, "data": {
  "type": "game", "name": "ELDEN RING", "steam_appid": 1245620, "required_age": "16", "is_free": false,
  "dlc": [3655690, 2778590, 2778580],
  "short_description": "...", "detailed_description": "<html>",
  "header_image": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg",
  "developers": ["FromSoftware, Inc."], "publishers": ["FromSoftware, Inc.", "Bandai Namco Entertainment"],
  "platforms": {"windows": true, "mac": false, "linux": false},
  "metacritic": {"score": 94, "url": "https://www.metacritic.com/game/pc/elden-ring"},
  "categories": [{"id": 2, "description": "Single-player"}, {"id": 22, "description": "Steam Achievements"}],
  "genres": [{"id": "1", "description": "Action"}, {"id": "3", "description": "RPG"}],
  "recommendations": {"total": 830325}, "achievements": {"total": 42},
  "release_date": {"coming_soon": false, "date": "Feb 24, 2022"}
}}}
```

Маппинг: `developers[]`/`publishers[]` — только строки (нужен fuzzy-match на `companies.name`/aliases); `release_date.date` — локализованная строка, парсить с учётом `l=en`.

## E) Подводные камни

1. **CORS.** IGDB и Steam не отдают `Access-Control-Allow-Origin`; из WebView запросы невозможны и утекут токен. Все HTTP-вызовы — из backend-процесса приложения (Rust-ядро Tauri либо main-процесс Electron), в UI — через IPC.
2. **Секреты.** `client_secret` IGDB нельзя вшивать в дистрибутив. Пользователь вводит свои ключи (как Playnite); хранить в защищённом хранилище ОС (DPAPI). Кешировать токен с `expires_in`.
3. **Лимиты.** Очередь с token-bucket: IGDB 4 rps/8 concurrent; Steam appdetails ~200/5 мин (бэкофф 429→10 с, 403→5 мин); PCGW 60/мин; Wikidata 5 параллельных + User-Agent; RAWG 20k/мес; OpenCritic 200/день. Все запросы — по действию пользователя, не фоновым скрапом.
4. **Кеширование.** Хранить `raw_json` + `synced_at` + IGDB `checksum`, чтобы переимпорт не перезаписывал ручные правки (`field_provenance.locked`). Картинки качать в локальное хранилище (IGDB удаляет заменённые через 30 дней); хранить источник/лицензию/атрибуцию.
5. **Миграция IGDB enum→таблицы**: использовать `game_type`, `game_status`, `external_game_source`, `date_format`, `release_region`, `websites.type`, `collections` вместо устаревших `category`, `status`, `media`, `region`, `collection` ([migration](https://api-docs.igdb.com/#migration-enums-to-tables)).
6. **Форматы.** Страна: IGDB numeric vs alpha-2 — хранить оба. Даты: unix у IGDB, строка у Steam, `YYYY-MM-DD`/`tba` у RAWG — хранить ISO + точность. Steam `success:false` для delisted/региона.
7. **Юридика.** HLTB/Metacritic/SteamDB — без скрапинга; время прохождения — IGDB `game_time_to_beats`, Metacritic — из Steam/RAWG, критики — OpenCritic через RapidAPI. Держать видимую атрибуцию «Data from IGDB.com».
