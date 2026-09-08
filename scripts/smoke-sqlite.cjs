/**
 * Smoke-проверка better-sqlite3: нативный модуль грузится, WAL включается,
 * FTS5 доступен (ТЗ 01 §3, 02 §4). Запуск: node scripts/smoke-sqlite.cjs
 */
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.pragma('journal_mode = WAL')

db.exec("CREATE VIRTUAL TABLE fts USING fts5(title, tokenize='unicode61 remove_diacritics 2')")
db.prepare('INSERT INTO fts(title) VALUES (?)').run('Ведьмак 3: Дикая Охота')
db.prepare('INSERT INTO fts(title) VALUES (?)').run('Elden Ring')

const hits = db.prepare("SELECT title FROM fts WHERE fts MATCH 'ведьмак*'").all()
if (hits.length !== 1) throw new Error(`FTS5 вернул ${hits.length} строк вместо 1`)

console.log('sqlite:', db.prepare('SELECT sqlite_version() AS v').get().v)
console.log('FTS5: ок,', hits[0].title)
db.close()
