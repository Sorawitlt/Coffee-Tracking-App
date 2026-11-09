import type { ReactNode } from 'react'
import { useT } from '../../i18n/I18nProvider'

/** ส่วนประกอบร่วมของกราฟ: กรอบการ์ด, ปุ่มสลับกราฟ/ตาราง, Tooltip (ค่านำ ป้ายตาม) */

export function ChartCard({
  title, subtitle, tableView, onToggleTable, children, actions,
}: {
  title: string
  subtitle?: string
  tableView: boolean
  onToggleTable: () => void
  children: ReactNode
  actions?: ReactNode
}) {
  const t = useT()
  return (
    <section aria-label={title} className="viz-root rounded-2xl border border-stone-200 bg-[var(--viz-surface)] p-3 dark:border-stone-700">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">{title}</h3>
          {subtitle && <p className="text-sm text-stone-600 dark:text-stone-400">{subtitle}</p>}
        </div>
        <button
          type="button"
          aria-pressed={tableView}
          onClick={onToggleTable}
          className="min-h-12 shrink-0 rounded-xl px-3 text-base font-semibold text-amber-800 hover:bg-amber-50 aria-pressed:bg-amber-100 dark:text-amber-400 dark:hover:bg-stone-800 dark:aria-pressed:bg-stone-800"
        >
          {t(tableView ? 'chart.viewChart' : 'chart.viewTable')}
        </button>
      </div>
      {actions && <div className="mt-2">{actions}</div>}
      <div className="mt-2">{children}</div>
    </section>
  )
}

export interface TooltipRow {
  /** ค่าที่เน้น (ตัวใหญ่) */
  value: string
  label: string
}

/** กล่อง Tooltip: ค่านำหน้า ป้ายตามหลัง; ข้อความทุกส่วนเป็นข้อมูลของผู้ใช้ → ใส่เป็นข้อความ (React escape ให้) */
export function TooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="viz-root rounded-xl border border-stone-300 bg-[var(--viz-surface)] px-3 py-2 text-sm shadow-md dark:border-stone-600">
      <p className="text-stone-600 dark:text-stone-400">{title}</p>
      {rows.map((r) => (
        <p key={r.label}>
          <strong className="text-base">{r.value}</strong>{' '}
          <span className="text-stone-600 dark:text-stone-400">{r.label}</span>
        </p>
      ))}
    </div>
  )
}

export function EmptyChart({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600 dark:border-stone-600 dark:text-stone-400">
      {children}
    </p>
  )
}

/** ตารางข้อมูลของกราฟ — ทางเข้าถึงค่าทุกจุดโดยไม่ต้องใช้เมาส์/สี */
export function DataTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: ReactNode[][] }) {
  return (
    // เลื่อนดูด้วยคีย์บอร์ดได้: กล่องที่เลื่อนได้ต้องรับโฟกัส (ตารางไม่มีปุ่ม/ลิงก์ให้โฟกัสแทน)
    <div tabIndex={0} role="region" aria-label={caption} className="max-h-80 overflow-auto rounded-xl border border-stone-200 dark:border-stone-700">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-stone-100 dark:bg-stone-800">
          <tr>
            {headers.map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-stone-200 dark:border-stone-700">
              {r.map((c, j) => <td key={j} className="px-3 py-2 tabular-nums">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
