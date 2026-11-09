import { useState } from 'react'
import { CartesianGrid, ReferenceArea, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { TARGET_RANGES } from '../../domain/calc'
import { CONTROL_FAMILIES, controlPoints, type ControlFamily, type ControlPoint } from '../../domain/insights'
import type { Bean, Brew } from '../../domain/types'
import { formatDateTime } from '../format'
import { METHOD_LABEL } from '../labels'
import { ChartCard, DataTable, EmptyChart, TooltipBox } from './chartParts'

const FAMILY_LABEL: Record<ControlFamily, string> = { filter: 'Filter / Pour-over', espresso: 'Espresso' }
/** ขั้นปัดขอบแกนของแต่ละ family (TDS ของ Filter เป็นหน่วยละเอียดกว่า Espresso มาก) */
const AXIS_STEP: Record<ControlFamily, { x: number; y: number }> = {
  filter: { x: 0.1, y: 2 },
  espresso: { x: 1, y: 2 },
}
const STATUS_TEXT = { low: 'ต่ำกว่าเป้า', ok: 'ในเป้า', high: 'สูงกว่าเป้า' } as const

/** ขอบแกนที่ครอบทั้งข้อมูลและกรอบเป้าหมายเสมอ (กรอบต้องเห็นครบแม้ยังไม่มีข้อมูล/ข้อมูลอยู่ในกรอบหมด) */
export function axisDomain(values: readonly number[], target: readonly [number, number], step: number): [number, number] {
  const lo = Math.min(target[0], ...values)
  const hi = Math.max(target[1], ...values)
  const round = (n: number) => Math.round(n * 1e6) / 1e6
  // ค่าทศนิยมคลาดเคลื่อนได้ (1.1 ÷ 0.1 = 10.999…) — เผื่อ EPS ก่อนปัดลง/ขึ้น
  const EPS = 1e-9
  return [round(Math.floor((lo - step * 0.5) / step + EPS) * step), round(Math.ceil((hi + step * 0.5) / step - EPS) * step)]
}

/** เส้นแกนทุก `step` ภายในขอบเขต (แทนการให้ Recharts เลือกเอง ซึ่งได้เลขแปลก เช่น 1.15, 1.3) */
export function axisTicks([lo, hi]: readonly [number, number], step: number): number[] {
  const out: number[] = []
  for (let v = lo; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6)
  return out
}

interface Props {
  brews: readonly Brew[]
  beans: ReadonlyMap<string, Bean>
}

/** จุดที่ใหญ่พอให้แตะ/ชี้ (hit ≥ 24px) — ในเป้า = วงกลมทึบสีหลัก, นอกเป้า = วงกลมกลวงสีเทา (ไม่พึ่งสีอย่างเดียว) */
function Dot({ cx = 0, cy = 0, inRange }: { cx?: number; cy?: number; inRange: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill="transparent" />
      {inRange ? (
        <circle cx={cx} cy={cy} r={5} fill="var(--viz-series)" stroke="var(--viz-surface)" strokeWidth={2} />
      ) : (
        <circle cx={cx} cy={cy} r={5} fill="var(--viz-surface)" stroke="var(--viz-muted)" strokeWidth={2} />
      )}
    </g>
  )
}

/**
 * Brew Control Chart: แกน X = TDS, แกน Y = Extraction Yield — กรอบน้ำเงินจาง = ช่วงเป้าหมาย SCA
 * ล่าง = สกัดน้อย · บน = สกัดมาก · ซ้าย = จืด · ขวา = เข้ม
 */
export function ControlChart({ brews, beans }: Props) {
  const [family, setFamily] = useState<ControlFamily>('filter')
  const [table, setTable] = useState(false)
  const target = TARGET_RANGES[family]
  const points = controlPoints(brews, beans, family)
  const inside = points.filter((p) => p.inRange)
  const outside = points.filter((p) => !p.inRange)
  const step = AXIS_STEP[family]
  const xDomain = axisDomain(points.map((p) => p.tds), target.tds, step.x)
  const yDomain = axisDomain(points.map((p) => p.ey), target.ey, step.y)
  const name = (p: ControlPoint) => `${METHOD_LABEL[p.method]} · ${beans.get(p.beanId)?.name ?? 'เมล็ดที่ลบแล้ว'}`

  const familyPicker = (
    <div role="group" aria-label="ประเภทการชง" className="grid grid-cols-2 gap-1 rounded-xl bg-stone-200 p-1 dark:bg-stone-800">
      {CONTROL_FAMILIES.map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={f === family}
          onClick={() => setFamily(f)}
          className={`min-h-12 rounded-lg text-sm font-semibold ${f === family ? 'bg-white text-amber-900 shadow-sm dark:bg-stone-600 dark:text-amber-300' : 'text-stone-600 dark:text-stone-400'}`}
        >
          {FAMILY_LABEL[f]}
        </button>
      ))}
    </div>
  )

  return (
    <ChartCard
      title="Brew Control Chart"
      subtitle="ความเข้ม (TDS) × การสกัด (EY) เทียบช่วงเป้าหมาย SCA"
      tableView={table}
      onToggleTable={() => setTable((v) => !v)}
      actions={familyPicker}
    >
      {points.length === 0 ? (
        <EmptyChart>
          ยังไม่มีการชงแบบ {FAMILY_LABEL[family]} ที่ใส่ค่า TDS — ต้องใช้ Refractometer จึงเป็นข้อมูลเสริมที่ไม่บังคับ
          (ใส่ได้ในช่อง “รายละเอียดเพิ่มเติม” ตอนบันทึกการชง)
        </EmptyChart>
      ) : table ? (
        <DataTable
          caption={`ค่า TDS และ EY ของการชงแบบ ${FAMILY_LABEL[family]}`}
          headers={['วันที่ชง', 'การชง', 'TDS %', 'EY %', 'ผล']}
          rows={[...points].reverse().map((p) => [
            formatDateTime(p.brewedAt), name(p), p.tds, p.ey,
            p.inRange ? 'อยู่ในเป้า' : `ความเข้ม${STATUS_TEXT[p.tdsStatus]} · การสกัด${STATUS_TEXT[p.eyStatus]}`,
          ])}
        />
      ) : (
        <>
          <div role="img" aria-label={`แผนภาพกระจาย TDS กับ EY ${points.length} ครั้ง อยู่ในเป้าหมาย ${inside.length} ครั้ง — ดูรายละเอียดทั้งหมดในมุมมองตาราง`}>
            <ResponsiveContainer width="100%" height={280} initialDimension={{ width: 320, height: 280 }}>
              <ScatterChart margin={{ top: 8, right: 12, bottom: 16, left: 0 }}>
                <CartesianGrid stroke="var(--viz-grid)" />
                <XAxis
                  type="number" dataKey="tds" name="TDS" unit="%" domain={xDomain} ticks={axisTicks(xDomain, step.x)}
                  stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text)', fontSize: 12 }} tickLine={false}
                  label={{ value: 'TDS (%)', position: 'insideBottom', offset: -10, fill: 'var(--viz-text)', fontSize: 12 }}
                />
                <YAxis
                  type="number" dataKey="ey" name="EY" unit="%" domain={yDomain} ticks={axisTicks(yDomain, step.y)} width={36}
                  stroke="var(--viz-axis)" tick={{ fill: 'var(--viz-text)', fontSize: 12 }} tickLine={false} axisLine={false}
                />
                <ReferenceArea
                  x1={target.tds[0]} x2={target.tds[1]} y1={target.ey[0]} y2={target.ey[1]}
                  fill="var(--viz-series)" fillOpacity={0.1} stroke="none" ifOverflow="visible"
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    const p = active ? (payload?.[0]?.payload as ControlPoint | undefined) : undefined
                    if (!p) return null
                    return (
                      <TooltipBox
                        title={`${formatDateTime(p.brewedAt)} · ${name(p)}`}
                        rows={[
                          { value: `${p.tds}%`, label: `TDS (${STATUS_TEXT[p.tdsStatus]})` },
                          { value: `${p.ey}%`, label: `EY (${STATUS_TEXT[p.eyStatus]})` },
                        ]}
                      />
                    )
                  }}
                />
                <Scatter name="นอกเป้าหมาย" data={outside} shape={(props: { cx?: number; cy?: number }) => <Dot {...props} inRange={false} />} isAnimationActive={false} />
                <Scatter name="ในเป้าหมาย" data={inside} shape={(props: { cx?: number; cy?: number }) => <Dot {...props} inRange />} isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <ul aria-label="คำอธิบายสัญลักษณ์" className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-700 dark:text-stone-300">
            <li className="flex items-center gap-1.5">
              <svg width="14" height="14" aria-hidden><circle cx="7" cy="7" r="5" fill="var(--viz-series)" /></svg>
              ในเป้าหมาย ({inside.length})
            </li>
            <li className="flex items-center gap-1.5">
              <svg width="14" height="14" aria-hidden><circle cx="7" cy="7" r="5" fill="var(--viz-surface)" stroke="var(--viz-muted)" strokeWidth="2" /></svg>
              นอกเป้าหมาย ({outside.length})
            </li>
            <li className="flex items-center gap-1.5">
              <svg width="14" height="14" aria-hidden><rect width="14" height="14" rx="2" fill="var(--viz-series)" fillOpacity="0.15" /></svg>
              กรอบเป้าหมาย SCA
            </li>
          </ul>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            อ่านกราฟ: ต่ำกว่ากรอบ = สกัดน้อย (เปรี้ยว) · สูงกว่า = สกัดมาก (ขม) · ซ้าย = จืด · ขวา = เข้ม
          </p>
        </>
      )}
    </ChartCard>
  )
}
