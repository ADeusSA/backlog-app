# 01 · Стек, архитектура, сборка

Версии и факты проверены по первичным источникам 07.09.2026 (`docs/research/02-tech-verification.md`). Пометка `⚠ smoke` — проверить практически на первом шаге реализации (список — §13).

## 1. Решение по стеку

**Electron 44 + electron-vite 5 (Vite 7) · React 19 + TypeScript 5.9 · Tailwind CSS 4 + shadcn/ui · motion · TanStack Router/Query/Table/Virtual · better-sqlite3 13 (синхронный SQLite в main-процессе) · zero-dependency OAuth и Google Drive на `fetch` · electron-builder `dir` → zip как portable-поставка.**

Почему Electron, а не Tauri (решение пересмотрено после верификации):
- **Ничего не нужно устанавливать**: better-sqlite3 13 поставляется с готовыми N-API-бинарниками внутри пакета, компилятор и `@electron/rebuild` не требуются; запасной вариант — встроенный `node:sqlite` (работает в Electron ≥ 36.7 без флагов). Tauri потребовал бы Rust + MSVC Build Tools (~7–10 ГБ, 30–60 мин).
- **Один язык на всё**: репозитории, сервисы, синхронизация и OAuth — TypeScript в main-процессе; синхронный API SQLite (транзакции, `VACUUM INTO`, `backup()`) без async-обвязки. Для моделей-исполнителей это минимум трения: нет второго компилятора, нет capabilities-конфигов, огромный объём обучающих примеров.
- **Честный portable**: electron-builder таргет `dir` → zip папки; ничего не распаковывается во временную папку (в отличие от таргета `portable`).
- **Зрелая инфраструктура**: electron-vite активно поддерживается (5.0, 12.2025), Electron 44 (Chromium 152, Node 24.18) — тот же движок, что и WebView2, поэтому дизайн Aurora (backdrop-filter, color-mix, View Transitions) работает одинаково.
- Цена: ~200 МБ на диске, ~150–300 МБ RAM в покое, старт ~1.5 с. Для личного приложения — приемлемо. Если однажды понадобится 15-МБ сборка — Приложение T описывает переход на Tauri без изменения документов 02–10.

## 2. Подготовка машины разработчика

Уже есть: Node 22.17.1, npm 10.9, git 2.46, WebView2 (не нужен Electron, но не мешает). **Дополнительно ничего ставить не нужно.** Менеджер пакетов — **npm** (lockfile v3), чтобы избежать pnpm-специфичных проблем с хойстингом нативных модулей и electron-builder.

```powershell
# Скаффолд (шаблон electron-vite react-ts)
npm create @quick-start/electron@latest backlog -- --template react-ts
Set-Location backlog

# Зафиксировать тулчейн (electron-vite 5 требует Vite 7; @vitejs/plugin-react 6 требует Vite 8 — не ставить)
npm i -D electron@44.2.0 electron-vite@5.0.0 vite@7.3.6 @vitejs/plugin-react@5.2.0 electron-builder@26.15.3 typescript@5.9.3 @types/node@24

# UI
npm i react@19.2.8 react-dom@19.2.8 motion@13.2.0 lucide-react@1.41.0 @tanstack/react-router@1.170.33 @tanstack/react-query@5.102.8 @tanstack/react-table@8 @tanstack/react-virtual@3.14.10 zustand@5.0.15 @atlaskit/pragmatic-drag-and-drop@3.1.0 @atlaskit/pragmatic-drag-and-drop-hitbox @atlaskit/pragmatic-drag-and-drop-auto-scroll react-hook-form@7 zod@4 date-fns@4 uuidv7 i18next react-i18next react-easy-crop
npm i -D tailwindcss@4.3.3 @tailwindcss/vite@4.3.3 @tanstack/router-plugin tw-animate-css
npx shadcn@latest init        # style new-york, base color neutral, css variables: yes

# Данные и main-процесс
npm i better-sqlite3@13.0.3 electron-log
npm i -D @types/better-sqlite3 @electron/fuses

# Тесты и линт
npm i -D vitest @testing-library/react @testing-library/user-event jsdom eslint typescript-eslint eslint-plugin-react-hooks prettier playwright

# Smoke-тест SQLite без компилятора (должен напечатать версию)
node -e "console.log(require('better-sqlite3')(':memory:').prepare('select sqlite_version() v').get())"
```

