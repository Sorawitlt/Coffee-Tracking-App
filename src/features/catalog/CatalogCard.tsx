import { Button } from '../../components/Button'
import { gearModelName, type GearModel } from '../../domain/catalog'
import { useI18n } from '../../i18n/I18nProvider'
import { GEAR_TYPE_ICON } from '../labels'
import { NOTE_KEY, grindGuideRows, specRows } from './catalogText'
import { SourceList } from './SourceList'

interface Props {
  model: GearModel
  /** ไม่ส่ง = ไม่มีปุ่มยกเลิกการเชื่อม */
  onUnlink?: () => void
}

/** การ์ดข้อมูลรุ่นจากฐานข้อมูลอ้างอิง: สเปก, ช่วงเบอร์บดที่ผู้ผลิตแนะนำ, ข้อควรรู้, แหล่งอ้างอิง */
export function CatalogCard({ model, onUnlink }: Props) {
  const { t, locale } = useI18n()
  const specs = specRows(model, t)
  const guide = grindGuideRows(model)
  const verified = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${model.verifiedAt}T00:00:00`),
  )

  return (
    <section
      aria-label={t('catalog.card.title')}
      className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-stone-800"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-2xl">{GEAR_TYPE_ICON[model.type]}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-300">📚 {t('catalog.card.title')}</p>
          <p className="text-lg font-bold leading-tight">{gearModelName(model)}</p>
          <p className="text-sm text-stone-600 dark:text-stone-400">{model.brand}</p>
        </div>
      </div>

      {specs.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {specs.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-stone-600 dark:text-stone-400">{row.label}</dt>
              <dd className="font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {guide.length > 0 && (
        <div>
          <p className="text-sm font-semibold">{t('catalog.card.guide')}</p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {guide.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-stone-600 dark:text-stone-400">{row.label}</dt>
                <dd className="font-medium tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {model.notes && model.notes.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-amber-400 bg-white p-3 text-sm text-stone-800 dark:border-amber-700 dark:bg-stone-900 dark:text-stone-200">
          {model.notes.map((n) => (
            <li key={n} className="flex gap-2">
              <span aria-hidden>⚠️</span>
              <span>{t(NOTE_KEY[n])}</span>
            </li>
          ))}
        </ul>
      )}

      <details className="rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-900">
        <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold">
          {t('catalog.card.sources', { n: model.sources.length })}
        </summary>
        <div className="mt-2 space-y-2">
          <SourceList sources={model.sources} />
          <p className="text-xs text-stone-600 dark:text-stone-400">
            {t('catalog.card.verified', { date: verified })} · {t('catalog.card.disclaimer')}
          </p>
        </div>
      </details>

      {onUnlink && (
        <Button variant="ghost" className="w-full" onClick={onUnlink}>
          {t('catalog.card.unlink')}
        </Button>
      )}
    </section>
  )
}
