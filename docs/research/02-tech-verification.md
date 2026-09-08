# Верификация стека (данные на 07.09.2026)

> Подготовлено исследовательским агентом по первичным источникам (npm registry, официальные доки, GitHub). Служит основанием для документа 01.

## 1. Electron

### 1a. Версия
- **Electron 44.2.0** — `latest` в npm (2026-09-04). Electron 44.0.0 (25.08.2026): Chromium 152, V8 15.2, **Node.js 24.18.1**; поддерживаются 3 последних мажора (44/43/42); 32-битных Windows-сборок больше нет ([блог](https://www.electronjs.org/blog/electron-44-0), [timelines](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)). `engines: node >= 22.12` — Node 22.17.1 подходит.

### 1b. `node:sqlite` в main-процессе
- **Работает без флагов** в Electron ≥ 36.7.3 / 37 / 38 и новее (PR [#47706](https://github.com/electron/electron/pull/47706) + бэкпорты). В Node 24 модуль — Stability 1.2 (Release candidate), есть `backup()` ([Node docs](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)).
- Подводный камень: Vite может выдать «Module 'node:sqlite' has been externalized» — лечится `build.rollupOptions.external: ['node:sqlite']` в конфиге main (не проверено на практике).

### 1c. better-sqlite3 без Visual Studio
- **v13.0.3** (2026-08-05); v13.0.0 — первая версия на **Node-API**; бинарники лежат **внутри npm-тарбола** (`prebuilds/win32-x64.node` и ещё 7 платформ), `"gypfile": false`, install-скрипта нет → `npm install` **не вызывает компилятор**; загрузчик выбирает `prebuilds/${platform}-${arch}.node` без привязки к версии Node/Electron (N-API 10) ([v13.0.0](https://github.com/WiseLibs/better-sqlite3/releases/tag/v13.0.0), [binding.js](https://unpkg.com/better-sqlite3@13.0.3/lib/binding.js)).
- **`@electron/rebuild` не нужен.** Pain points Windows: (1) electron-builder по умолчанию `npmRebuild: true` → вызовет node-gyp → упадёт без MSVC → ставить **`npmRebuild: false`** (v26 — корневой ключ; v27 — `nativeModules.npmRebuild`); (2) `.node` нельзя грузить из asar — electron-builder распаковывает `**/*.node` автоматически, при проблемах — `asarUnpack`.

### 1d. electron-builder: portable vs dir/zip
- **electron-builder 26.15.3** (`next` 27.0.0-alpha.8). Windows-таргеты: nsis, nsis-web, portable, appx, msix, msi, squirrel, 7z, zip, tar.*, **dir**.
- **`portable`** — NSIS-обёртка: при каждом запуске извлекает ~200 МБ в `%TEMP%`, ставит `PORTABLE_EXECUTABLE_DIR`/`PORTABLE_EXECUTABLE_FILE`, после выхода удаляет. Минусы: медленный старт, антивирусы, плавающий `__dirname`, краш при двойном запуске с фиксированным `unpackDirName`.
- **Рекомендация: `dir` → папка `win-unpacked` → zip** (или таргет `zip`) — «честный portable». Обнаружение режима: маркер-файл рядом с `path.dirname(process.execPath)` + проверка записи (`fs.accessSync(dir, W_OK)`), иначе `app.getPath('userData')`. `app.setPath('userData', …)` — **до `ready`**, папку создать заранее.
- Подпись: без сертификата SmartScreen предупреждает; для личного приложения — не подписывать.

### 1e. Скаффолдинг
| Инструмент | Версия | Состояние |
|---|---|---|
| **electron-vite** | 5.0.0 (2025-12-07), peer `vite ^5‖^6‖^7`; 6.0.0-beta добавляет Vite 8 | активен, шаблон react-ts |
| vite-plugin-electron | 1.1.2 (2024-08) | ~2 года без релизов |
| Electron Forge + Vite | Forge 7.11.2; Vite-плагин «experimental» | нет portable/zip-удобств |

Команда: `npm create @quick-start/electron@latest backlog-app -- --template react-ts`. Шаблон даёт electron ^39, electron-vite ^5, vite ^7.2, @vitejs/plugin-react ^5.1, react ^19.2, TS ^5.9, electron-builder ^26 — затем поднять electron до 44. **Важно:** Vite `latest` = 8.2.2, но electron-vite 5 требует Vite ≤ 7 → **vite 7.3.6** и **@vitejs/plugin-react 5.2.0** (6.x требует Vite 8).

### 1f. Security checklist ([source](https://www.electronjs.org/docs/latest/tutorial/security))
Дефолты: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. Делать: preload только через `contextBridge.exposeInMainWorld` («один метод на IPC-сообщение»); `ipcMain.handle` с валидацией `event.senderFrame` и входа (zod); CSP; запрет навигации и `setWindowOpenHandler`; `shell.openExternal` только allow-list; не отключать `webSecurity`; кастомный протокол вместо `file://` (или hash-роутинг); fuses.

### 1g. safeStorage
На Windows — DPAPI; `isEncryptionAvailable()` после `ready`; расшифровать может только тот же пользователь Windows. В portable-режиме работает, но зашифрованный refresh-token **не переносится на другой ПК** — при ошибке `decryptString` повторить OAuth-логин.

## 2. Tauri 2 (для сравнения)
- Пререквизиты: MSVC Build Tools («Desktop development with C++»), Rust (`rustup default stable-msvc`), WebView2. Практически ≈ 7–10 ГБ и 30–60 мин (оценка).
- `tauri-plugin-sql` 2.4.1: sqlx, **асинхронный** API, путь SQLite относительно `AppConfig` (абсолютные пути — не подтверждено), миграции в Rust. Официального OAuth-плагина нет (сообщество: `tauri-plugin-oauth` 2.1.0). Portable-таргета нет — только голый exe из `target/release`.
- **Вердикт агента:** без Rust/MSVC Tauri означает ~10 ГБ инструментов, Rust-код для миграций/OAuth, async-SQLite и отсутствие portable-таргета. **Electron — прагматичный выбор**; контраргументы (размер ~200 МБ, память) для личного трекера не критичны.

## 3. Google Drive

### 3a. OAuth для Desktop ([native-app](https://developers.google.com/identity/protocols/oauth2/native-app), [overview](https://developers.google.com/identity/protocols/oauth2))
- Loopback `http://127.0.0.1:PORT` (произвольный порт); PKCE S256; OOB не поддерживается; custom-URI-схемы больше не поддерживаются.
- `client_secret` для Desktop-клиента выдаётся; официально: «the client secret is obviously not treated as a secret» → встраивать допустимо.
- 2025–26: консоль — раздел **Google Auth Platform**; секрет показывается **только при создании**; клиенты, неактивные 6 месяцев, удаляются.
- **Подтверждено:** статус Testing → refresh-token живёт **7 дней**, лимит 100 тест-пользователей; лимит 100 refresh-токенов на аккаунт на client_id; 6 месяцев неиспользования → отзыв. Решение: **Publish app** — для non-sensitive scopes верификация не нужна.

### 3b. Scopes ([api-specific-auth](https://developers.google.com/workspace/drive/api/guides/api-specific-auth))
- `drive.file` и `drive.appdata` — оба **non-sensitive**. `drive.appdata`: папка скрыта, удаляется при отключении приложения — плохо для видимого бэкапа. **Рекомендация: `drive.file`.**

### 3c. Drive API v3
- Upload: `multipart` (≤ 5 МБ) `POST …/upload/drive/v3/files?uploadType=multipart`; `resumable` для > 5 МБ (сессия → `PUT` чанками кратно 256 КБ, `308 Resume Incomplete`). Обновление — `PATCH …/upload/drive/v3/files/{id}?uploadType=…`. Скачивание — `GET files/{id}?alt=media`.
- Поиск: `q = "name = 'backlog.db' and 'FOLDER_ID' in parents and trashed = false"`, `appProperties has { key='deviceId' and value='…' }`, `fields=files(id,name,modifiedTime,md5Checksum,sha256Checksum,version,appProperties)`.
- **Квоты**: quota units — 1 000 000/мин/проект, 325 000/мин/пользователь; get=5, list=100, download=200, update=50; при 403/429 — экспоненциальный backoff.

### 3d. Библиотеки
- `googleapis` 178 — 213 МБ unpacked — не для бандла. `google-auth-library` 11 — приемлемо, но тянет зависимости.
- **Рекомендация: zero-dependency** — `node:http` для loopback, `node:crypto` для PKCE, глобальный `fetch` (Node 24) для token/Drive.

### 3e. SQLite и снапшоты
- `VACUUM INTO 'tmp.db'` — consistent snapshot, файл не должен существовать ([lang_vacuum](https://sqlite.org/lang_vacuum.html)); либо `db.backup()` better-sqlite3 / `backup()` node:sqlite. Никогда не копировать `.db` при живом `-wal`; перед копированием `PRAGMA wal_checkpoint(TRUNCATE)` ([wal.html](https://sqlite.org/wal.html)).

## 4. Frontend (npm `latest`, 07.09.2026)

| Пакет | Версия | Заметки |
|---|---|---|
| react / react-dom | 19.2.8 | |
| vite | 8.2.2 (latest) / **7.3.6** (для electron-vite 5) | |
| tailwindcss + @tailwindcss/vite | 4.3.3 | |
| shadcn (CLI) | 4.21.0 | Tailwind v4 + React 19, `@theme`, `tw-animate-css` |
| motion | 13.2.0 | react ^18‖^19 |
| lucide-react | 1.41.0 | |
| @tanstack/react-router | 1.170.33 | `createHashHistory()` для file:///без сервера |
| @tanstack/react-query | 5.102.8 | |
| zustand | 5.0.15 | |
| drizzle-orm / drizzle-kit | 0.45.2 / 0.31.10 (stable, better-sqlite3) | node-sqlite драйвер только в 1.0 RC |
| @dnd-kit/core + sortable | 6.3.1 + 10.0.0 | core заморожен с 12.2024; `@dnd-kit/react` 0.5.0 pre-1.0 |
| @atlaskit/pragmatic-drag-and-drop | 3.1.0 | активен — **предпочтительно** |
| react-virtuoso / @tanstack/react-virtual | 4.18.13 / 3.14.10 | Virtuoso имеет `VirtuosoGrid` |
| sharp | 0.35.4 | prebuilt, работает в Electron; нужен `asarUnpack` — опционально |
| better-sqlite3 | 13.0.3 | см. 1c |
| electron / electron-builder / electron-vite | 44.2.0 / 26.15.3 / 5.0.0 | |

**Проблемное/устаревшее:** `vite-plugin-electron`; `@vitejs/plugin-react` 6.x несовместим с Vite 7; `@dnd-kit/core` фактически legacy; `googleapis` тяжёл; `drive.appdata` не подходит; `tailwindcss-animate` deprecated → `tw-animate-css`. Ресайз обложек — через `OffscreenCanvas`/`canvas.toBlob(cb, 'image/webp', 0.8)` в renderer без native-зависимостей.

## 5. Не удалось проверить явно
1. Практический запуск better-sqlite3 13 внутри Electron 44 (автор: «should theoretically work») — нужен smoke-test.
2. Точный размер/время установки MSVC + Rust.
3. Работоспособность `external: ['node:sqlite']` как обходного пути в electron-vite.
4. Поддержка абсолютных путей SQLite в tauri-plugin-sql.
5. safeStorage в portable-режиме — вывод из свойств DPAPI, официальной формулировки нет.
