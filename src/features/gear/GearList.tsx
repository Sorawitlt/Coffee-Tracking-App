import { listGear, useLive } from '../../db'
import { Button } from '../../components/Button'
import { useT } from '../../i18n/I18nProvider'
import { GEAR_TYPE_ICON, GEAR_TYPE_KEY } from '../labels'

interface Props {
  onAdd: () => void
  onOpen: (id: string) => void
}

export function GearList({ onAdd, onOpen }: Props) {
  const t = useT()
  const gear = useLive(() => listGear(), [])

  return (
    <section aria-label={t('gear.list.title')} className="space-y-3">
      <Button variant="primary" className="w-full" onClick={onAdd}>
        {t('gear.list.add')}
      </Button>

      {gear === undefined ? null : gear.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center dark:border-stone-600">
          <p className="text-4xl" aria-hidden>⚙️</p>
          <p className="mt-2 font-medium">{t('gear.list.empty')}</p>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            {t('gear.list.emptyHint')}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {gear.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => onOpen(g.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-amber-600 dark:border-stone-700 dark:bg-stone-800"
              >
                <span aria-hidden className="text-2xl">{GEAR_TYPE_ICON[g.type]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{g.name}</span>
                  <span className="block text-sm text-stone-600 dark:text-stone-400">
                    {t(GEAR_TYPE_KEY[g.type])}
                    {g.grindScale && t('gear.list.scale', { min: g.grindScale.min, max: g.grindScale.max, step: g.grindScale.step })}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
