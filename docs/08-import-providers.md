# 08 · Импорт данных из внешних источников

> **Статус на 2026-09-08: реализованы Steam, RAWG и IGDB** — панель «Заполнить из источника»
> в форме игры, раздел «Настройки → Источники данных», каналы `providers.*`, запись
> `external_ids` и `field_provenance`. Данные запрашиваются на языке интерфейса, если у
> источника есть перевод. Что именно разошлось с этим текстом — в ADR 0007.
> Остальные провайдеры таблицы §2 (SteamGridDB, Wikidata, OpenCritic, Steam Web API)
> и массовый импорт библиотеки Steam — не реализованы.
>
> RAWG переведён из резерва в рабочие источники: приложение Twitch, без которого не получить
> токен IGDB, требует двухфакторной аутентификации по телефону и доступно не во всех странах.

Подробное исследование источников — `docs/research/03-external-apis.md`.

## 1. Что уже должно быть в итерации 1 (задел)

| Задел | Где | Зачем |
|---|---|---|
| Таблицы `external_ids`, `field_provenance` | документ 02 | привязка сущностей к IGDB/Steam id, защита ручных правок от перезаписи |
| `images.source / source_url / attribution` | документ 02 | лицензии и происхождение картинок |
| `release_date_precision`, `country_numeric`, `series.kind` | документ 02 | форматы провайдеров |
| Панель «Заполнить из источника» в форме игры (отключена) | документ 06 §7.3 | место в UI, чтобы не перекраивать форму |
| Все HTTP-запросы — только из backend-процесса; в UI — IPC-команды | документ 01 | CORS и секреты (IGDB и Steam не отдают CORS-заголовков) |
| Секция настроек «Источники данных» (заглушка) | документ 06 §8 | |
| Сервис изображений умеет принимать URL и скачивать в backend | документ 06 §7.7 | обложки по ссылке уже в итерации 1 |

## 2. Провайдеры и роли (целевое состояние)

| Провайдер | Ключ | Даёт | Приоритет по полям |
|---|---|---|---|
| **IGDB** (через Twitch client credentials) | пользователь вводит свои Client ID / Secret в настройках | игры, компании (страна, дата основания, parent, лого), collections/franchises = серии, жанры, режимы, платформы, обложки/арты, `external_games` (Steam appid), `game_time_to_beats` | основной для всего каталога |
| **Steam Store appdetails** | без ключа | metacritic score+url, developers/publishers (строками), header/hero/logo картинки, dlc[], release_date | Metacritic, hero-фон, DLC-список |
| **Steam Web API** | ключ пользователя + SteamID64 | `GetOwnedGames` (playtime_forever), достижения | импорт библиотеки и часов (отдельный мастер) |
| **SteamGridDB** | ключ пользователя | вертикальные обложки 600×900, hero, логотипы | альтернативные обложки (пикер) |
| **Wikidata** | без ключа, обязателен User-Agent | страна/город/год основания/parent/лого студий (+ лицензия с Commons) | студии |
| **OpenCritic** (RapidAPI) | ключ пользователя | оценка критиков | опционально |
| RAWG | ключ, backlink | резерв | выключен по умолчанию |

Запрещено: скрапинг HowLongToBeat, Metacritic, SteamDB. Время прохождения — из IGDB `game_time_to_beats`.

**Как это выглядит в реализации.** Пользователь просит «время с HLTB» и «данные из Steam/SteamDB» —
оба запроса выполняются, но через легальные точки входа:

| Что нужно | Откуда берётся | Почему не напрямую |
|---|---|---|
| Оценка Metacritic | Steam `appdetails.metacritic` (score + url) | у Metacritic нет публичного API, скрапинг сайта запрещён |
| Время прохождения (main / +extras / 100 %) | IGDB `game_time_to_beats` (`hastily` / `normally` / `completely`) | у HowLongToBeat нет API; неофициальные обёртки ломаются, Ziff Davis судится со скраперами |
| Данные по ссылке SteamDB | из ссылки берётся только `appid`, дальше запрашивается API самого Steam | у SteamDB нет публичного API, скрапинг карается автобаном |

## 3. Пользовательский сценарий «Заполнить из источника»

1. В форме игры пользователь вводит название → панель сверху: селектор провайдера (по умолчанию IGDB), кнопка «Найти» (`Ctrl+Enter`).
2. Поповер результатов: до 10 совпадений — обложка, название, год, платформы, разработчик; выбор → **превью-диалог маппинга**: две колонки «Сейчас в форме» / «Из IGDB», по каждому полю чекбокс «применить» (по умолчанию: пустые поля — да; заполненные вручную (`locked`) — нет; заполненные прошлым импортом — да). Картинки показываются превью, серии/компании — с пометкой «будет создана новая» или «совпадает с существующей: FromSoftware».
3. «Применить» → значения подставляются в форму (с подсветкой полей, изменённых импортом, и кнопкой «↺» у каждого для отката), связанные сущности **создаются при сохранении формы** (не раньше). Пользователь правит и сохраняет.
4. При сохранении пишутся `external_ids` (provider, external_id, raw_json, raw_hash) и `field_provenance` (provider = igdb для применённых полей).
5. На странице игры появляется кнопка «Обновить из IGDB»: повторяет шаги 2–4, но применяет только незаблокированные поля; если `raw_hash` не изменился — «Данных новых нет».

