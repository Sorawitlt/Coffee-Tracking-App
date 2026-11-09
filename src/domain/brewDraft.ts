import { ratio } from './calc'
import { getDefaultRecipe } from './recipes'
import type { Bean, Brew, Method, Recipe } from './types'

/**
 * ตรรกะ "บันทึกการชงเร็ว" (PLAN ข้อ 4 — ค่าเริ่มต้นฉลาด, ปรับทีละ 1 ตัวแปร) — Pure functions ไม่มี UI
 *
 * - เติมค่าอัตโนมัติ: เลือกวิธีชง + เมล็ดแล้ว ค่าที่เหลือมาจากการชงครั้งล่าสุดทันที
 * - ไฮไลต์ค่าที่เปลี่ยน: เทียบกับการชงครั้งก่อน เพื่อให้เห็นว่าปรับอะไรไป
 */

/** ค่าที่เติมให้ฟอร์มอัตโนมัติ — ไม่รวม "เวลาชง/ผลชิม" เพราะเป็นผลลัพธ์ของการชงครั้งนั้น ๆ */
export interface BrewDraft {
  method: Method
  doseG: number
  waterG: number
  tempC?: number
  grindSetting?: number
  grinderId?: string
  brewerId?: string
  recipeId?: string
}

/** ที่มาของค่าที่เติม: เมล็ดและวิธีเดียวกัน → วิธีเดียวกัน (เมล็ดอื่น) → สูตรตั้งต้น */
export type DraftSource = 'sameBean' | 'sameMethod' | 'recipe'

export interface DraftResult {
  draft: BrewDraft
  source: DraftSource
  /** การชงที่ใช้เทียบ "ค่าที่เปลี่ยน" — ไม่มี = เติมจากสูตรตั้งต้น ไม่มีอะไรให้เทียบ */
  reference?: Brew
}

/** การชงล่าสุดตามเวลาที่ชง (เวลาเท่ากันใช้เวลาที่สร้างระเบียนตัดสิน) */
export function latestBrew<T extends Pick<Brew, 'brewedAt' | 'createdAt'>>(brews: readonly T[]): T | undefined {
  let best: T | undefined
  for (const b of brews) {
    if (!best || b.brewedAt > best.brewedAt || (b.brewedAt === best.brewedAt && b.createdAt > best.createdAt)) best = b
  }
  return best
}

/** แปลงการชงเดิมเป็นค่าเริ่มต้นของการชงใหม่ (ปุ่ม "ชงซ้ำ") */
export function draftFromBrew(brew: Brew): BrewDraft {
  return {
    method: brew.method,
    doseG: brew.doseG,
    waterG: brew.waterG,
    tempC: brew.tempC,
    grindSetting: brew.grindSetting,
    grinderId: brew.grinderId,
    brewerId: brew.brewerId,
    recipeId: brew.recipeId,
  }
}

export interface BuildDraftParams {
  method: Method
  beanId?: string
  /** ประวัติการชงทั้งหมด (ลำดับใดก็ได้) */
  brews: readonly Brew[]
  /** สูตรที่ใช้เมื่อไม่มีประวัติ — ไม่ส่ง = สูตรตั้งต้นของวิธีนั้น */
  recipe?: Recipe
}

export function buildDraft({ method, beanId, brews, recipe }: BuildDraftParams): DraftResult {
  const sameMethod = brews.filter((b) => b.method === method)
  const sameBean = beanId === undefined ? undefined : latestBrew(sameMethod.filter((b) => b.beanId === beanId))
  if (sameBean) return { draft: draftFromBrew(sameBean), source: 'sameBean', reference: sameBean }

  const lastOfMethod = latestBrew(sameMethod)
  if (lastOfMethod) return { draft: draftFromBrew(lastOfMethod), source: 'sameMethod', reference: lastOfMethod }

  const r = recipe ?? getDefaultRecipe(method)
  return {
    draft: { method, doseG: r.doseG, waterG: r.waterG, tempC: r.tempC, recipeId: r.id },
    source: 'recipe',
  }
}

