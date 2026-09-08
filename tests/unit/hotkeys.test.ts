import { describe, expect, it } from 'vitest'
import {
  comboConflict,
  DEFAULT_COMBOS,
  formatCombo,
  idByCombo,
  isAssignableCombo,
  resolveCombos
} from '../../src/renderer/src/lib/hotkeys'

describe('редактирование горячих клавиш (05 §5)', () => {
  it('без переопределений возвращает значения по умолчанию', () => {
    expect(resolveCombos(undefined)['palette']).toBe('ctrl+k')
    expect(resolveCombos({})).toEqual(DEFAULT_COMBOS)
  })

  it('перекрывает только знакомые действия', () => {
    const combos = resolveCombos({ palette: 'ctrl+shift+p', 'нет такого': 'ctrl+q' })
    expect(combos['palette']).toBe('ctrl+shift+p')
    expect(combos['нет такого']).toBeUndefined()
    expect(combos['sidebar']).toBe('ctrl+b')
  })

  it('находит действие по нажатому сочетанию с учётом группы', () => {
    const combos = resolveCombos({ sidebar: 'ctrl+shift+b' })
    expect(idByCombo(combos, 'ctrl+shift+b')).toBe('sidebar')
    expect(idByCombo(combos, 'ctrl+b')).toBeNull()
    expect(idByCombo(combos, 'ctrl+shift+b', new Set(['palette']))).toBeNull()
  })

  it('не даёт назначить голый модификатор и служебные клавиши', () => {
    expect(isAssignableCombo('ctrl')).toBe(false)
    expect(isAssignableCombo('escape')).toBe(false)
    expect(isAssignableCombo('ctrl+enter')).toBe(false)
    expect(isAssignableCombo('ctrl+shift+p')).toBe(true)
    expect(isAssignableCombo('e')).toBe(true)
  })

  it('видит занятое сочетание', () => {
    const combos = resolveCombos({})
    expect(comboConflict(combos, 'sidebar', 'ctrl+k')).toBe('palette')
    expect(comboConflict(combos, 'palette', 'ctrl+k')).toBeNull()
    expect(comboConflict(combos, 'sidebar', 'ctrl+shift+y')).toBeNull()
  })

  it('печатает сочетание для шпаргалки', () => {
    expect(formatCombo('ctrl+shift+f')).toBe('Ctrl + Shift + F')
    expect(formatCombo('alt+arrowleft')).toBe('Alt + ←')
  })
})
