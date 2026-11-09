import { SelectField, TextField } from '../../components/fields'
import { Button } from '../../components/Button'
import type { BrewFilter } from '../../domain/history'
import { isFilterActive } from '../../domain/history'
import { METHODS, type Bean, type Method } from '../../domain/types'
import { METHOD_LABEL } from '../labels'

interface Props {
  filter: BrewFilter
  onChange: (next: BrewFilter) => void
  beans: readonly Bean[]
  /** จำนวนที่แสดง / ทั้งหมด */
  shown: number
  total: number
}

/** ค้นหา + ตัวกรองของรายการบันทึก — ช่องค้นหาเห็นตลอด ตัวกรองอื่นพับไว้ (ลดความรก) */
export function BrewFilters({ filter, onChange, beans, shown, total }: Props) {
  const active = isFilterActive(filter)
  const set = (changes: Partial<BrewFilter>) => onChange({ ...filter, ...changes })
  // ตัวกรองซ่อนอยู่ในส่วนที่พับ → บอกจำนวนที่ใช้อยู่ที่หัวข้อ
  const hiddenActive = [filter.method, filter.beanId, filter.minRating !== undefined, filter.bestOnly].filter(Boolean).length

  return (
    <div className="space-y-2" role="search" aria-label="ค้นหาบันทึก">
      <TextField
        label="ค้นหา"
        type="search"
        value={filter.text ?? ''}
        placeholder="ชื่อเมล็ด โรงคั่ว วิธีชง รสชาติ โน้ต"
        autoComplete="off"
        onChange={(e) => set({ text: e.target.value })}
      />
      <details className="rounded-2xl border border-stone-200 px-3 dark:border-stone-700" open={hiddenActive > 0 ? true : undefined}>
        <summary className="flex min-h-12 cursor-pointer items-center text-base font-semibold">
          ตัวกรอง{hiddenActive > 0 ? ` (${hiddenActive})` : ''}
        </summary>
        <div className="space-y-3 pb-3">
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="วิธีชง" value={filter.method ?? ''} onChange={(e) => set({ method: (e.target.value || undefined) as Method | undefined })}>
              <option value="">ทุกวิธี</option>
              {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </SelectField>
            <SelectField label="เมล็ด" value={filter.beanId ?? ''} onChange={(e) => set({ beanId: e.target.value || undefined })}>
              <option value="">ทุกเมล็ด</option>
              {beans.map((b) => <option key={b.id} value={b.id}>{b.name}{b.archived ? ' (Archive)' : ''}</option>)}
            </SelectField>
          </div>
          <SelectField
            label="คะแนนอย่างน้อย"
            value={filter.minRating === undefined ? '' : String(filter.minRating)}
            onChange={(e) => set({ minRating: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">ทุกคะแนน (รวมที่ยังไม่ให้ดาว)</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)} ({n} ดาวขึ้นไป)</option>)}
          </SelectField>
          <label className="flex min-h-12 items-center gap-3 text-base">
            <input type="checkbox" checked={filter.bestOnly ?? false} onChange={(e) => set({ bestOnly: e.target.checked || undefined })} className="size-6 accent-amber-700" />
            เฉพาะ ⭐ สูตรที่ดีที่สุด
          </label>
        </div>
      </details>
      {active && (
        <div className="flex items-center justify-between gap-3">
          <p role="status" className="text-sm text-stone-600 dark:text-stone-400">แสดง {shown} จาก {total} รายการ</p>
          <Button variant="ghost" onClick={() => onChange({})}>ล้างตัวกรอง</Button>
        </div>
      )}
    </div>
  )
}
