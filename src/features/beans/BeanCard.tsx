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
import { formatGrams, formatMoney } from '../format'
import { PROCESS_LABEL, ROAST_LEVEL_LABEL } from '../labels'

const FRESHNESS_TEXT: Record<Freshness, { label: string; cls: string }> = {
  tooFresh: { label: 'ควรพักก่อน', cls: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200' },
  ok: { label: 'พร้อมชง', cls: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200' },
  stale: { label: 'ผ่านมานาน', cls: 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200' },
}

const STOCK_BAR: Record<StockLevel, string> = {
  ok: 'bg-emerald-600',
  low: 'bg-orange-500',
  empty: 'bg-red-600',
}

const STOCK_TEXT: Partial<Record<StockLevel, string>> = {
  low: 'ใกล้หมด',
  empty: 'หมดแล้ว',
}

export function BeanCard({ bean, onOpen }: { bean: Bean; onOpen: () => void }) {
  const days = daysOffRoast(bean.roastDate)
  const fresh = days === undefined || days < 0 ? undefined : FRESHNESS_TEXT[freshness(days)]
  const level = stockLevel(bean)
  const left = remainingDisplayG(bean)
  const cost = costPerCup(bean.priceTotal, bean.weightG, REFERENCE_DOSE_G)
  const meta = [bean.roaster, bean.origin].filter(Boolean).join(' · ')
  const roast = [ROAST_LEVEL_LABEL[bean.roastLevel], bean.process && PROCESS_LABEL[bean.process]]
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
            Archive
          </span>
        ) : (
          fresh && (
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${fresh.cls}`}>{fresh.label}</span>
          )
        )}
      </div>

      <p className="mt-2 text-sm text-stone-700 dark:text-stone-300">
        {roast}
        {days !== undefined && days >= 0 && (
          <>
            {' · '}
            <span className="font-medium">คั่วมา {days} วัน</span>
          </>
        )}
      </p>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-sm">
          <span>
            <span className="font-semibold">{formatGrams(left)}</span> / {formatGrams(bean.weightG)} g
            {STOCK_TEXT[level] && (
              <span className={`ml-2 font-medium ${level === 'empty' ? 'text-red-700 dark:text-red-400' : 'text-orange-700 dark:text-orange-400'}`}>
                {STOCK_TEXT[level]}
              </span>
            )}
          </span>
          <span className="text-stone-500 dark:text-stone-400">ชงได้อีก ~{cupsRemaining(bean)} แก้ว</span>
        </div>
        <div
          role="progressbar"
          aria-label="น้ำหนักคงเหลือ"
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
          ต้นทุน ≈ {formatMoney(cost, bean.currency)} / แก้ว ({REFERENCE_DOSE_G} g)
        </p>
      )}
    </button>
  )
}
