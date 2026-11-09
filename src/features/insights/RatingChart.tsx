import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Bean, Brew } from '../../domain/types'
import { ratingSeries, type RatingPoint } from '../../domain/insights'
import { formatDateTime } from '../format'
import { METHOD_LABEL } from '../labels'
import { ChartCard, DataTable, EmptyChart, TooltipBox } from './chartParts'

const DAY_MS = 86_400_000
const shortDate = (t: number) =>
  new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(new Date(t))

interface Props {
  brews: readonly Brew[]
  beans: ReadonlyMap<string, Bean>
}

/** กราฟคะแนนตามเวลา — เส้นเดียว (คะแนน 1–5) แกนเดียว; เลือกเมล็ด/วิธีชงที่ตัวกรองด้านบนเพื่อดูแนวโน้มของสูตรเดียว */
export function RatingChart({ brews, beans }: Props) {
  const [table, setTable] = useState(false)
  const points = ratingSeries(brews)
  const brewById = new Map(brews.map((b) => [b.id, b]))
  const nameOf = (p: RatingPoint) => {
    const b = brewById.get(p.id)
    return b ? `${METHOD_LABEL[b.method]} · ${beans.get(b.beanId)?.name ?? 'เมล็ดที่ลบแล้ว'}` : ''
  }

  return (
    <ChartCard title="คะแนนตามเวลา" subtitle="ดาวที่ให้แต่ละครั้ง เรียงตามวันที่ชง" tableView={table} onToggleTable={() => setTable((v) => !v)}>
      {points.length === 0 ? (
        <EmptyChart>ยังไม่มีการชงที่ให้คะแนนในตัวกรองนี้ — ให้ดาวตอนบันทึกการชงแล้วกราฟจะขึ้นที่นี่</EmptyChart>
      ) : table ? (
        <DataTable
          caption="คะแนนของแต่ละครั้งที่ชง"
          headers={['วันที่ชง', 'การชง', 'คะแนน']}
          rows={[...points].reverse().map((p) => [formatDateTime(p.brewedAt), nameOf(p), `${p.rating} ดาว`])}
        />
      ) : (
        <div role="img" aria-label={`กราฟเส้นคะแนน ${points.length} ครั้ง ล่าสุด ${points[points.length - 1].rating} ดาว — ดูรายละเอียดทั้งหมดในมุมมองตาราง`}>
          <ResponsiveContainer width="100%" height={220} initialDimension={{ width: 320, height: 220 }}>
            <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
              <XAxis
                dataKey="t" type="number" scale="time"
                domain={([min, max]: readonly [number, number]): [number, number] => (min === max ? [min - DAY_MS, max + DAY_MS] : [min, max])}
                tickFormatter={shortDate} tickCount={4} minTickGap={24}
                stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text)', fontSize: 12 }} tickLine={false}
              />
              <YAxis
                domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} width={28} allowDecimals={false}
                stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text)', fontSize: 12 }} tickLine={false} axisLine={false}
              />
              <Tooltip
                cursor={{ stroke: 'var(--viz-axis)', strokeWidth: 1 }}
                content={({ active, payload }) => {
                  const p = active ? (payload?.[0]?.payload as RatingPoint | undefined) : undefined
                  if (!p) return null
                  return <TooltipBox title={`${formatDateTime(p.brewedAt)} · ${nameOf(p)}`} rows={[{ value: `${p.rating} ดาว`, label: 'คะแนน' }]} />
                }}
              />
              <Line
                type="linear" dataKey="rating" stroke="var(--viz-series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                dot={{ r: 4, fill: 'var(--viz-series)', stroke: 'var(--viz-surface)', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: 'var(--viz-series)', stroke: 'var(--viz-surface)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}