## 3. Версии (зафиксированы 07.09.2026)

| Слой | Пакет | Версия | Примечание |
|---|---|---|---|
| Оболочка | `electron` | 44.2.0 | Chromium 152, Node 24.18 |
| Сборка | `electron-vite` / `vite` / `@vitejs/plugin-react` | 5.0.0 / **7.3.6** / **5.2.0** | Vite 8 не поддерживается electron-vite 5 |
| Упаковка | `electron-builder` | 26.15.3 | `npmRebuild: false`, таргет `dir` (+ `nsis` опционально) |
| Язык | `typescript` | 5.9.x | `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` |
| UI | `react`, `react-dom` | 19.2.x | |
| Стили | `tailwindcss`, `@tailwindcss/vite` | 4.3.x | токены через CSS-переменные и `@theme` (документ 04) |
| Компоненты | `shadcn` CLI 4.21 + Radix UI | latest | `tw-animate-css` вместо deprecated `tailwindcss-animate` |
| Иконки | `lucide-react` | 1.41.x | |
| Анимации | `motion` | 13.2.x | `import { motion, AnimatePresence, LayoutGroup } from "motion/react"` |
| Роутер | `@tanstack/react-router` + `@tanstack/router-plugin` | 1.170.x | `createHashHistory()` (§9) |
| Серверное состояние | `@tanstack/react-query` | 5.102.x | |
| Таблица / виртуализация | `@tanstack/react-table` 8 / `@tanstack/react-virtual` 3.14 | | |
| UI-состояние | `zustand` | 5.0.x | |
| Drag-n-drop | `@atlaskit/pragmatic-drag-and-drop` (+ `-hitbox`, `-auto-scroll`) | 3.1.x | `@dnd-kit/core` заморожен → не использовать |
| Формы | `react-hook-form` 7 + `zod` 4 | | zod-схемы общие для UI и IPC |
| Даты / ID | `date-fns` 4 / `uuidv7` | | |
| Изображения | OffscreenCanvas в renderer; кроппер `react-easy-crop` | | без нативных зависимостей (`sharp` не нужен) |
| i18n | `i18next`, `react-i18next` | latest | |
| SQLite | `better-sqlite3` | 13.0.3 | prebuilt N-API; запасной — `node:sqlite` |
| Логи | `electron-log` | latest | файл + консоль |
| Безопасность | `@electron/fuses` | latest | отключить `RunAsNode`, `EnableNodeCliInspectArguments`, включить `OnlyLoadAppFromAsar` |
| Тесты | `vitest`, Testing Library, `playwright` (`_electron`) | latest | e2e через `playwright._electron.launch` `⚠ smoke` |

ORM не используется: SQL из документа 02 пишется напрямую через prepared statements — один источник истины для схемы и запросов, проще для генерации и ревью.

## 4. Структура репозитория

