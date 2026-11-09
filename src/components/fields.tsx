import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const CONTROL =
  'block min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-amber-700 focus:outline-2 focus:outline-amber-600 aria-[invalid=true]:border-red-600 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100'

interface FieldShellProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  id: string
  children: ReactNode
}

function FieldShell({ label, required, error, hint, id, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}
        {required && <span aria-hidden className="text-red-600"> *</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-sm text-stone-500 dark:text-stone-400">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

interface CommonProps {
  label: string
  error?: string
  hint?: string
}

function describedBy(id: string, error?: string, hint?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined
}

export function TextField({
  label, error, hint, required, className = '', ...props
}: CommonProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <FieldShell {...{ label, required, error, hint, id }}>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${CONTROL} ${className}`}
        {...props}
      />
    </FieldShell>
  )
}

/** ช่องตัวเลข — ใช้ `inputMode="decimal"` ให้คีย์บอร์ดมือถือเป็นแป้นตัวเลข; เก็บค่าเป็น string (แปลงที่ชั้นฟอร์ม) */
export function NumberField({
  label, error, hint, required, className = '', ...props
}: CommonProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const id = useId()
  return (
    <FieldShell {...{ label, required, error, hint, id }}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${CONTROL} ${className}`}
        {...props}
      />
    </FieldShell>
  )
}

export function SelectField({
  label, error, hint, required, className = '', children, ...props
}: CommonProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <FieldShell {...{ label, required, error, hint, id }}>
      <select
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${CONTROL} ${className}`}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  )
}

export function TextAreaField({
  label, error, hint, required, className = '', ...props
}: CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <FieldShell {...{ label, required, error, hint, id }}>
      <textarea
        id={id}
        rows={3}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${CONTROL} py-2 ${className}`}
        {...props}
      />
    </FieldShell>
  )
}