/**
 * เมล็ดที่ควรเลือกให้ก่อน: เมล็ดของการชงล่าสุด (ถ้ายังไม่ Archive) ไม่งั้นเมล็ดแรกในรายการ
 * `activeBeans` ควรเรียงสดสุดก่อน (ตาม `listBeans`) และไม่รวมที่ Archive
 */
export function pickDefaultBeanId(activeBeans: readonly Bean[], brews: readonly Brew[]): string | undefined {
  const last = latestBrew(brews)
  if (last && activeBeans.some((b) => b.id === last.beanId)) return last.beanId
  return activeBeans[0]?.id
}

/** วิธีชงตั้งต้นของฟอร์ม: วิธีของการชงล่าสุด ไม่มีประวัติใช้ค่าจากการตั้งค่า */
export function pickDefaultMethod(brews: readonly Brew[], fallback: Method): Method {
  return latestBrew(brews)?.method ?? fallback
}

// ---------- ไฮไลต์ค่าที่เปลี่ยน ----------

/**
 * ตัวแปรที่ผู้ชงจงใจปรับเพื่อ dial-in (PLAN ข้อ 4: ปรับทีละ 1 ตัวแปร)
 * ไม่รวมเวลาชง เพราะเป็นผลลัพธ์ ไม่ใช่สิ่งที่ตั้งค่าได้
 */
export const DIAL_VARIABLES = ['doseG', 'waterG', 'grindSetting', 'tempC', 'grinderId'] as const
export type DialVariable = (typeof DIAL_VARIABLES)[number]

export type DialValues = Partial<Pick<Brew, DialVariable>>

const sameValue = (a: number | string | undefined, b: number | string | undefined): boolean =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b

/** ตัวแปรที่ต่างจากการชงอ้างอิง (ไม่มีค่า ↔ มีค่า ถือว่าต่าง) */
export function changedVariables(reference: DialValues, current: DialValues): DialVariable[] {
  return DIAL_VARIABLES.filter((k) => !sameValue(reference[k], current[k]))
}

/** อัตราส่วนต่างกันไม่เกินนี้ (สัดส่วน) ถือว่าเท่าเดิม */
const SAME_RATIO_TOLERANCE = 0.01

/**
 * จำนวน "ตัวแปรที่เปลี่ยน" ที่นับแบบคน: ถ้ากาแฟและน้ำเปลี่ยนพร้อมกันแต่อัตราส่วนเท่าเดิม
 * (เช่น ชงเพิ่มเป็น 2 เท่า) นับเป็นการปรับเดียว ไม่ใช่สอง
 */
export function dialInChangeCount(reference: DialValues, current: DialValues): number {
  const changed = changedVariables(reference, current)
  let n = changed.length
  if (changed.includes('doseG') && changed.includes('waterG')) {
    const r0 = ratio(reference.doseG ?? 0, reference.waterG ?? 0)
    const r1 = ratio(current.doseG ?? 0, current.waterG ?? 0)
    if (r0 !== undefined && r1 !== undefined && Math.abs(r1 - r0) / r0 <= SAME_RATIO_TOLERANCE) n -= 1
  }
  return n
}

/**
 * การชงก่อนหน้าของเมล็ด+วิธีเดียวกัน ที่ชงก่อน `before` — ใช้เป็นตัวเทียบตอนแก้ไขบันทึกเก่า
 * ไม่ส่ง `before` = ล่าสุดทั้งหมด
 */
export function findReferenceBrew(
  brews: readonly Brew[],
  target: { beanId: string; method: Method; before?: Pick<Brew, 'id' | 'brewedAt'> },
): Brew | undefined {
  const { beanId, method, before } = target
  return latestBrew(
    brews.filter(
      (b) =>
        b.beanId === beanId &&
        b.method === method &&
        (!before || (b.id !== before.id && b.brewedAt <= before.brewedAt)),
    ),
  )
}
