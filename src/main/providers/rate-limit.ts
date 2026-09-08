/**
 * Token bucket на провайдера (08 §4). Лимиты: IGDB 4 запроса в секунду и не более
 * 8 одновременных; Steam appdetails — около 200 запросов за 5 минут, после чего
 * отдаёт 429/403. Все запросы делаются по действию пользователя, фонового опроса нет.
 */

export interface Bucket {
  /** Сколько запросов помещается в окно. */
  capacity: number
  /** Длина окна в миллисекундах. */
  windowMs: number
}

export const LIMITS: Record<string, Bucket> = {
  // 4 rps по документации; берём с запасом, чтобы не ловить 429 на серии подзапросов.
  igdb: { capacity: 4, windowMs: 1000 },
  // ~200 / 5 мин; держим вдвое ниже — поиск и карточка это 2–3 запроса на игру.
  steam: { capacity: 100, windowMs: 5 * 60_000 },
  // Бесплатный тариф RAWG считает запросы за месяц (20 000), мгновенного лимита нет —
  // ограничиваем частоту просто чтобы не сжечь месячную квоту случайным циклом.
  rawg: { capacity: 5, windowMs: 1000 }
}

interface State {
  /** Времена выполненных запросов внутри текущего окна. */
  stamps: number[]
}

const states = new Map<string, State>()

function stateOf(provider: string): State {
  let state = states.get(provider)
  if (!state) {
    state = { stamps: [] }
    states.set(provider, state)
  }
  return state
}

/**
 * Ждёт, пока в окне освободится место, и резервирует слот.
 * `now`/`sleep` вынесены в параметры ради тестов без реальных задержек.
 */
export async function acquire(
  provider: string,
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
): Promise<void> {
  const bucket = LIMITS[provider]
  if (!bucket) return
  const state = stateOf(provider)

  for (;;) {
    const current = now()
    state.stamps = state.stamps.filter((at) => current - at < bucket.windowMs)
    if (state.stamps.length < bucket.capacity) {
      state.stamps.push(current)
      return
    }
    const oldest = state.stamps[0] ?? current
    await sleep(Math.max(bucket.windowMs - (current - oldest), 10))
  }
}

/** Для тестов и «сбросить кеш» в настройках. */
export function resetLimits(): void {
  states.clear()
}