```
backlog/
├── src/
│   ├── main/                         # Electron main = backend
│   │   ├── index.ts                  # app lifecycle, single instance, окно, протоколы, IPC-регистрация
│   │   ├── window.ts                 # BrowserWindow (titleBarOverlay, состояние окна)
│   │   ├── paths.ts                  # portable-режим, dataDir, backlog.config.json
│   │   ├── security.ts               # CSP, навигация, openExternal allow-list, permission handlers
│   │   ├── protocol.ts               # backlog-img:// → файлы из data/images
│   │   ├── ipc/                      # регистрация handlers: один файл на домен (games.ipc.ts, lists.ipc.ts, …)
│   │   │   └── register.ts           # типизированный handle() с zod-валидацией входа/выхода
│   │   ├── db/
│   │   │   ├── connection.ts         # открытие, прагмы, migrate(), write()-обёртка с ревизией, close/reopen
│   │   │   ├── migrations/           # 0001_init.sql, 0002_seed.sql … (import ?raw)
│   │   │   ├── repositories/         # games.repo.ts, user-game.repo.ts, lists.repo.ts, series.repo.ts, companies.repo.ts, images.repo.ts, activity.repo.ts, search.repo.ts, stats.repo.ts, presets.repo.ts, taxonomy.repo.ts
│   │   │   ├── query/                # collection-query-builder.ts (документ 07 §7.1) + tests
│   │   │   └── seed/                 # platforms.ts, genres.ts, modes.ts, demo/
│   │   ├── services/                 # бизнес-правила: user-game.service.ts (setStatus…), catalog.service.ts, lists.service.ts, series.service.ts, images.service.ts (запись файлов, sha256, gc), backups.service.ts, export-import.service.ts, settings.service.ts, activity.service.ts
│   │   ├── sync/                     # документ 03: oauth.ts (loopback+PKCE), drive.ts (API v3), engine.ts, state.ts, scheduler.ts, tokens.ts (safeStorage)
│   │   ├── images/                   # только файловые операции; декодирование/ресайз — в renderer
│   │   └── log.ts
│   ├── preload/
│   │   └── index.ts                  # contextBridge.exposeInMainWorld('backlog', api) — по одному методу на канал + подписки на события
│   ├── shared/                       # общее для main/preload/renderer (без Node и DOM API)
│   │   ├── ipc-contract.ts           # каналы, zod-схемы input/output, тип IpcApi
│   │   ├── schema/                   # zod-схемы сущностей и DTO (Game, UserGame, GameCardDto, Filters, Sort, …)
│   │   ├── constants/                # статусы, категории, роли, платформенные семейства
│   │   └── text.ts                   # makeSortTitle, makeSlug, translit (чистые функции)
│   └── renderer/
│       ├── index.html                # CSP meta, шрифты
│       └── src/
│           ├── app/                  # main.tsx, router.tsx, providers.tsx, shell/ (Titlebar, Rail/Sidebar, Breadcrumbs, CommandPalette, SyncIndicator, Toaster)
│           ├── features/             # library, collection, game, lists, series, companies, catalog, profile, settings, search, sync-ui, achievements (2), import (3)
│           ├── components/ui/        # shadcn-компоненты под токены
│           ├── lib/                  # motion.ts, color.ts, format.ts, hotkeys.ts, image-pipeline.ts (OffscreenCanvas → WebP)
│           ├── platform/             # api.ts (типизированный window.backlog), events.ts
│           ├── styles/               # tokens.css, globals.css, fonts.css
│           ├── assets/               # fonts/Manrope-*.woff2, logo.svg, illustrations/
│           └── i18n/                 # ru.json, en.json
├── resources/                        # иконки приложения (icon.ico/png)
├── docs/                             # это ТЗ
├── tests/e2e/                        # Playwright _electron смоуки
├── scripts/                          # gen-demo-db.ts, zip-portable.ts, check-tokens.ts
├── electron.vite.config.ts · electron-builder.yml · package.json · tsconfig.*.json · eslint.config.js · .prettierrc
```

Правила: `renderer` не импортирует из `main`; общий код — только `shared`; `features/*` не импортируют друг друга, кроме `collection` (используется всеми списковыми экранами) и `components/ui`.

## 5. Процессы и IPC

```
┌──────────── renderer (Chromium, sandbox) ────────────┐   contextBridge   ┌──────────── main (Node 24) ────────────┐
│ React · роутер · TanStack Query · motion              │◀────────────────▶│ ipc/: handle(channel, zodIn, zodOut, fn) │
│ image-pipeline: decode → resize → WebP (OffscreenCanvas)│  window.backlog  │ db/: better-sqlite3 (WAL), репозитории   │
│ читает картинки через backlog-img://<id>              │                  │ services/: правила, транзакции, ревизия  │
└────────────────────────────────────────────────────────┘                  │ sync/: OAuth loopback, Drive API (fetch)  │
                                                                            │ protocol.ts, security.ts, paths.ts       │
                                                                            └───────────────────────────────────────────┘
```

