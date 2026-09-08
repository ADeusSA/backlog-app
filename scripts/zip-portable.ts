/**
 * Portable-поставка (ТЗ 01 §11): упаковывает `dist/win-unpacked` в
 * `dist/Backlog-<version>-win64.zip`, переименовывая корневую папку в `Backlog/`
 * и добавляя README.txt с пояснениями про `backlog.config.json` и SmartScreen.
 *
 * Запуск: npx tsx scripts/zip-portable.ts  (входит в `npm run dist`)
 */
import fs from 'node:fs'
import path from 'node:path'
import { createZip, type ZipEntry } from '../src/main/backup/zip'

const ROOT = path.resolve(import.meta.dirname ?? __dirname, '..')
const UNPACKED = path.join(ROOT, 'dist', 'win-unpacked')
const DIST = path.join(ROOT, 'dist')

const README = `Backlog — приложение для ведения бэклога видеоигр

Как запустить
  Распакуйте папку целиком и запустите Backlog.exe.
  Приложение переносимое: устанавливать ничего не нужно.

Где лежат данные
  Рядом с Backlog.exe появится файл backlog.config.json со строкой { "dataDir": "./data" }
  и папка data/ — в ней база backlog.db, изображения, резервные копии и журналы.
  Чтобы перенести библиотеку на другой компьютер, скопируйте папку целиком.
  Можно указать в backlog.config.json другой путь, в том числе абсолютный.

SmartScreen
  Сборка не подписана сертификатом, поэтому при первом запуске Windows может показать
  окно «Windows защитила ваш компьютер». Нажмите «Подробнее» → «Выполнить в любом случае».

Обновление
  Замените файлы приложения новой версией, папку data/ не трогайте — данные совместимы.
`

function walk(dir: string, base = dir, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, base, out)
    else out.push(path.relative(base, full))
  }
  return out
}

function main(): void {
  if (!fs.existsSync(UNPACKED)) {
    console.error(`Не найдено ${UNPACKED}. Сначала выполните: npx electron-builder --dir`)
    process.exit(1)
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
    version: string
  }
  const files = walk(UNPACKED)
  const entries: ZipEntry[] = files.map((rel) => ({
    name: `Backlog/${rel.split(path.sep).join('/')}`,
    data: fs.readFileSync(path.join(UNPACKED, rel))
  }))
  entries.push({ name: 'Backlog/README.txt', data: Buffer.from(README, 'utf8') })

  const target = path.join(DIST, `Backlog-${pkg.version}-win64.zip`)
  fs.writeFileSync(target, createZip(entries))

  const sizeMb = (fs.statSync(target).size / 1024 / 1024).toFixed(1)
  const unpackedMb = (
    files.reduce((sum, rel) => sum + fs.statSync(path.join(UNPACKED, rel)).size, 0) /
    1024 /
    1024
  ).toFixed(1)
  console.log(`Готово: ${path.relative(ROOT, target)}`)
  console.log(`  файлов: ${entries.length}, архив: ${sizeMb} МБ, распакованная папка: ${unpackedMb} МБ`)
  console.log('  Требования ТЗ 10 §2: архив ≤ 250 МБ, распакованная папка ≤ 400 МБ')
}

main()
