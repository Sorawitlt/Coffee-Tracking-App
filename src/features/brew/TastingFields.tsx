import { ChoiceGroup } from '../../components/ChoiceGroup'
import { TextAreaField } from '../../components/fields'
import { FLAVOR_GROUPS, toggleFlavorTag, type FlavorTag } from '../../domain/flavors'
import type { Rating } from '../../domain/types'
import type { MessageKey } from '../../i18n'
import { useT } from '../../i18n/I18nProvider'
import { BALANCE_OPTIONS, BODY_OPTIONS, FLAVOR_GROUP_KEY, FLAVOR_TAG_KEY, SWEETNESS_OPTIONS } from '../labels'
import type { TastingValues } from './tasting'

interface Props {
  value: TastingValues
  onChange: (next: TastingValues) => void
}

const STARS: Rating[] = [1, 2, 3, 4, 5]

/** ส่วน "ชิม & ให้คะแนน" ของฟอร์มบันทึกการชง — ทุกช่องไม่บังคับ; ดาว + 2 แตะก็พอให้ได้คำแนะนำ */
export function TastingFields({ value, onChange }: Props) {
  const t = useT()
  const choices = <V extends number>(list: readonly { value: V; labelKey: MessageKey }[]) =>
    list.map((o) => ({ value: o.value, label: t(o.labelKey) }))
  const set = <K extends keyof TastingValues>(key: K, v: TastingValues[K]) => onChange({ ...value, [key]: v })

  return (
    <fieldset className="space-y-4 rounded-2xl border border-stone-200 p-3 dark:border-stone-700">
      <legend className="px-1 text-base font-semibold">{t('tasting.title')}</legend>

      <div role="group" aria-label={t('tasting.rating')}>
        <p className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">{t('tasting.rating')}</p>
        <div className="flex gap-1">
          {STARS.map((n) => (
            <button
              key={n}
              type="button"
              aria-label={t('common.stars', { n })}
              aria-pressed={value.rating === n}
              onClick={() => set('rating', value.rating === n ? undefined : n)}
              className={`min-h-12 flex-1 rounded-xl border text-2xl leading-none ${
                value.rating !== undefined && n <= value.rating
                  ? 'border-amber-600 bg-amber-100 text-amber-700 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-300'
                  : 'border-stone-300 bg-white text-stone-500 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700'
              }`}
            >
              <span aria-hidden>{value.rating !== undefined && n <= value.rating ? '★' : '☆'}</span>
            </button>
          ))}
        </div>
      </div>

      <ChoiceGroup label={t('tasting.balance')} options={choices(BALANCE_OPTIONS)} value={value.balance}
        onChange={(v) => set('balance', v)} />
      <ChoiceGroup label={t('tasting.body')} options={choices(BODY_OPTIONS)} value={value.body}
        onChange={(v) => set('body', v)} />

      <label className="flex min-h-12 items-center gap-3 text-base">
        <input
          type="checkbox"
          checked={value.sourAndBitter}
          onChange={(e) => set('sourAndBitter', e.target.checked)}
          className="size-6 accent-amber-700"
        />
        {t('tasting.sourAndBitter')}
      </label>

      <details className="rounded-xl border border-stone-200 p-3 dark:border-stone-700">
        <summary className="flex min-h-12 cursor-pointer items-center text-base font-semibold">
          {t('tasting.more')}
        </summary>
        <div className="mt-2 space-y-4">
          <ChoiceGroup label={t('tasting.sweetness')} options={choices(SWEETNESS_OPTIONS)} value={value.sweetness}
            onChange={(v) => set('sweetness', v)} />

          <div>
            <p className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">{t('tasting.flavorTags')}</p>
            <div className="space-y-3">
              {FLAVOR_GROUPS.map((g) => (
                <div key={g.id} role="group" aria-label={t(FLAVOR_GROUP_KEY[g.id])}>
                  <p className="mb-1 text-xs font-medium text-stone-500 dark:text-stone-400">{t(FLAVOR_GROUP_KEY[g.id])}</p>
                  <div className="flex flex-wrap gap-2">
                    {g.tags.map((tag: FlavorTag) => (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={value.flavorTags.includes(tag)}
                        onClick={() => set('flavorTags', toggleFlavorTag(value.flavorTags, tag))}
                        className="min-h-12 rounded-full border border-stone-300 bg-white px-4 text-base text-stone-800 hover:bg-stone-100 aria-pressed:border-amber-700 aria-pressed:bg-amber-100 aria-pressed:font-semibold aria-pressed:text-amber-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700 dark:aria-pressed:border-amber-500 dark:aria-pressed:bg-amber-950 dark:aria-pressed:text-amber-200"
                      >
                        {t(FLAVOR_TAG_KEY[tag])}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <TextAreaField label={t('common.note')} value={value.notes} onChange={(e) => set('notes', e.target.value)}
            maxLength={500} />
        </div>
      </details>

      <label className="flex min-h-12 items-center gap-3 text-base">
        <input
          type="checkbox"
          checked={value.isBest}
          onChange={(e) => set('isBest', e.target.checked)}
          className="size-6 accent-amber-700"
        />
        <span>{t('tasting.markBest')}</span>
      </label>
    </fieldset>
  )
}