- **Контракт** `shared/ipc-contract.ts`: объект `channels = { 'games.getCard': { input: FiltersSchema, output: z.array(GameCardDto) }, 'userGame.setStatus': {...}, … }`. `main/ipc/register.ts` реализует `handle(channel, fn)`: валидирует `event.senderFrame.url` (только наш renderer), парсит вход zod-схемой, ловит ошибки → `{ ok: false, error: { code, message } }`. Preload генерирует `window.backlog[channel](input)` по тому же объекту; renderer использует `platform/api.ts` с выведенными типами. Никаких «сырых» `ipcRenderer.invoke` вне preload.
- **События main → renderer**: `webContents.send('event', { type, payload })` для `dbChanged({ tables })`, `dbReplaced`, `syncState`, `imagesDownloaded`; подписка через `window.backlog.on(type, cb)`.
- **Домены каналов**: `app.*` (paths, version, openExternal, openInExplorer), `catalog.*` (games/companies/series/genres/platforms/tags CRUD, merge), `library.*`/`collection.*` (query, facets, presets), `userGame.*`, `lists.*`, `series.*` (reorder), `images.*` (save(bytes, meta), delete, url), `profile.*`, `stats.*`, `activity.*`, `search.*`, `settings.*`, `backups.*`, `exportImport.*`, `sync.*`.
- Тяжёлые операции (экспорт zip, первичная загрузка картинок, генерация демо) — в main асинхронно с прогресс-событиями; при необходимости — `worker_threads`.

## 6. Слой данных (main)

- `better-sqlite3`: `new Database(dbPath)`; прагмы `journal_mode = WAL`, `synchronous = NORMAL`, `foreign_keys = ON`, `busy_timeout = 5000`, `temp_store = MEMORY`. Проверка `SELECT sqlite_compileoption_used('ENABLE_FTS5')` → флаг режима поиска (FTS5 / LIKE).
- **Миграции**: файлы `db/migrations/NNNN_*.sql` импортируются как `?raw`, применяются последовательно в транзакции; версия — `meta.schema_version`. Перед применением — копия базы в `backups/pre-migrate-<ts>.db`.
- **Обёртка записи** `db.write(fn)`: `BEGIN IMMEDIATE` → `fn(tx)` → `UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key = 'db_revision'` → `last_local_write_at` → `COMMIT`; ошибка → `ROLLBACK`. После коммита — `dbChanged({ tables })` в renderer + сигнал планировщику синхронизации. Сервисы пишут только через неё.
- Репозитории — prepared statements, кэшируются при открытии; возвращают DTO (документ 02 §5). Билдер фильтров — чистая функция `buildCollectionQuery(filters, sort, scope) → { sql, params }` с юнит-тестами на реальной in-memory SQLite (тот же драйвер, что в проде).
- Подмена файла базы (pull из облака, восстановление бэкапа): `close()` → `fs.renameSync` (атомарно на одном томе) → удалить `-wal/-shm` → открыть → `dbReplaced`. Все prepared statements пересоздаются.
- Снимок: `db.pragma('wal_checkpoint(TRUNCATE)')` → `db.exec(\`VACUUM INTO '<tmp>'\`)` (файл не должен существовать) либо `db.backup(path)`.

## 7. Изображения

Renderer (`lib/image-pipeline.ts`): источник (File / буфер обмена `navigator.clipboard.read()` / URL через `images.fetchUrl` в main) → `createImageBitmap` → `OffscreenCanvas` (обложка вписать в 600×800; фон ≤ 1920×1080; лого/аватар ≤ 512) → `convertToBlob({ type: 'image/webp', quality: 0.85 })` (лого с альфой → PNG) → `ArrayBuffer` + `dominant_color` (8×8 downsample, отбросить почти-чёрные/белые) → `images.save({ bytes, kind, width, height, mime, dominantColor })`. Main: `sha256` (`node:crypto`) → дедупликация → запись `data/images/ab/<uuid>.webp` → строка `images`. Показ: `<img src="backlog-img://<uuid>.webp" loading="lazy" decoding="async">` — кастомный протокол (`protocol.handle`), отдающий файлы **только** из `data/images` с `Cache-Control: immutable`.

## 8. Portable-режим, пути, окно

