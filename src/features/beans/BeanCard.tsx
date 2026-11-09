import { costPerCup, daysOffRoast, freshness, type Freshness } from '../../domain/calc'
import {
  REFERENCE_DOSE_G,
  cupsRemaining,
  remainingDisplayG,
  remainingFraction,
  stockLevel,
  type StockLevel,
} from '../../domain/inventory'
import type { Bean } from '../../domain/types'
import type { MessageKey } from '../../i18n'
import { useI18n } from '../../i18n/I18nProvider'
import { formatGrams, formatMoney } from '../format'
import { PROCESS_KEY, ROAST_LEVEL_KEY } from '../labels'

const FRESHNESS_TEXT: Record<Freshness, { labelKey: MessageKey; cls: string }> = {
  tooFresh: { labelKey: 'bean.fresh.tooFresh', cls: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200' },
  ok: { labelKey: 'bean.fresh.ok', cls: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200' },
  stale: { labelKey: 'bean.fresh.stale', cls: 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200' },
}

const STOCK_BAR: Record<StockLevel, string> = {
  ok: 'bg-emerald-600',
  low: 'bg-orange-500',
  empty: 'bg-red-600',
}

const STOCK_TEXT: Partial<Record<StockLevel, MessageKey>> = {
  low: 'bean.stock.low',
  empty: 'bean.stock.empty',
}

export function BeanCard({ bean, onOpen }: { bean: Bean; onOpen: () => void }) {
  const { t, locale } = useI18n()
  const days = daysOffRoast(bean.roastDate)
  const fresh = days === undefined || days < 0 ? undefined : FRESHNESS_TEXT[freshness(days)]
  const level = stockLevel(bean)
  const left = remainingDisplayG(bean)
  const cost = costPerCup(bean.priceTotal, bean.weightG, REFERENCE_DOSE_G)
  const meta = [bean.roaster, bean.origin].filter(Boolean).join(' · ')
  const roast = [t(ROAST_LEVEL_KEY[bean.roastLevel]), bean.process && t(PROCESS_KEY[bean.process])]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`block w-full rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-amber-600 dark:border-stone-700 dark:bg-stone-800 ${bean.archived ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold">{bean.name}</h3>
          {meta && <p className="truncate text-sm text-stone-600 dark:text-stone-400">{meta}</p>}
        </div>
        {bean.archived ? (
          <span className="shrink-0 rounded-full bg-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700 dark:bg-stone-700 dark:text-stone-200">
            {t('bean.archive')}
          </span>
        ) : (
          fresh && (
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${fresh.cls}`}>{t(fresh.labelKey)}</span>
          )
        )}
      </div>

      <p className="mt-2 text-sm text-stone-700 dark:text-stone-300">
        {roast}
        {days !== undefined && days >= 0 && (
          <>
            {' · '}
            <span className="font-medium">{t('bean.roastedDaysAgo', { n: days })}</span>
          </>
        )}
      </p>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-sm">
          <span>
            <span className="font-semibold">{formatGrams(left)}</span> / {formatGrams(bean.weightG)} g
            {STOCK_TEXT[level] && (
              <span className={`ml-2 font-medium ${level === 'empty' ? 'text-red-700 dark:text-red-400' : 'text-orange-700 dark:text-orange-400'}`}>
                {t(STOCK_TEXT[level]!)}
              </span>
            )}
          </span>
          <span className="text-stone-500 dark:text-stone-400">{t('bean.cupsLeft', { n: cupsRemaining(bean) })}</span>
        </div>
        <div
          role="progressbar"
          aria-label={t('bean.remainingWeight')}
          aria-valuemin={0}
          aria-valuemax={bean.weightG}
          aria-valuenow={left}
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700"
        >
          <div className={`h-full rounded-full ${STOCK_BAR[level]}`} style={{ width: `${remainingFraction(bean) * 100}%` }} />
        </div>
      </div>

      {cost !== undefined && (
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          {t('bean.costPerCup', { cost: formatMoney(cost, bean.currency, locale), dose: REFERENCE_DOSE_G })}
        </p>
      )}
    </button>
  )
}
