import { useId } from 'react'

export interface ChoiceOption<T extends number | string> {
  value: T
  label: string
}

interface Props<T extends number | string> {
  label: string
  hint?: string
  options: readonly ChoiceOption<T>[]
  /** `undefined` = ยังไม่เลือก */
  value: T | undefined
  /** กดตัวที่เลือกอยู่ซ้ำ = ล้างค่า (ส่ง `undefined`) */
  onChange: (value: T | undefined) => void
}

/**
 * ตัวเลือกแบบปุ่มเรียงแถว (แทนสไลเดอร์) — กดมือเดียวได้บนจอ 360px, ปุ่มสูง ≥ 48px
 * เลือกได้ 1 ตัวหรือไม่เลือกเลย; ใช้ `aria-pressed` ให้โปรแกรมอ่านหน้าจอรู้สถานะ
 */
export function ChoiceGroup<T extends number | string>({ label, hint, options, value, onChange }: Props<T>) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={`${id}-label`} aria-describedby={hint ? `${id}-hint` : undefined}>
      <p id={`${id}-label`} className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-300">{label}</p>
      <div className="grid grid-cols-5 gap-1">
        {options.map((o) => {
          const selected = o.value === value
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? undefined : o.value)}
              className="min-h-12 rounded-xl border border-stone-300 bg-white px-0.5 text-sm font-semibold leading-tight text-stone-800 hover:bg-stone-100 aria-pressed:border-amber-700 aria-pressed:bg-amber-100 aria-pressed:text-amber-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700 dark:aria-pressed:border-amber-500 dark:aria-pressed:bg-amber-950 dark:aria-pressed:text-amber-200"
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {hint && <p id={`${id}-hint`} className="mt-1 text-sm text-stone-500 dark:text-stone-400">{hint}</p>}
    </div>
  )
}
