import { useId, useMemo, useState } from 'react'
import { GEAR_MODELS, gearModelName, searchGearModels, type GearModel } from '../../domain/catalog'
import { useT } from '../../i18n/I18nProvider'
import { GEAR_TYPE_ICON, GEAR_TYPE_KEY } from '../labels'

const MAX_RESULTS = 8

interface Props {
  onPick: (model: GearModel) => void
  /**
   * ข้อความสำหรับเดารุ่นตอนช่องค้นหายังว่าง (เช่น ชื่ออุปกรณ์เดิมที่ยังไม่ได้เชื่อม "DF64")
   * แสดงเฉพาะเมื่อเจอรุ่นที่ตรง — ไม่เจอ = เงียบ
   */
  suggestFrom?: string
}

/**
 * ค้นหารุ่นจากฐานข้อมูลอ้างอิง — ช่องค้นหา + รายการปุ่มผลลัพธ์ (ไม่ใช้ combobox ที่ซับซ้อน:
 * ใช้ได้กับโปรแกรมอ่านหน้าจอทันที แตะง่ายบนมือถือ ปุ่มสูง ≥ 48px)
 */
export function CatalogPicker({ onPick, suggestFrom }: Props) {
  const t = useT()
  const id = useId()
  const [query, setQuery] = useState('')

  const typed = query.trim().length > 0
  const results = useMemo(() => (typed ? searchGearModels(query, { limit: MAX_RESULTS }) : []), [query, typed])
  const suggestions = useMemo(
    () => (!typed && suggestFrom?.trim() ? searchGearModels(suggestFrom, { limit: 3 }) : []),
    [typed, suggestFrom],
  )
  const list = typed ? results : suggestions

  function pick(model: GearModel) {
    onPick(model)
    setQuery('')
  }

  return (
    <section aria-labelledby={`${id}-label`} className="space-y-2 rounded-2xl border border-stone-200 p-3 dark:border-stone-700">
      <label id={`${id}-label`} htmlFor={id} className="block text-sm font-semibold">
        📚 {t('catalog.picker.label', { n: GEAR_MODELS.length })}
      </label>
      <input
        id={id}
        type="search"
        value={query}
        autoComplete="off"
        enterKeyHint="search"
        placeholder={t('catalog.picker.placeholder')}
        aria-describedby={`${id}-hint ${id}-status`}
        onChange={(e) => setQuery(e.target.value)}
        className="block min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 placeholder:text-stone-500 focus:border-amber-700 focus:outline-2 focus:outline-amber-600 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-400"
      />
      <p id={`${id}-hint`} className="text-sm text-stone-600 dark:text-stone-400">{t('catalog.picker.hint')}</p>

      <p id={`${id}-status`} role="status" className="text-sm font-medium empty:hidden">
        {typed
          ? results.length > 0
            ? t('catalog.picker.count', { n: results.length })
            : t('catalog.picker.none')
          : suggestions.length > 0
            ? t('catalog.picker.suggest')
            : ''}
      </p>

      {list.length > 0 && (
        <ul className="space-y-2">
          {list.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => pick(m)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-stone-300 bg-white px-3 py-2 text-left hover:border-amber-600 hover:bg-amber-50 dark:border-stone-600 dark:bg-stone-800 dark:hover:bg-stone-700"
              >
                <span aria-hidden className="text-xl">{GEAR_TYPE_ICON[m.type]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{gearModelName(m)}</span>
                  <span className="block text-sm text-stone-600 dark:text-stone-400">
                    {t(GEAR_TYPE_KEY[m.type])} · {m.brand}
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
