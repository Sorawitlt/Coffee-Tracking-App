import type { Bean, BeanProcess, GearType, RoastLevel } from './types'

/**
 * ตรรกะคลังเมล็ด & อุปกรณ์ (PLAN ข้อ 3 โมดูล A, B) — Pure functions ไม่มี UI
 */

// ---------- ตัวเลือกคงที่ (ลำดับที่แสดงในฟอร์ม) ----------

export const ROAST_LEVELS: readonly RoastLevel[] = ['light', 'mediumLight', 'medium', 'mediumDark', 'dark']
export const BEAN_PROCESSES: readonly BeanProcess[] = ['washed', 'natural', 'honey', 'anaerobic', 'other']
export const GEAR_TYPES: readonly GearType[] = ['grinder', 'brewer', 'kettle', 'scale', 'filter', 'other']

// ---------- สต็อกเมล็ด ----------

/** ปริมาณกาแฟอ้างอิงสำหรับแสดง "ต้นทุนต่อแก้ว" ในรายการเมล็ด (V60 ตั้งต้น = 15 g) */
export const REFERENCE_DOSE_G = 15

/** เหลือไม่เกินสัดส่วนนี้ของถุง (หรือ LOW_STOCK_MIN_G) ถือว่า "ใกล้หมด" */
export const LOW_STOCK_RATIO = 0.2
export const LOW_STOCK_MIN_G = 30

/** คงเหลือสำหรับแสดงผล — `remainingG` ติดลบได้ในฐานข้อมูล แต่ UI แสดงไม่ต่ำกว่า 0 */
export function remainingDisplayG(bean: Pick<Bean, 'remainingG'>): number {
  return Math.max(0, bean.remainingG)
}

/** สัดส่วนที่เหลือ 0..1 (ใช้วาดแถบ) — น้ำหนักถุงไม่ถูกต้องคืน 0 */
export function remainingFraction(bean: Pick<Bean, 'remainingG' | 'weightG'>): number {
  if (!(bean.weightG > 0)) return 0
  return Math.min(1, remainingDisplayG(bean) / bean.weightG)
}

export type StockLevel = 'empty' | 'low' | 'ok'

export function stockLevel(bean: Pick<Bean, 'remainingG' | 'weightG'>): StockLevel {
  const left = remainingDisplayG(bean)
  if (left <= 0) return 'empty'
  if (left <= LOW_STOCK_MIN_G || remainingFraction(bean) <= LOW_STOCK_RATIO) return 'low'
  return 'ok'
}

/** ชงได้อีกกี่แก้วที่ปริมาณ `doseG` (ปัดลง) */
export function cupsRemaining(bean: Pick<Bean, 'remainingG'>, doseG: number = REFERENCE_DOSE_G): number {
  if (!(doseG > 0)) return 0
  return Math.floor(remainingDisplayG(bean) / doseG)
}

// ---------- เครื่องบด ----------

/** ตรวจสเกลเบอร์บด: min < max, step > 0 และ step ไม่เกินช่วงทั้งหมด */
export function isValidGrindScale(scale: { min: number; max: number; step: number }): boolean {
  const { min, max, step } = scale
  return [min, max, step].every(Number.isFinite) && min < max && step > 0 && step <= max - min
}
