import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { HOTKEYS, formatCombo } from '@/lib/hotkeys'
import { useUiStore } from '@/stores/ui-store'

const GROUPS = ['global', 'library', 'collection', 'game'] as const

/** Шпаргалка по горячим клавишам (ТЗ 05 §5, клавиша «?»). */
export function HotkeysHelp(): React.ReactElement {
  const { t } = useTranslation()
  const open = useUiStore((s) => s.hotkeysHelpOpen)
  const setOpen = useUiStore((s) => s.setHotkeysHelpOpen)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent size={640}>
        <DialogHeader>
          <DialogTitle>{t('hotkey.title')}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-8 gap-y-6">
          {GROUPS.map((group) => (
            <section key={group} className="flex flex-col gap-2">
              <h3 className="type-caption">{t(`hotkey.group.${group}`)}</h3>
              {HOTKEYS.filter((h) => h.group === group).map((hotkey) => (
                <div key={hotkey.id} className="flex items-center justify-between gap-4">
                  <span className="type-small" style={{ color: 'var(--text-2)' }}>
                    {t(hotkey.i18nKey)}
                  </span>
                  <Kbd keys={formatCombo(hotkey.combo).split(' + ')} />
                </div>
              ))}
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
