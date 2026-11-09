import { brewMetrics, roundTo } from './calc'
import { toCsv, type CsvColumn } from './csv'
import { remainingDisplayG } from './inventory'
import type { Bean, Brew, Gear } from './types'

/**
 * แปลงข้อมูลเป็นตาราง CSV สำหรับวิเคราะห์ใน Excel / Google Sheets (PLAN ข้อ 3 โมดูล I)
 *
 * - หัวคอลัมน์เป็นภาษาอังกฤษ + ระบุหน่วย (`dose_g`, `temp_c`) → ใช้ได้ทุกภาษาและต่อเข้าระบบอื่น (เช่น ERP) ได้ตรง ๆ
 * - ค่าที่เป็นตัวเลือก (วิธีชง ระดับคั่ว ฯลฯ) ส่งออกเป็น **รหัส** ไม่ใช่ป้ายภาษาไทย → ข้อมูลไม่เปลี่ยนตามภาษาที่เลือก
 * - ค่าที่คำนวณได้ (ratio, EY, วันหลังคั่ว, ต้นทุนต่อแก้ว) คำนวณใหม่จาก `calc.ts` ตอนส่งออก ไม่ได้เก็บในฐานข้อมูล
 * - วันเวลาเป็นเวลาท้องถิ่น `YYYY-MM-DD HH:mm` → Excel/Sheets อ่านเป็นวันที่ได้ทันที
 * - ตัวเลขใช้จุดทศนิยมเสมอ ไม่ใส่ตัวคั่นหลักพัน
 */

const pad2 = (n: number) => String(n).padStart(2, '0')

/** ISO 8601 → "YYYY-MM-DD HH:mm" ตามเวลาท้องถิ่น (อ่านไม่ได้ = ว่าง) */
export function toLocalDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const round = (n: number | undefined, decimals: number) => (n === undefined ? undefined : roundTo(n, decimals))

/** การชงเรียงจากเก่า → ใหม่ (เหมาะกับการทำกราฟ/Pivot ใน Spreadsheet) */
export function brewsToCsv(brews: readonly Brew[], beans: readonly Bean[], gear: readonly Gear[]): string {
  const beanById = new Map(beans.map((b) => [b.id, b]))
  const gearById = new Map(gear.map((g) => [g.id, g]))
  const sorted = [...brews].sort((a, b) => a.brewedAt.localeCompare(b.brewedAt))

  interface Row {
    brew: Brew
    bean?: Bean
    m: ReturnType<typeof brewMetrics>
  }
  const rows: Row[] = sorted.map((brew) => {
    const bean = beanById.get(brew.beanId)
    return { brew, bean, m: brewMetrics(brew, bean) }
  })

  const columns: CsvColumn<Row>[] = [
    { header: 'brew_id', value: (r) => r.brew.id },
    { header: 'brewed_at', value: (r) => toLocalDateTime(r.brew.brewedAt) },
    { header: 'method', value: (r) => r.brew.method },
    { header: 'bean_id', value: (r) => r.brew.beanId },
    { header: 'bean_name', value: (r) => r.bean?.name },
    { header: 'roaster', value: (r) => r.bean?.roaster },
    { header: 'origin', value: (r) => r.bean?.origin },
    { header: 'roast_date', value: (r) => r.bean?.roastDate },
    { header: 'days_off_roast', value: (r) => r.m.daysOffRoast },
    { header: 'grinder', value: (r) => (r.brew.grinderId ? gearById.get(r.brew.grinderId)?.name : undefined) },
    { header: 'brewer', value: (r) => (r.brew.brewerId ? gearById.get(r.brew.brewerId)?.name : undefined) },
    { header: 'dose_g', value: (r) => r.brew.doseG },
    { header: 'water_g', value: (r) => r.brew.waterG },
    { header: 'ratio_1_to_x', value: (r) => round(r.m.ratio, 2) },
    { header: 'yield_g', value: (r) => r.brew.yieldG },
    { header: 'beverage_g', value: (r) => round(r.m.beverageG, 1) },
    { header: 'beverage_estimated', value: (r) => r.m.beverageEstimated },
    { header: 'temp_c', value: (r) => r.brew.tempC },
    { header: 'grind_setting', value: (r) => r.brew.grindSetting },
    { header: 'bloom_sec', value: (r) => r.brew.bloomSec },
    { header: 'total_time_sec', value: (r) => r.brew.totalTimeSec },
    { header: 'tds_pct', value: (r) => r.brew.tds },
    { header: 'ey_pct', value: (r) => round(r.m.ey, 2) },
    { header: 'rating', value: (r) => r.brew.rating },
    { header: 'balance', value: (r) => r.brew.balance },
    { header: 'body', value: (r) => r.brew.body },
    { header: 'sweetness', value: (r) => r.brew.sweetness },
    { header: 'sour_and_bitter', value: (r) => r.brew.sourAndBitter },
    { header: 'flavor_tags', value: (r) => r.brew.flavorTags.join(';') },
    { header: 'is_best', value: (r) => r.brew.isBest },
    { header: 'advice', value: (r) => r.brew.advice?.kind },
    { header: 'cost_per_cup', value: (r) => round(r.m.costPerCup, 2) },
    { header: 'currency', value: (r) => (r.m.costPerCup === undefined ? undefined : r.m.currency) },
    { header: 'notes', value: (r) => r.brew.notes },
  ]
  return toCsv(rows, columns)
}

/** คลังเมล็ด เรียงตามวันที่คั่วล่าสุดก่อน */
export function beansToCsv(beans: readonly Bean[]): string {
  const sorted = [...beans].sort((a, b) => b.roastDate.localeCompare(a.roastDate))
  const columns: CsvColumn<Bean>[] = [
    { header: 'bean_id', value: (b) => b.id },
    { header: 'name', value: (b) => b.name },
    { header: 'roaster', value: (b) => b.roaster },
    { header: 'origin', value: (b) => b.origin },
    { header: 'variety', value: (b) => b.variety },
    { header: 'process', value: (b) => b.process },
    { header: 'roast_level', value: (b) => b.roastLevel },
    { header: 'roast_date', value: (b) => b.roastDate },
    { header: 'category', value: (b) => b.category },
    { header: 'weight_g', value: (b) => b.weightG },
    // ยอดคงเหลือในฐานข้อมูลติดลบได้ (ชงเกินที่บันทึก) — ส่งออกเป็น ≥ 0 เหมือนที่แสดงในแอป
    { header: 'remaining_g', value: (b) => round(remainingDisplayG(b), 1) },
    { header: 'price_total', value: (b) => b.priceTotal },
    { header: 'currency', value: (b) => b.currency },
    { header: 'archived', value: (b) => b.archived },
    { header: 'notes', value: (b) => b.notes },
    { header: 'created_at', value: (b) => toLocalDateTime(b.createdAt) },
  ]
  return toCsv(sorted, columns)
}