Массовый сценарий (позже): «Импорт библиотеки Steam» — мастер: ввод SteamID64 → список игр с чекбоксами → сопоставление с IGDB через `external_games` → создание игр + `user_game` со статусом по правилу (0 мин → бэклог, > 0 → поиграл/играю по выбору) + часы.

## 4. Архитектура

```
renderer ── IPC: providers.search(provider, query) ──▶ backend
                 providers.fetch(provider, externalId) ──▶   ├─ ProviderRegistry { igdb, steamStore, steamWeb, sgdb, wikidata, opencritic }
                 providers.applyPreview(...)                  ├─ RateLimiter (token bucket на провайдера)
                                                              ├─ TokenStore (DPAPI/safeStorage) + IGDB token refresh
                                                              ├─ Mapper: raw → CanonicalGame / CanonicalCompany / CanonicalSeries
                                                              └─ ImageFetcher → images/ (WebP, sha256, dominant_color, attribution)
```

- **Каноническая модель** (`CanonicalGame` и т.п.) — промежуточный тип, не зависящий от провайдера; в форму подставляется он. Маппер на провайдера — один файл на провайдера с юнит-тестами на сохранённых фикстурах ответов.
- **Лимиты**: IGDB 4 rps/8 параллельных; Steam appdetails ≤ 200/5 мин с бэкоффом 429→10 с, 403→5 мин; Wikidata ≤ 5 параллельных; всё — только по действию пользователя.
- **Кеш** ответов 24 ч в `sync/cache/` (ключ = provider+query/id), чтобы повторный поиск не тратил лимит.
- **Секреты**: только в защищённом хранилище ОС; никогда в `backlog.db`, `settings.json` и логах; экспорт данных их не включает.
- **Ошибки**: сеть/лимит → понятное сообщение и кнопка «Повторить через N с»; невалидные ключи → ссылка на настройки.

## 5. Маппинг полей (IGDB → наша схема)

| IGDB | Наше поле | Преобразование |
|---|---|---|
| `name` | `games.title` | как есть; `sort_title` — утилитой |
| `alternative_names[].name` | `alt_titles_json` | массив |
| `game_type.type` | `category` | Main Game→main, DLC→dlc, Expansion→expansion, Standalone expansion→standalone_expansion, Remake→remake, Remaster→remaster, Port→port, Bundle→bundle, Mod→mod, Episode→episode, Season→season |
| `parent_game` / `version_parent` | `parent_game_id` | ищем по `external_ids`, иначе предлагаем создать |
| `first_release_date` (unix) + `release_dates[].date_format` | `release_date`, `release_date_precision` | YYYY-MM-DD; формат → day/month/year/tba |
| `game_status` | `release_status` | Released→released, Early access→early_access, Alpha/Beta→early_access, Offline/Cancelled→cancelled, Rumored→announced |
| `summary`, `storyline` | одноимённые | |
| `cover.image_id` | `cover_image_id` | `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/{id}.jpg` → WebP 600×800 |
| `artworks[0].image_id` | `backdrop_image_id` | `t_1080p` |
| `genres[]`, `themes[]` | `game_genres` (жанры) + теги для тем | по `external_ids(genre)`, новые — создать |
| `game_modes[]` | `game_modes` | по имени |
| `platforms[]` | `game_platforms` | по `external_ids(platform)` / имени |
| `involved_companies[]` | `game_companies.role` | developer→developer, publisher→publisher, porting→porting, supporting→supporting |
| `involved_companies[].company.{name,country,start_date,parent,logo,url}` | `companies.*` | country numeric→alpha-2 по карте; `start_date`→`founded_year` |
| `collections[]` / `franchises[]` | `series` (kind = series/franchise) + `series_games` | позиция — в конец; кнопка «автонумерация по дате» |
| `aggregated_rating` | `opencritic_score`? — **нет**, хранится отдельно как `igdb_aggregated` (добавить поле при реализации) | |
| `rating` | `igdb_rating` | |
| `game_time_to_beats.{hastily,normally,completely}` (секунды) | `hltb_main_min` / `hltb_extra_min` / `hltb_complete_min` | /60, округление |
| `external_games[].uid` где source = Steam | `external_ids(provider=steam)` | затем запрос appdetails за Metacritic |
| `websites[]` | `website` (official), остальные — в `external_ids.url` | |
| `checksum` | `external_ids.raw_hash` | |

Steam appdetails → `metacritic_score/url`, `backdrop` (library_hero), логотип; `developers[]/publishers[]` — только для сопоставления с существующими компаниями (fuzzy ≥ 0.9), иначе предложить создать.

## 6. Что показывать пользователю о происхождении

- На странице игры в подвале: «Данные: IGDB (обновлено 3 сен), Metacritic: Steam» и обязательная атрибуция «Data from IGDB.com» в «О программе».
- У изображения (просмотр в полный размер): источник и лицензия/автор, если требуется.
- В форме: замочек у поля = `locked` (правилось вручную); клик снимает блокировку.

## 7. Критерии приёмки (для итерации 3)

1. Поиск по IGDB возвращает результаты ≤ 1.5 с при нормальной сети; ошибки лимита отображаются понятно.
2. Применение импорта не меняет ни одного поля с `locked = 1` без явного действия.
3. Повторный импорт с неизменённым `checksum` не делает записей.
4. Все запросы идут из backend; в WebView нет ключей (проверка: сетевые запросы из renderer к внешним хостам отсутствуют).
5. Картинки сохраняются с источником и `sha256`; дубликаты не создаются.
