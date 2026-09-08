-- 0003 · Журнал сессий и прохождения (ТЗ 10 §1, итерация 2)
--
-- Сами таблицы `playthroughs` и `play_sessions` созданы в 0001_init.sql — здесь только то,
-- чего в них не хватило для UI (см. ADR 0008):
--   * время начала сессии — для достижения «Сова» (09 §3: «если время сессий ведётся»)
--     и разбивки активности по часам суток; необязательное, формат 'HH:MM';
--   * индекс по прохождению — журнал сессий читается и целиком по игре, и по прохождению.

ALTER TABLE play_sessions ADD COLUMN started_at_time TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_playthrough ON play_sessions(playthrough_id);
