import type { ReactElement } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { addDays, dayDiff, monthOf, startOfWeek, weekdayIndex } from '@shared/dates'
import { cn } from '@/lib/utils'
import { useMotionMode } from './use-motion-mode'

/** Один день карты: сколько минут и сколько сессий (06 §1.9). */
export interface HeatmapDay {
  date: string
  minutes: number
  sessions: number
}

export interface HeatmapLabels {
  /** Понедельник, среда, пятница — подписи строк, как в календаре GitHub. */
  weekdays: [string, string, string]
  /** Короткие названия месяцев, январь первым. */
  months: string[]
  less: string
  more: string
  /** Доступное имя всей карты — по нему её объявляет скринридер. */
  grid: string
  /** Текст ячейки: тултип и подпись для скринридера. */
  cell: (day: HeatmapDay) => string
}

export interface HeatmapProps {
  /** Границы окна включительно, 'YYYY-MM-DD'. */
  from: string
  to: string
  /** Только непустые дни: пустые ячейки достраиваются сами. */
  days: HeatmapDay[]
  /** Что задаёт насыщенность цвета. */
  metric: 'minutes' | 'sessions'
  labels: HeatmapLabels
  selected?: string | null
  onSelect?: (date: string) => void
  className?: string
}

const CELL = 12
const GAP = 3
const STEP = CELL + GAP
/** Ширина колонки подписей слева (Пн/Ср/Пт). */
const LABEL_W = 26
/** Высота строки с подписями месяцев над сеткой. */
const MONTH_ROW_H = 18

interface Cell {
  date: string
  day: HeatmapDay
  level: number
  /** Позиция в общем порядке — по ней считается задержка появления. */
  column: number
  row: number
}

const EMPTY = (date: string): HeatmapDay => ({ date, minutes: 0, sessions: 0 })

/**
 * Пороги уровней — квартили ненулевых дней, а не доли максимума: один
 * двенадцатичасовой марафон иначе перекрасил бы все обычные вечера в самый бледный цвет.
 */
function thresholdsOf(values: number[]): [number, number, number] {
  const sorted = [...values].sort((a, b) => a - b)
  const at = (share: number): number =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? 0
  return [at(0.25), at(0.5), at(0.75)]
}

function levelOf(value: number, [q1, q2, q3]: [number, number, number]): number {
  if (value <= 0) return 0
  if (value <= q1) return 1
  if (value <= q2) return 2
  if (value <= q3) return 3
  return 4
}

/**
 * Карта активности по дням, как на GitHub: колонка — неделя (пн…вс), строка — день недели.
 * Компонент без i18n: все подписи приходят пропсами (как у StatusPicker и Segmented).
 */
