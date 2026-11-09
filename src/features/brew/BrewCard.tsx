import { brewMetrics, formatRatio } from '../../domain/calc'
import type { Bean, Brew } from '../../domain/types'
import { Button } from '../../components/Button'
import { useI18n } from '../../i18n/I18nProvider'
import { formatDateTime, formatDuration, formatGrams, formatMoney } from '../format'
import { METHOD_LABEL } from '../labels'

interface Props {
  brew: Brew
  /** ไม่พบ = เมล็ดถูกลบไปแล้ว */
  bean?: Bean
  onOpen: () => void
  onRepeat: () => void
}

export function BrewCard({ brew, bean, onOpen, onRepeat }: Props) {
  const { t, locale } = useI18n()
  const beanName = bean?.name ?? t('common.deletedBean')
  const m = brewMetrics(brew, bean)
  const details = [
    brew.grindSetting !== undefined && t('brew.card.grind', { value: formatGrams(brew.grindSetting) }),
    brew.tempC !== undefined && `${formatGrams(brew.tempC)} °C`,
    brew.totalTimeSec !== undefined && formatDuration(brew.totalTimeSec),
    m.daysOffRoast !== undefined && m.daysOffRoast >= 0 && t('bean.roastedDaysAgo', { n: m.daysOffRoast }),
    m.costPerCup !== undefined && t('brew.card.cost', { cost: formatMoney(m.costPerCup, m.currency, locale) }),
  ].filter(Boolean)

  return (
    <article className="rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800">
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('brew.card.edit', { method: METHOD_LABEL[brew.method], bean: beanName })}
        className="block w-full rounded-t-2xl p-4 text-left hover:bg-stone-50 dark:hover:bg-stone-700/50"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="min-w-0 truncate text-lg font-semibold">
            {METHOD_LABEL[brew.method]} · {beanName}
          </h3>
          <time dateTime={brew.brewedAt} className="shrink-0 text-sm text-stone-500 dark:text-stone-400">
            {formatDateTime(brew.brewedAt, new Date(), locale)}
          </time>
        </div>
        {(brew.rating !== undefined || brew.isBest) && (
          <p className="mt-1 text-base">
            {brew.rating !== undefined && (
              <span role="img" aria-label={t('common.stars', { n: brew.rating })} className="text-amber-600 dark:text-amber-400">
                {'★'.repeat(brew.rating)}{'☆'.repeat(5 - brew.rating)}
              </span>
            )}
            {brew.isBest && <span className="ml-2 font-semibold text-amber-800 dark:text-amber-300">{t('brew.card.best')}</span>}
          </p>
        )}
        <p className="mt-1 text-base tabular-nums">
          {formatGrams(brew.doseG)} g : {formatGrams(brew.waterG)} g
          <span className="ml-2 font-semibold">{formatRatio(m.ratio)}</span>
        </p>
        {details.length > 0 && (
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{details.join(' · ')}</p>
        )}
      </button>
      <div className="border-t border-stone-100 p-2 dark:border-stone-700">
        <Button
          variant="ghost"
          className="w-full"
          onClick={onRepeat}
          aria-label={t('brew.card.repeatAria', { method: METHOD_LABEL[brew.method], bean: bean?.name ?? '' }).trim()}
        >
          {t('brew.card.repeat')}
        </Button>
      </div>
    </article>
  )
}