- Рядом с exe — `backlog.config.json` `{ "dataDir": "./data" }`. Логика (`main/paths.ts`, до `app.whenReady()`): если конфиг есть → использовать; иначе если папка exe доступна на запись → создать конфиг и `./data`; иначе → `%LOCALAPPDATA%\Backlog\data` (+ конфиг там). `app.setPath('userData', <dataDir>/cache)` и `app.setPath('sessionData', <dataDir>/cache)` **до** `ready` (папки создать заранее) — кеш Chromium живёт внутри `data/`, но исключён из бэкапов и синхронизации.
- Одна копия: `app.requestSingleInstanceLock()`; вторая — фокус окна.
- **Окно**: `BrowserWindow({ width, height, minWidth: 1024, minHeight: 680, show: false, backgroundColor: '#0B0D14', titleBarStyle: 'hidden', titleBarOverlay: { color: '#0B0D14', symbolColor: '#9AA3B8', height: 44 }, webPreferences: { preload, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false } })`; `ready-to-show` → `show()`. Собственный titlebar: `-webkit-app-region: drag` на области заголовка, `no-drag` на контролах; системные кнопки окна — от Window Controls Overlay (снап-раскладки Windows 11 работают, цвета кнопок меняются через `setTitleBarOverlay` при смене темы). Размер/позиция/максимизация — в `settings.json`, восстановление с проверкой `screen.getDisplayMatching`.
- **Безопасность** (`main/security.ts`): CSP через `session.defaultSession.webRequest.onHeadersReceived` **и** `<meta http-equiv>` в `index.html`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' backlog-img: blob: data:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'`. `will-navigate`/`setWindowOpenHandler` → запрет; `shell.openExternal` только `https:` из allow-list функции; `session.setPermissionRequestHandler` → всё запрещено, кроме `clipboard-read`. Fuses при сборке: `RunAsNode=false`, `EnableNodeCliInspectArguments=false`, `EnableEmbeddedAsarIntegrityValidation=true`, `OnlyLoadAppFromAsar=true`. Никаких `remote`, `eval`, `nodeIntegrationInWorker`.
- Внешние ссылки (сайт игры, Metacritic) — `app.openExternal(url)` через IPC с проверкой схемы.

## 9. Роутинг и состояние (renderer)

- TanStack Router с `createHashHistory()` (renderer грузится с `file://` внутри asar — hash-история не требует сервера). История назад/вперёд — `router.history.back()/forward()`; для списка истории (документ 05 §2) ведём стек заголовков в `uiStore` по событиям роутера. Состояние коллекции — в `search`-параметрах маршрута (`validateSearch` zod, сжатие base64url) → «назад» восстанавливает фильтры/вид/скролл.
- TanStack Query: ключи `['collection', scope, filtersHash]`, `['game', id]`, `['lists']`, `['series']`, `['companies']`, `['stats']`, `['profile']`; `staleTime: Infinity`; инвалидация по `dbChanged.tables` (карта таблица → ключи в `platform/events.ts`).
- Zustand: `uiStore` (сайдбар, плотность, выделение, панели фильтров по scope, стек истории), `syncStore`, `toastStore`. Настройки — `settings.*` каналы, кэш в `settingsStore`.
- Шрифты Manrope — локальные `woff2` (`fonts.css`, `font-display: swap`), предзагрузка `<link rel="preload">`.

## 10. Синхронизация (main, документ 03)

- OAuth loopback: `node:http` сервер на `127.0.0.1:0` (порт из `server.address()`), PKCE через `node:crypto`, открытие браузера `shell.openExternal`; обмен кода — глобальный `fetch`. Drive API v3 — тонкий клиент на `fetch` (`drive.ts`, ~200 строк): `files.list/get(alt=media)/create(multipart)/update(resumable)/copy/delete`. Никаких `googleapis`.
- Refresh-token — `safeStorage.encryptString` → `data/sync/token.bin` (DPAPI; расшифровывается только этим пользователем Windows на этом ПК → на другом ПК потребуется повторный вход, что и ожидается). `isEncryptionAvailable()` проверяется после `ready`; если недоступно — синхронизация отключена с объяснением.
- Планировщик и движок — по документу 03; при `before-quit` ждём завершения push (≤ 30 с), окно скрыто, показывается системный тост через `Notification`.

## 11. Сборка и распространение

