import { useState } from 'react'
import type { MessageKey } from '../../i18n'
import { listBeans, listBrews, useLive } from '../../db'
import { filterBrews, RANGE_PRESETS, rangeStart, type RangePreset } from '../../domain/history'
import { ratingSummary } from '../../domain/insights'
import { METHODS, type Method } from '../../domain/types'
import { SelectField } from '../../components/fields'
import { useT } from '../../i18n/I18nProvider'
import { METHOD_LABEL } from '../labels'
import { BestRecipes } from './BestRecipes'
import { ControlChart } from './ControlChart'
import { RatingChart } from './RatingChart'

const RANGE_KEY: Record<RangePreset, MessageKey> = {
  '7d': 'insights.range.7d',
  '30d': 'insights.range.30d',
  '90d': 'insights.range.90d',
  all: 'insights.range.all',
}

/**
 * แท็บ "สรุป": ตัวกรอง (แถวเดียวด้านบน คุมทุกอย่างที่อยู่ด้านล่าง) → ตัวเลขสรุป → สูตรที่ดีที่สุด → กราฟ
 * ตัวเลขและกราฟทุกส่วนคำนวณจากชุดข้อมูลที่กรองแล้วชุดเดียวกัน จึงตรงกันเสมอ
 */
export default function InsightsPage() {
  const t = useT()
  const [range, setRange] = useState<RangePreset>('all')
  const [beanId, setBeanId] = useState('')
  const [method, setMethod] = useState<Method | ''>('')
  const brews = useLive(() => listBrews())
  const beanList = useLive(() => listBeans({ includeArchived: true }))
  if (!brews || !beanList) return null

  const beans = new Map(beanList.map((b) => [b.id, b]))
  const scoped = filterBrews(brews, { beanId: beanId || undefined, method: method || undefined, since: rangeStart(range) }, beans)
  const summary = ratingSummary(scoped)

  if (brews.length === 0) {
    return (
      <section aria-label={t('insights.title')} className="space-y-3">
        <h2 className="text-xl font-bold">{t('insights.title')}</h2>
        <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center dark:border-stone-600">
          <p className="text-4xl" aria-hidden>📊</p>
          <p className="mt-2 font-medium">{t('insights.empty')}</p>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{t('insights.emptyHint')}</p>
        </div>
      </section>
    )
  }

  const trend = summary.trend

  return (
    <section aria-label={t('insights.title')} className="space-y-4">
      <h2 className="text-xl font-bold">{t('insights.title')}</h2>

      <div className="space-y-3" role="search" aria-label={t('insights.filterAria')}>
        <div role="group" aria-label={t('insights.rangeAria')} className="grid grid-cols-4 gap-1 rounded-xl bg-stone-200 p-1 dark:bg-stone-800">
          {RANGE_PRESETS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === range}
              onClick={() => setRange(r)}
              className={`min-h-12 rounded-lg text-sm font-semibold ${r === range ? 'bg-white text-amber-900 shadow-sm dark:bg-stone-600 dark:text-amber-300' : 'text-stone-600 dark:text-stone-400'}`}
            >
              {t(RANGE_KEY[r])}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label={t('common.bean')} value={beanId} onChange={(e) => setBeanId(e.target.value)}>
            <option value="">{t('common.allBeans')}</option>
            {beanList.map((b) => <option key={b.id} value={b.id}>{b.name}{b.archived ? ` (${t('bean.archive')})` : ''}</option>)}
          </SelectField>
          <SelectField label={t('common.method')} value={method} onChange={(e) => setMethod(e.target.value as Method | '')}>
            <option value="">{t('common.allMethods')}</option>
            {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
          </SelectField>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <Tile label={t('insights.tile.brewed')} value={String(summary.total)} unit={t('insights.tile.brewedUnit')} />
        <Tile label={t('insights.tile.avg')} value={summary.average === undefined ? '—' : String(summary.average)} unit={summary.average === undefined ? '' : t('insights.tile.avgUnit')} />
        <div className="rounded-2xl border border-stone-200 bg-white p-2 dark:border-stone-700 dark:bg-stone-800">
          <dt className="text-sm text-stone-600 dark:text-stone-400">{t('insights.trend')}</dt>
          {trend ? (
            <dd className={`text-xl font-bold ${trend.delta > 0 ? 'text-green-800 dark:text-green-400' : trend.delta < 0 ? 'text-red-700 dark:text-red-400' : ''}`}>
              {trend.delta > 0 ? `▲ +${trend.delta}` : trend.delta < 0 ? `▼ ${trend.delta}` : '＝ 0'}
              <span className="block text-xs font-normal text-stone-600 dark:text-stone-400">
                {t('insights.trend.vs', { label: t(trend.delta > 0 ? 'insights.trend.up' : trend.delta < 0 ? 'insights.trend.down' : 'insights.trend.flat'), n: trend.size })}
              </span>
            </dd>
          ) : (
            <dd className="text-xl font-bold">—<span className="block text-xs font-normal text-stone-600 dark:text-stone-400">{t('insights.trend.need')}</span></dd>
          )}
        </div>
      </dl>

      {scoped.length === 0 ? (
        <p role="status" className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600 dark:border-stone-600 dark:text-stone-400">
          {t('insights.noMatch')}
        </p>
      ) : (
        <>
          <BestRecipes brews={scoped} beans={beans} />
          <RatingChart brews={scoped} beans={beans} />
          <ControlChart brews={scoped} beans={beans} />
        </>
      )}
    </section>
  )
}

function Tile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-2 dark:border-stone-700 dark:bg-stone-800">
      <dt className="text-sm text-stone-600 dark:text-stone-400">{label}</dt>
      <dd className="text-xl font-bold">
        {value}
        {unit && <span className="block text-xs font-normal text-stone-600 dark:text-stone-400">{unit}</span>}
      </dd>
    </div>
  )
}
