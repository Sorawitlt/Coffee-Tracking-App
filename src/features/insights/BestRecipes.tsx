import { brewMetrics, formatRatio } from '../../domain/calc'
import { bestRecipes } from '../../domain/insights'
import type { Bean, Brew } from '../../domain/types'
import { formatDuration, formatGrams } from '../format'
import { FLAVOR_TAG_LABEL, METHOD_LABEL } from '../labels'
import { isFlavorTag } from '../../domain/flavors'

interface Props {
  brews: readonly Brew[]
  beans: ReadonlyMap<string, Bean>
}

/** สูตรที่ดีที่สุดของแต่ละ (เมล็ด + วิธีชง) — ติดดาวไว้ใช้ตามนั้น ไม่ติดดาวแอปเลือกครั้งที่คะแนนสูงสุดให้ */
export function BestRecipes({ brews, beans }: Props) {
  const recipes = bestRecipes(brews)

  return (
    <section aria-label="สูตรที่ดีที่สุดต่อเมล็ด" className="space-y-3">
      <h3 className="text-lg font-semibold">สูตรที่ดีที่สุดต่อเมล็ด</h3>
      {recipes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600 dark:border-stone-600 dark:text-stone-400">
          ยังไม่มีสูตรให้สรุป — ให้ดาวตอนบันทึกการชง หรือติดดาว ⭐ สูตรที่ถูกใจ
        </p>
      ) : (
        <ul className="space-y-3">
          {recipes.map(({ brew, starred }) => {
            const bean = beans.get(brew.beanId)
            const m = brewMetrics(brew, bean)
            const details = [
              brew.grindSetting !== undefined && `บด ${formatGrams(brew.grindSetting)}`,
              brew.tempC !== undefined && `${formatGrams(brew.tempC)} °C`,
              brew.totalTimeSec !== undefined && formatDuration(brew.totalTimeSec),
            ].filter(Boolean)
            return (
              <li key={`${brew.beanId}-${brew.method}`}>
                <article className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800">
                  <div className="flex items-baseline justify-between gap-3">
                    <h4 className="min-w-0 truncate text-base font-semibold">
                      {bean?.name ?? 'เมล็ดที่ลบแล้ว'} · {METHOD_LABEL[brew.method]}
                    </h4>
                    {brew.rating !== undefined && (
                      <span role="img" aria-label={`${brew.rating} ดาว`} className="shrink-0 text-amber-600 dark:text-amber-400">
                        {'★'.repeat(brew.rating)}{'☆'.repeat(5 - brew.rating)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-amber-800 dark:text-amber-300">
                    {starred ? '⭐ สูตรที่ดีที่สุด' : 'คะแนนสูงสุด (ยังไม่ได้ติดดาว)'}
                  </p>
                  <p className="mt-1 text-base tabular-nums">
                    {formatGrams(brew.doseG)} g : {formatGrams(brew.waterG)} g
                    <span className="ml-2 font-semibold">{formatRatio(m.ratio)}</span>
                  </p>
                  {details.length > 0 && <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{details.join(' · ')}</p>}
                  {brew.flavorTags.length > 0 && (
                    <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{brew.flavorTags.map((t) => (isFlavorTag(t) ? FLAVOR_TAG_LABEL[t] : t)).join(' · ')}</p>
                  )}
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