`electron-builder.yml`:
```yaml
appId: dev.barmin.backlog
productName: Backlog
directories: { output: dist, buildResources: resources }
files: ["out/**/*", "package.json"]
asar: true
asarUnpack: ["**/*.node"]
npmRebuild: false                 # критично: иначе node-gyp попытается собрать better-sqlite3
win:
  target: [dir]                   # + { target: nsis } при желании установщика
  icon: resources/icon.ico
  artifactName: Backlog-${version}-win64.${ext}
```
`scripts/zip-portable.ts` упаковывает `dist/win-unpacked` → `Backlog-<version>-win64.zip` с переименованием папки в `Backlog/` и добавлением `README.txt` (что такое `backlog.config.json`, SmartScreen). Подпись кода не предусмотрена (SmartScreen: «Подробнее → Выполнить в любом случае» один раз). Обновления — вручную заменой папки; данные совместимы по `schema_version`. `electron.vite.config.ts`: main/preload — `externalizeDepsPlugin()` (better-sqlite3 остаётся внешним и грузится из `node_modules` внутри asar-unpacked), renderer — `@tailwindcss/vite`, `@tanstack/router-plugin`.

## 12. Dev-режим и скрипты

| Скрипт | Действие |
|---|---|
| `npm run dev` | electron-vite dev: main/preload перезапуск, renderer HMR |
| `npm run dev:web` | только renderer в браузере с `platform/api.mock.ts` (быстрая вёрстка) |
| `npm run build` / `npm run dist` | сборка `out/` / electron-builder `dir` + zip |
| `npm test` / `npm run test:e2e` | vitest (main: node env + in-memory SQLite; renderer: jsdom) / Playwright `_electron` |
| `npm run lint` / `npm run typecheck` | eslint + `tsc -p` для трёх tsconfig |
| `npm run gen:demo` | демо-база на 2 000 игр + 4 000 картинок-заглушек для нагрузочных проверок |
| маршрут `/dev/ui` | витрина компонентов во всех состояниях (только dev) |

Логи: `electron-log` → `data/logs/app.log`, ротация 5 × 2 МБ, `info` в prod, `debug` в dev; renderer логирует через IPC-канал `app.log`.

## 13. Smoke-проверки первого дня (блок 1.1 документа 10)

1. `better-sqlite3` 13 загружается внутри Electron 44 из asar-unpacked без сборки (`⚠ smoke`; запасной путь — `node:sqlite` c `external: ['node:sqlite']` в конфиге main).
2. `titleBarOverlay` даёт снап-раскладки Windows 11 и корректные цвета кнопок.
3. Протокол `backlog-img://` отдаёт WebP, `loading="lazy"` работает, CSP не блокирует.
4. `createHashHistory` + `router.history.back()` восстанавливает search-параметры.
5. `safeStorage.isEncryptionAvailable()` = true в portable-папке.
6. Portable zip запускается с флешки на чистой Windows 11, создаёт `data/` рядом.
7. Playwright `_electron.launch` открывает приложение (иначе e2e — через `dev:web` + мок).

## 14. Конвенции (сводка; полностью — документ 10 §3)

TypeScript strict во всех трёх пакетах; kebab-case файлы, PascalCase компоненты; один компонент — один файл; сервисы — функции над `Database`; ошибки — `AppError { code, message, cause? }` с локализацией кода в UI; цвета и длительности только из `tokens.css`/`motion.ts` (проверка `scripts/check-tokens.ts`); SQL — только в `main/db`; сетевые запросы — только в `main/sync` и (итерация 3) `main/import`.

## Приложение T — если позже понадобится Tauri 2

Меняются только `main`/`preload`: репозитории и сервисы переезжают либо в Rust (`rusqlite`), либо остаются в TS поверх `tauri-plugin-sql` (async API, путь к БД — проверить поддержку абсолютных путей); IPC — `invoke`-команды с тем же контрактом из `shared`; картинки — `asset://` с runtime-scope; секреты — `keyring` (Credential Manager); OAuth — `tauri-plugin-oauth`; portable — голый exe из `target/release` + `backlog.config.json`. Требуется Rust + MSVC Build Tools у разработчика. Документы 02–10 не меняются.
