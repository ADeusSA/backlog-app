/** Мелкие адаптеры между компонентами дизайн-системы и react-hook-form. */

/**
 * `Combobox` в одиночном режиме отдаёт `T | T[]`; поля форм ждут `T | null`.
 * Обёртка приводит значение к одиночному.
 */
export function single<T extends string>(
  onChange: (value: T | null) => void
): (value: T | T[]) => void {
  return (value) => onChange(Array.isArray(value) ? (value[0] ?? null) : value)
}

/** То же, но для обязательных полей — значение никогда не станет null. */
export function singleRequired<T extends string>(
  onChange: (value: T) => void,
  fallback: T
): (value: T | T[]) => void {
  return (value) => onChange(Array.isArray(value) ? (value[0] ?? fallback) : value)
}

/**
 * Регистрация необязательного числового поля.
 *
 * `{ valueAsNumber: true }` превращает пустой `<input type="number">` в `NaN`, а zod
 * такое значение не принимает: форма молча не отправлялась, а react-hook-form лишь
 * переводил фокус на «пустое» поле. Здесь пустая строка становится `null`.
 */
export const optionalNumber = {
  setValueAs: (value: unknown): number | null => {
    if (value === '' || value === null || value === undefined) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
}

/** `Combobox` в мультирежиме отдаёт `T | T[]`; поля ждут массив. */
export function multi<T extends string>(
  onChange: (value: T[]) => void
): (value: T | T[]) => void {
  return (value) => onChange(Array.isArray(value) ? value : [value])
}