export function Heatmap({
  from,
  to,
  days,
  metric,
  labels,
  selected,
  onSelect,
  className
}: HeatmapProps): ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<{ cell: Cell; x: number; y: number } | null>(null)
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const motionEnabled = useMotionMode() !== 'off'

  const { columns, cells } = useMemo(() => {
    const byDate = new Map(days.map((day) => [day.date, day]))
    const values = days
      .map((day) => (metric === 'minutes' ? day.minutes : day.sessions))
      .filter((v) => v > 0)
    const thresholds = thresholdsOf(values)

    const start = startOfWeek(from)
    const total = dayDiff(to, start) + 1
    const list: Cell[] = []
    for (let offset = 0; offset < total; offset += 1) {
      const date = addDays(start, offset)
      if (date < from) continue
      const day = byDate.get(date) ?? EMPTY(date)
      list.push({
        date,
        day,
        level: levelOf(metric === 'minutes' ? day.minutes : day.sessions, thresholds),
        column: Math.floor(dayDiff(date, start) / 7),
        row: weekdayIndex(date)
      })
    }
    return { columns: Math.ceil(total / 7), cells: list }
  }, [days, from, to, metric])

  /** Подпись месяца ставится над колонкой, в которой месяц сменился. */
  const monthMarks = useMemo(() => {
    const marks: Array<{ column: number; label: string }> = []
    let previous = -1
    for (const cell of cells) {
      const month = monthOf(cell.date)
      if (month === previous) continue
      previous = month
      // Подписи не должны налезать друг на друга в короткие месяцы на стыке окна.
      if (marks.length > 0 && cell.column - marks[marks.length - 1]!.column < 3) continue
      marks.push({ column: cell.column, label: labels.months[month - 1] ?? '' })
    }
    return marks
  }, [cells, labels.months])

  // Окно открывается на «сегодня»: правый край карты интереснее левого.
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollLeft = node.scrollWidth
  }, [columns, metric])

  function move(delta: number): void {
    const current = focusIndex ?? cells.length - 1
    const next = Math.max(0, Math.min(cells.length - 1, current + delta))
    setFocusIndex(next)
    const cell = cells[next]
    if (cell && onSelect) onSelect(cell.date)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const map: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }
    const delta = map[event.key]
    if (delta === undefined) return
    event.preventDefault()
    move(delta)
  }

  const gridWidth = columns * STEP - GAP

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <div className="flex gap-2" style={{ width: LABEL_W + gridWidth }}>
          {/* Подписи дней недели позиционируются по строкам сетки, иначе «Пт» уезжает вниз. */}
          <div
            className="relative shrink-0"
            style={{ width: LABEL_W - 8, height: MONTH_ROW_H + 7 * STEP }}
          >
            {[0, 2, 4].map((row, index) => (
              <div
                key={row}
                className="absolute type-caption"
                style={{
                  top: MONTH_ROW_H + row * STEP,
                  height: CELL,
                  lineHeight: `${CELL}px`,
                  color: 'var(--text-3)'
                }}
              >
                {labels.weekdays[index]}
              </div>
            ))}
          </div>

          <div className="relative shrink-0" style={{ width: gridWidth }}>
            <div className="relative" style={{ height: MONTH_ROW_H }}>
              {monthMarks.map((mark) => (
                <span
                  key={`${mark.column}-${mark.label}`}
                  className="absolute type-caption"
                  style={{ left: mark.column * STEP, color: 'var(--text-3)' }}
                >
                  {mark.label}
                </span>
              ))}
            </div>

            <div
              tabIndex={0}
              role="group"
              aria-label={labels.grid}
              onKeyDown={onKeyDown}
              onBlur={() => setFocusIndex(null)}
              className="relative outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--border-focus)]"
              style={{ height: 7 * STEP - GAP }}
            >
              {cells.map((cell, index) => {
                const isSelected = selected === cell.date
                const isFocused = focusIndex === index
                return (
                  <button
                    key={cell.date}
                    type="button"
                    tabIndex={-1}
                    aria-label={labels.cell(cell.day)}
                    aria-current={isSelected ? 'date' : undefined}
                    className={cn('absolute block', motionEnabled && 'heat-cell')}
                    style={{
                      left: cell.column * STEP,
                      top: cell.row * STEP,
                      width: CELL,
                      height: CELL,
                      borderRadius: 3,
                      background: `var(--heat-${cell.level})`,
                      boxShadow: isSelected || isFocused ? 'var(--ring-accent)' : undefined,
                      animationDelay: motionEnabled
                        ? `${Math.min(cell.column * 8, 400)}ms`
                        : undefined
                    }}
                    onMouseEnter={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect()
                      setHovered({ cell, x: rect.left + rect.width / 2, y: rect.top })
                    }}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setFocusIndex(index)}
                    onClick={() => onSelect?.(cell.date)}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex items-center justify-end gap-1.5 type-caption"
        style={{ color: 'var(--text-3)' }}
      >
        <span>{labels.less}</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            style={{
              width: CELL,
              height: CELL,
              borderRadius: 3,
              background: `var(--heat-${level})`
            }}
          />
        ))}
        <span>{labels.more}</span>
      </div>

      {/*
        Один общий тултип вместо 370 отдельных: Radix-тултип на каждой ячейке
        создаёт столько же слоёв и заметно тормозит первый рендер профиля.
        Через портал в body — иначе `position: fixed` считается от ближайшего предка
        с трансформацией (у контейнера страницы это анимация появления).
      */}
      {hovered &&
        createPortal(
          <div
            role="tooltip"
            className="glass-strong pointer-events-none fixed z-50 whitespace-nowrap rounded-[var(--r-sm)] border border-border-1 px-2 py-1 type-small shadow-2"
            style={{ left: hovered.x, top: hovered.y - 8, transform: 'translate(-50%, -100%)' }}
          >
            {labels.cell(hovered.cell.day)}
          </div>,
          document.body
        )}
    </div>
  )
}
