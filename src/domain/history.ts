import type { Bean, Brew, ISODateTime, Method } from './types'

/**
 * ค้นหา/กรองประวัติการชง (PLAN ข้อ 3 โมดูล H) — Pure functions ไม่มี UI
 * ใช้ทั้งหน้า "บันทึก" และหน้า "สรุป" เพื่อให้ตัวเลขตรงกันทั้งแอป
 */

export interface BrewFilter {
  /** คำค้นหลายคำคั่นด้วยช่องว่าง — ต้องเจอ "ทุกคำ" (AND) ในข้อมูลของการชงนั้น ๆ */
  text?: string
  method?: Method
  beanId?: string
  /** คะแนนขั้นต่ำ — การชงที่ยังไม่ให้คะแนนจะถูกกรองออกเมื่อกำหนดค่านี้ */
  minRating?: number
  /** เฉพาะสูตรที่ดีที่สุด (ติดดาว) */
  bestOnly?: boolean
  /** ตั้งแต่เวลานี้ขึ้นไป (รวมเวลานั้น) */
  since?: ISODateTime
}

/** ป้ายข้อความสำหรับค้นหา — ฝั่ง UI ส่งป้ายภาษาไทยมาให้ เพื่อให้พิมพ์ "ซิตรัส" แล้วเจอแท็ก citrus */
export interface SearchLabels {
  method?: (method: Method) => string
  flavorTag?: (code: string) => string
}

const normalize = (s: string) => s.toLocaleLowerCase('th-TH').trim()

/** ข้อความรวมที่ใช้ค้นหาของการชง 1 ครั้ง (ตัวพิมพ์เล็ก) */
export function brewSearchText(brew: Brew, bean?: Bean, labels: SearchLabels = {}): string {
  const parts = [
    bean?.name, bean?.roaster, bean?.origin, bean?.variety,
    brew.method, labels.method?.(brew.method),
    brew.notes,
    ...brew.flavorTags,
    ...brew.flavorTags.map((t) => labels.flavorTag?.(t)),
  ]
  return normalize(parts.filter((p): p is string => typeof p === 'string' && p !== '').join(' '))
}

export function filterBrews(
  brews: readonly Brew[],
  filter: BrewFilter,
  beans: ReadonlyMap<string, Bean>,
  labels: SearchLabels = {},
): Brew[] {
  const terms = normalize(filter.text ?? '').split(/\s+/).filter(Boolean)
  return brews.filter((b) => {
    if (filter.method && b.method !== filter.method) return false
    if (filter.beanId && b.beanId !== filter.beanId) return false
    if (filter.minRating !== undefined && !(b.rating !== undefined && b.rating >= filter.minRating)) return false
    if (filter.bestOnly && !b.isBest) return false
    if (filter.since && b.brewedAt < filter.since) return false
    if (terms.length > 0) {
      const haystack = brewSearchText(b, beans.get(b.beanId), labels)
      if (!terms.every((t) => haystack.includes(t))) return false
    }
    return true
  })
}

/** มีตัวกรองที่ใช้อยู่ไหม (ใช้โชว์ปุ่ม "ล้างตัวกรอง") */
export function isFilterActive(filter: BrewFilter): boolean {
  return Boolean(
    (filter.text ?? '').trim() || filter.method || filter.beanId || filter.minRating !== undefined ||
      filter.bestOnly || filter.since,
  )
}

// ---------- ช่วงเวลา (preset) ----------

export type RangePreset = 'all' | '7d' | '30d' | '90d'

export const RANGE_PRESETS: readonly RangePreset[] = ['7d', '30d', '90d', 'all']

const DAY_MS = 86_400_000
const PRESET_DAYS: Record<Exclude<RangePreset, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 }

/** เวลาเริ่มของช่วง preset ("all" = ไม่จำกัด) */
export function rangeStart(preset: RangePreset, now: Date = new Date()): ISODateTime | undefined {
  if (preset === 'all') return undefined
  return new Date(now.getTime() - PRESET_DAYS[preset] * DAY_MS).toISOString()
}
