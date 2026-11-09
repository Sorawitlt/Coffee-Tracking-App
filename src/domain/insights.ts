import { brewMetrics, roundTo, type RangeStatus } from './calc'
import { METHOD_PROFILES } from './methods'
import type { Bean, Brew, Method } from './types'

/**
 * สรุปผลจากประวัติการชง (PLAN ข้อ 3 โมดูล H) — Pure functions ไม่มี UI
 * UI (กราฟ/ตาราง) แค่นำผลไปแสดง ไม่คำนวณเอง
 */

// ---------- คะแนนตามเวลา ----------

export interface RatingPoint {
  id: string
  /** เวลาที่ชง (ms) */
  t: number
  brewedAt: string
  rating: number
}

/** จุดคะแนนเรียงเก่า → ใหม่ (เฉพาะการชงที่ให้คะแนนแล้ว) */
export function ratingSeries(brews: readonly Brew[]): RatingPoint[] {
  return brews
    .filter((b): b is Brew & { rating: NonNullable<Brew['rating']> } => b.rating !== undefined)
    .map((b) => ({ id: b.id, t: new Date(b.brewedAt).getTime(), brewedAt: b.brewedAt, rating: b.rating }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t)
}

export interface RatingSummary {
  total: number
  rated: number
  /** คะแนนเฉลี่ยทั้งหมด (ปัด 1 ตำแหน่ง) */
  average?: number
  /** แนวโน้ม: เฉลี่ยของครั้งล่าสุด เทียบกับช่วงก่อนหน้าที่ขนาดเท่ากัน — ต้องมีคะแนนอย่างน้อย 4 ครั้ง */
  trend?: { size: number; recent: number; previous: number; delta: number }
}

/** ขนาดหน้าต่างเทียบแนวโน้มสูงสุด (ครั้ง) */
export const TREND_WINDOW = 5
export const TREND_MIN_RATED = 4

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

export function ratingSummary(brews: readonly Brew[]): RatingSummary {
  const points = ratingSeries(brews)
  const summary: RatingSummary = { total: brews.length, rated: points.length }
  if (points.length === 0) return summary
  summary.average = roundTo(mean(points.map((p) => p.rating)), 1)
  if (points.length >= TREND_MIN_RATED) {
    const size = Math.min(TREND_WINDOW, Math.floor(points.length / 2))
    const recent = mean(points.slice(-size).map((p) => p.rating))
    const previous = mean(points.slice(-2 * size, -size).map((p) => p.rating))
    summary.trend = { size, recent: roundTo(recent, 1), previous: roundTo(previous, 1), delta: roundTo(recent - previous, 1) }
  }
  return summary
}

// ---------- Brew Control Chart (TDS × EY) ----------

export type ControlFamily = 'filter' | 'espresso'
export const CONTROL_FAMILIES: readonly ControlFamily[] = ['filter', 'espresso']

export interface ControlPoint {
  id: string
  brewedAt: string
  method: Method
  beanId: string
  tds: number
  /** Extraction Yield (%) */
  ey: number
  tdsStatus: RangeStatus
  eyStatus: RangeStatus
  /** TDS และ EY อยู่ในช่วงเป้าหมายทั้งคู่ */
  inRange: boolean
}

/**
 * จุดของกราฟ — เฉพาะการชงที่ใส่ TDS และเป็นวิธีที่มีช่วงเป้าหมายของ family นั้น
 * (Cold brew / Moka ไม่มีมาตรฐานอ้างอิง จึงไม่แสดง) เรียงเก่า → ใหม่
 */
export function controlPoints(
  brews: readonly Brew[],
  beans: ReadonlyMap<string, Bean>,
  family: ControlFamily,
): ControlPoint[] {
  const out: ControlPoint[] = []
  for (const b of brews) {
    if (METHOD_PROFILES[b.method].targets !== family) continue
    const m = brewMetrics(b, beans.get(b.beanId))
    if (b.tds === undefined || m.ey === undefined || m.tdsStatus === undefined || m.eyStatus === undefined) continue
    out.push({
      id: b.id, brewedAt: b.brewedAt, method: b.method, beanId: b.beanId,
      tds: b.tds, ey: roundTo(m.ey, 1),
      tdsStatus: m.tdsStatus, eyStatus: m.eyStatus,
      inRange: m.tdsStatus === 'ok' && m.eyStatus === 'ok',
    })
  }
  return out.sort((a, b) => a.brewedAt.localeCompare(b.brewedAt))
}

/** อ่านผลตำแหน่งบนกราฟเป็นคำ (สำหรับตาราง/คำอธิบาย): EY ต่ำ = สกัดน้อย, TDS ต่ำ = จืด */
export function describeControlPoint(p: Pick<ControlPoint, 'tdsStatus' | 'eyStatus'>): ControlReading {
  return { extraction: p.eyStatus, strength: p.tdsStatus }
}
export interface ControlReading {
  /** low = สกัดน้อย (Under) · ok · high = สกัดมาก (Over) */
  extraction: RangeStatus
  /** low = จืด · ok · high = เข้ม */
  strength: RangeStatus
}

// ---------- สูตรที่ดีที่สุดต่อเมล็ด ----------

export interface BestRecipe {
  brew: Brew
  /** true = ผู้ใช้ติดดาวเอง; false = แอปเลือกจากคะแนนสูงสุด (ยังไม่ได้ติดดาว) */
  starred: boolean
}

/**
 * สูตรที่ดีที่สุดของแต่ละ (เมล็ด + วิธีชง) — ติดดาวไว้ใช้ตามนั้น
 * ไม่ติดดาว = เลือกครั้งที่คะแนนสูงสุด (เสมอกัน: ล่าสุดก่อน); ไม่มีคะแนนเลย = ไม่แสดง
 * เรียงตามเวลาที่ชงล่าสุดของสูตรนั้น (ใหม่ก่อน)
 */
export function bestRecipes(brews: readonly Brew[]): BestRecipe[] {
  const groups = new Map<string, Brew[]>()
  for (const b of brews) {
    const key = `${b.beanId}\u0000${b.method}`
    const g = groups.get(key)
    if (g) g.push(b)
    else groups.set(key, [b])
  }
  const result: BestRecipe[] = []
  for (const group of groups.values()) {
    const starred = group.filter((b) => b.isBest).sort(byNewest)[0]
    if (starred) {
      result.push({ brew: starred, starred: true })
      continue
    }
    const top = group.filter((b) => b.rating !== undefined).sort((a, b) => b.rating! - a.rating! || byNewest(a, b))[0]
    if (top) result.push({ brew: top, starred: false })
  }
  return result.sort((a, b) => byNewest(a.brew, b.brew))
}

function byNewest(a: Brew, b: Brew): number {
  return b.brewedAt.localeCompare(a.brewedAt) || b.createdAt.localeCompare(a.createdAt)
}
