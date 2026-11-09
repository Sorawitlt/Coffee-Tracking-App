import { useState } from 'react'
import { listBeans, listBrews, useLive } from '../../db'
import { filterBrews, RANGE_PRESETS, rangeStart, type RangePreset } from '../../domain/history'
import { ratingSummary } from '../../domain/insights'
import { METHODS, type Method } from '../../domain/types'
import { SelectField } from '../../components/fields'
import { METHOD_LABEL } from '../labels'
import { BestRecipes } from './BestRecipes'
import { ControlChart } from './ControlChart'
import { RatingChart } from './RatingChart'

const RANGE_LABEL: Record<RangePreset, string> = { '7d': '7 วัน', '30d': '30 วัน', '90d': '90 วัน', all: 'ทั้งหมด' }

/**
 * แท็บ "สรุป": ตัวกรอง (แถวเดียวด้านบน คุมทุกอย่างที่อยู่ด้านล่าง) → ตัวเลขสรุป → สูตรที่ดีที่สุด → กราฟ
 * ตัวเลขและกราฟทุกส่วนคำนวณจากชุดข้อมูลที่กรองแล้วชุดเดียวกัน จึงตรงกันเสมอ
 */
export default function InsightsPage() {
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
      <section aria-label="สรุป" className="space-y-3">
        <h2 className="text-xl font-bold">สรุป</h2>
        <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center dark:border-stone-600">
          <p className="text-4xl" aria-hidden>📊</p>
          <p className="mt-2 font-medium">ยังไม่มีข้อมูลให้สรุป</p>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">บันทึกการชงสักครั้ง แล้วแนวโน้มและสูตรที่ดีที่สุดจะขึ้นที่นี่</p>
        </div>
      </section>
    )
  }

  const trend = summary.trend

  return (
    <section aria-label="สรุป" className="space-y-4">
      <h2 className="text-xl font-bold">สรุป</h2>

      <div className="space-y-3" role="search" aria-label="ตัวกรองสรุป">
        <div role="group" aria-label="ช่วงเวลา" className="grid grid-cols-4 gap-1 rounded-xl bg-stone-200 p-1 dark:bg-stone-800">
          {RANGE_PRESETS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === range}
              onClick={() => setRange(r)}
              className={`min-h-12 rounded-lg text-sm font-semibold ${r === range ? 'bg-white text-amber-900 shadow-sm dark:bg-stone-600 dark:text-amber-300' : 'text-stone-600 dark:text-stone-400'}`}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="เมล็ด" value={beanId} onChange={(e) => setBeanId(e.target.value)}>
            <option value="">ทุกเมล็ด</option>
            {beanList.map((b) => <option key={b.id} value={b.id}>{b.name}{b.archived ? ' (Archive)' : ''}</option>)}
          </SelectField>
          <SelectField label="วิธีชง" value={method} onChange={(e) => setMethod(e.target.value as Method | '')}>
            <option value="">ทุกวิธี</option>
            {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
          </SelectField>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <Tile label="ชงแล้ว" value={String(summary.total)} unit="ครั้ง" />
        <Tile label="คะแนนเฉลี่ย" value={summary.average === undefined ? '—' : String(summary.average)} unit={summary.average === undefined ? '' : 'ดาว'} />
        <div className="rounded-2xl border border-stone-200 bg-white p-2 dark:border-stone-700 dark:bg-stone-800">
          <dt className="text-sm text-stone-600 dark:text-stone-400">แนวโน้ม</dt>
          {trend ? (
            <dd className={`text-xl font-bold ${trend.delta > 0 ? 'text-green-800 dark:text-green-400' : trend.delta < 0 ? 'text-red-700 dark:text-red-400' : ''}`}>
              {trend.delta > 0 ? `▲ +${trend.delta}` : trend.delta < 0 ? `▼ ${trend.delta}` : '＝ 0'}
              <span className="block text-xs font-normal text-stone-600 dark:text-stone-400">
                {trend.delta > 0 ? 'ดีขึ้น' : trend.delta < 0 ? 'แย่ลง' : 'คงที่'} · เทียบ {trend.size} ครั้งก่อน
              </span>
            </dd>
          ) : (
            <dd className="text-xl font-bold">—<span className="block text-xs font-normal text-stone-600 dark:text-stone-400">ต้องมีคะแนน 4 ครั้ง</span></dd>
          )}
        </div>
      </dl>

      {scoped.length === 0 ? (
        <p role="status" className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600 dark:border-stone-600 dark:text-stone-400">
          ไม่มีการชงตามตัวกรองนี้ — ลองขยายช่วงเวลาหรือเลือก “ทุกเมล็ด / ทุกวิธี”
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
