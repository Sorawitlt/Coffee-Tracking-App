import { METHOD_PROFILES } from './methods'
import type { Bean, Brew, LocalDate, Method } from './types'

/**
 * สูตรคำนวณกลาง (PLAN ข้อ 5.2) — Pure functions ไม่มี side effect
 * ทุกหน้าจอ/Export ต้องเรียกจากที่นี่ เพื่อให้ตัวเลขตรงกันทั้งแอป
 */

// ---------- ปัดเศษ ----------

/** ปัดเศษทศนิยมแบบไม่มีปัญหา floating point (เช่น 1.005 → 1.01) */
export function roundTo(value: number, decimals = 1): number {
  const f = 10 ** decimals
  return Math.round((value + Number.EPSILON) * f) / f
}

const isPositive = (n: number | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0

// ---------- อัตราส่วน ----------

/** อัตราส่วน `น้ำ ÷ กาแฟ` (ค่า x ใน 1 : x) — คืน undefined ถ้าข้อมูลไม่ครบ */
export function ratio(doseG: number, waterG: number): number | undefined {
  if (!isPositive(doseG) || !isPositive(waterG)) return undefined
  return waterG / doseG
}

/** แสดงเป็น "1:16" หรือ "1:15.5" */
export function formatRatio(x: number | undefined): string {
  if (x === undefined || !Number.isFinite(x)) return '—'
  return `1:${roundTo(x, 1)}`
}

/** น้ำที่ต้องใช้สำหรับกาแฟ `doseG` ที่อัตราส่วน 1 : `x` (ปัด 1 ตำแหน่ง) */
export function waterForDose(doseG: number, x: number): number {
  return roundTo(doseG * x, 1)
}

/** กาแฟที่ต้องใช้สำหรับน้ำ `waterG` ที่อัตราส่วน 1 : `x` (ปัด 1 ตำแหน่ง) */
export function doseForWater(waterG: number, x: number): number {
  return roundTo(waterG / x, 1)
}

// ---------- น้ำกาแฟที่ได้ & Extraction ----------

/** ผงกาแฟอุ้มน้ำไว้ประมาณ 2 เท่าของน้ำหนักตัวเอง */
export const GROUNDS_ABSORPTION = 2

/**
 * น้ำหนักเครื่องดื่มโดยประมาณ (เมื่อไม่ได้ชั่งจริง)
 * - Espresso: `waterG` คือน้ำหนักช็อตอยู่แล้ว
 * - อื่น ๆ: `น้ำ − (กาแฟ × 2)`
 */
export function estimateBeverageG(method: Method, doseG: number, waterG: number): number {
  if (METHOD_PROFILES[method].style === 'espresso') return waterG
  return Math.max(0, waterG - doseG * GROUNDS_ABSORPTION)
}

/** น้ำหนักเครื่องดื่ม: ใช้ค่าที่ชั่งจริงก่อน ไม่มีจึงประมาณ */
export function beverageG(brew: Pick<Brew, 'method' | 'doseG' | 'waterG' | 'yieldG'>): number {
  return isPositive(brew.yieldG) ? brew.yieldG : estimateBeverageG(brew.method, brew.doseG, brew.waterG)
}

/** Extraction Yield (%) = (น้ำหนักเครื่องดื่ม × TDS%) ÷ กาแฟ */
export function extractionYield(beverage: number, tdsPercent: number, doseG: number): number | undefined {
  if (!isPositive(beverage) || !isPositive(tdsPercent) || !isPositive(doseG)) return undefined
  return (beverage * tdsPercent) / doseG
}

// ---------- ช่วงเป้าหมาย SCA ----------

export type Range = readonly [min: number, max: number]

export const TARGET_RANGES = {
  filter: { tds: [1.15, 1.45], ey: [18, 22] },
  espresso: { tds: [8, 12], ey: [18, 22] },
} as const satisfies Record<string, { tds: Range; ey: Range }>

export type RangeStatus = 'low' | 'ok' | 'high'

export function classifyRange(value: number, [min, max]: Range): RangeStatus {
  if (value < min) return 'low'
  if (value > max) return 'high'
  return 'ok'
}

// ---------- วันที่ ----------

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** แปลง Date เป็น "YYYY-MM-DD" ตามเวลาท้องถิ่น */
export function toLocalDate(date: Date): LocalDate {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function localDateToDayNumber(date: LocalDate): number | undefined {
  const m = DATE_RE.exec(date)
  if (!m) return undefined
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(ms) ? undefined : Math.round(ms / 86_400_000)
}

/**
 * วันหลังคั่ว = วันที่ชง − วันที่คั่ว (นับตามวันปฏิทินท้องถิ่น ไม่ได้รับผลจาก Daylight saving)
 * คืน undefined ถ้ารูปแบบวันที่ไม่ถูกต้อง
 */
export function daysOffRoast(roastDate: LocalDate, brewedAt: Date | string = new Date()): number | undefined {
  const at = typeof brewedAt === 'string' ? new Date(brewedAt) : brewedAt
  if (Number.isNaN(at.getTime())) return undefined
  const roast = localDateToDayNumber(roastDate)
  const brew = localDateToDayNumber(toLocalDate(at))
  if (roast === undefined || brew === undefined) return undefined
  return brew - roast
}

/** เกณฑ์ความสดของเมล็ด (PLAN ข้อ 5.3) */
export const FRESH_MIN_DAYS = 4
export const STALE_AFTER_DAYS = 45

export type Freshness = 'tooFresh' | 'ok' | 'stale'

export function freshness(days: number): Freshness {
  if (days < FRESH_MIN_DAYS) return 'tooFresh'
  if (days > STALE_AFTER_DAYS) return 'stale'
  return 'ok'
}

// ---------- ต้นทุน ----------

/** ต้นทุนต่อแก้ว = (ราคาถุง ÷ น้ำหนักถุง) × กาแฟที่ใช้ */
export function costPerCup(priceTotal: number | undefined, bagWeightG: number, doseG: number): number | undefined {
  if (priceTotal === undefined || !Number.isFinite(priceTotal) || priceTotal < 0) return undefined
  if (!isPositive(bagWeightG) || !isPositive(doseG)) return undefined
  return (priceTotal / bagWeightG) * doseG
}

// ---------- หน่วย ----------

export const G_PER_OZ = 28.349523125

export const gToOz = (g: number): number => g / G_PER_OZ
export const ozToG = (oz: number): number => oz * G_PER_OZ
export const cToF = (c: number): number => (c * 9) / 5 + 32
export const fToC = (f: number): number => ((f - 32) * 5) / 9

// ---------- สรุปค่าของการชง 1 ครั้ง ----------

export interface BrewMetrics {
  ratio?: number
  beverageG: number
  /** true = ประมาณจากสูตร, false = ชั่งจริง */
  beverageEstimated: boolean
  ey?: number
  tdsStatus?: RangeStatus
  eyStatus?: RangeStatus
  daysOffRoast?: number
  freshness?: Freshness
  costPerCup?: number
  currency?: string
}

/** รวมค่าที่คำนวณได้ทั้งหมดของการชง 1 ครั้ง — ใช้ใน UI, กราฟ และ Export */
export function brewMetrics(
  brew: Pick<Brew, 'method' | 'doseG' | 'waterG' | 'yieldG' | 'tds' | 'brewedAt'>,
  bean?: Pick<Bean, 'roastDate' | 'priceTotal' | 'weightG' | 'currency'>,
): BrewMetrics {
  const bev = beverageG(brew)
  const ey = brew.tds === undefined ? undefined : extractionYield(bev, brew.tds, brew.doseG)
  const targetKey = METHOD_PROFILES[brew.method].targets
  const target = targetKey ? TARGET_RANGES[targetKey] : undefined
  const days = bean ? daysOffRoast(bean.roastDate, brew.brewedAt) : undefined

  return {
    ratio: ratio(brew.doseG, brew.waterG),
    beverageG: bev,
    beverageEstimated: !isPositive(brew.yieldG),
    ey,
    tdsStatus: target && isPositive(brew.tds) ? classifyRange(brew.tds, target.tds) : undefined,
    eyStatus: target && ey !== undefined ? classifyRange(ey, target.ey) : undefined,
    daysOffRoast: days,
    freshness: days === undefined ? undefined : freshness(days),
    costPerCup: bean ? costPerCup(bean.priceTotal, bean.weightG, brew.doseG) : undefined,
    currency: bean?.currency,
  }
}
