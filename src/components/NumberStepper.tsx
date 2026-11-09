import { useId } from 'react'
import { parseNumber } from '../features/formUtil'
import { useT } from '../i18n/I18nProvider'

export interface NumberStepperProps {
  label: string
  /** ค่าในช่อง (string — แปลงที่ชั้นฟอร์ม) */
  value: string
  onChange: (value: string) => void
  /** ขนาดการกด + / − แต่ละครั้ง */
  step: number
  min?: number
  max?: number
  /** ค่าเริ่มต้นเมื่อช่องว่างแล้วกด + / − (ไม่ส่ง = เริ่มจาก min หรือ 0) */
  start?: number
  required?: boolean
  error?: string
  hint?: string
  /** มีค่า = ช่องนี้ต่างจากการชงครั้งก่อน → ไฮไลต์และแสดงค่าเดิมเป็นข้อความนี้ */
  changedFrom?: string
}

const round = (n: number) => Math.round(n * 10_000) / 10_000

/**
 * ช่องตัวเลขพร้อมปุ่ม +/− ขนาดใหญ่ (≥ 48px) — ปรับค่าโดยไม่ต้องพิมพ์ กดมือเดียวได้ (PLAN ข้อ 4)
 * ยังพิมพ์ตัวเลขเองได้ตามปกติ
 */
export function NumberStepper({
  label, value, onChange, step, min = 0, max, start, required, error, hint, changedFrom,
}: NumberStepperProps) {
  const id = useId()
  const t = useT()
  const describedBy = error ? `${id}-error` : changedFrom !== undefined ? `${id}-changed` : hint ? `${id}-hint` : undefined

  function bump(direction: 1 | -1) {
    const parsed = parseNumber(value)
    const base = parsed !== undefined && Number.isFinite(parsed) ? parsed : (start ?? min)
    // เริ่มจากช่องว่าง: กดครั้งแรกให้ได้ค่าเริ่มต้นตรง ๆ ไม่ขยับต่อ
    const next = parsed === undefined && start !== undefined ? start : base + direction * step
    const clamped = Math.min(max ?? Infinity, Math.max(min, round(next)))
    onChange(String(clamped))
  }

  const btn =
    'flex size-12 shrink-0 items-center justify-center rounded-xl border border-stone-300 bg-white text-2xl font-semibold text-stone-800 select-none hover:bg-stone-100 active:bg-stone-200 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700'

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}
        {required && <span aria-hidden className="text-red-600"> *</span>}
      </label>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} aria-label={t('stepper.decrease', { label })} onClick={() => bump(-1)}>−</button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          data-changed={changedFrom !== undefined ? 'true' : undefined}
          className={`block min-h-12 min-w-0 flex-1 rounded-xl border bg-white px-1 text-center text-lg font-semibold tabular-nums text-stone-900 focus:outline-2 focus:outline-amber-600 aria-[invalid=true]:border-red-600 dark:bg-stone-800 dark:text-stone-100 ${
            changedFrom !== undefined
              ? 'border-amber-500 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/40'
              : 'border-stone-300 dark:border-stone-600'
          }`}
        />
        <button type="button" className={btn} aria-label={t('stepper.increase', { label })} onClick={() => bump(1)}>+</button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
      ) : changedFrom !== undefined ? (
        <p id={`${id}-changed`} className="mt-1 text-sm font-medium text-amber-800 dark:text-amber-300">
          {t('stepper.changed', { prev: changedFrom })}
        </p>
      ) : (
        hint && <p id={`${id}-hint`} className="mt-1 text-sm text-stone-500 dark:text-stone-400">{hint}</p>
      )}
    </div>
  )
}
