import { GEAR_TYPES } from '../inventory'
import type { GearType, Method } from '../types'
import { ORIGINS, VARIETIES } from './beans'
import { GEAR_MODELS } from './gear'
import type { GearModel, GrindGuide, OriginRef, VarietyRef } from './types'

/**
 * ค้นหา/อ่านฐานข้อมูลอ้างอิง — Pure functions
 *
 * การค้นหาทนต่อการพิมพ์ต่างแบบ: ตัวพิมพ์เล็ก-ใหญ่, ช่องว่าง, ขีด, จุด, วรรณยุกต์ของอักษรละติน
 * เช่น "df 64" = "DF-64" = "df64" และ "specialita" เจอ "Specialità"
 */

/** ตัดวรรณยุกต์ละติน + ตัวพิมพ์เล็ก (คงอักษรไทยไว้ — ไม่ใช้ NFKD กับไทยเพราะสระ/วรรณยุกต์ไทยเป็นส่วนของคำ) */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
}

/** ตัดทุกอย่างที่ไม่ใช่ตัวอักษร/เครื่องหมายประกอบ (สระ-วรรณยุกต์ไทย)/ตัวเลข → ใช้เทียบแบบ "ติดกัน" */
export function compact(text: string): string {
  return fold(text).replace(/[^\p{L}\p{M}\p{N}]+/gu, '')
}

/** แยกคำค้นเป็นคำย่อย (แบบติดกันแล้ว) — คำว่างถูกทิ้ง */
function tokens(query: string): string[] {
  return fold(query)
    .split(/[\s,/]+/)
    .map(compact)
    .filter(Boolean)
}

const gearHaystack = new Map<string, string>(
  GEAR_MODELS.map((m) => [m.id, compact([m.brand, m.model, ...(m.aliases ?? [])].join(' '))]),
)

/** คะแนนความตรง (มาก = ตรงกว่า) หรือ 0 = ไม่ตรง */
function scoreGear(m: GearModel, query: string, qTokens: string[]): number {
  const hay = gearHaystack.get(m.id) ?? ''
  if (!qTokens.every((tok) => hay.includes(tok))) return 0
  const q = compact(query)
  const names = [m.model, `${m.brand} ${m.model}`, ...(m.aliases ?? [])].map(compact)
  if (names.includes(q)) return 4
  if (names.some((n) => n.startsWith(q))) return 3
  if (compact(m.brand).startsWith(q)) return 2
  return 1
}

const byTypeThenName = (a: GearModel, b: GearModel) =>
  GEAR_TYPES.indexOf(a.type) - GEAR_TYPES.indexOf(b.type) ||
  a.brand.localeCompare(b.brand) ||
  a.model.localeCompare(b.model)

export interface GearSearchOptions {
  /** กรองเฉพาะชนิด */
  type?: GearType
  /** จำนวนผลสูงสุด (ไม่ส่ง = ทั้งหมด) */
  limit?: number
}

/**
 * ค้นหารุ่นอุปกรณ์ — ทุกคำในคำค้นต้องพบใน ยี่ห้อ/รุ่น/ชื่ออื่น
 * คำค้นว่าง = รายการทั้งหมด (ของชนิดที่เลือก) เรียงตามชนิดและชื่อ
 */
export function searchGearModels(query: string, options: GearSearchOptions = {}): GearModel[] {
  const pool = options.type ? GEAR_MODELS.filter((m) => m.type === options.type) : [...GEAR_MODELS]
  const qTokens = tokens(query)
  const result =
    qTokens.length === 0
      ? pool.sort(byTypeThenName)
      : pool
          .map((m) => ({ m, score: scoreGear(m, query, qTokens) }))
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score || byTypeThenName(a.m, b.m))
          .map((r) => r.m)
  return options.limit === undefined ? result : result.slice(0, options.limit)
}

const gearById = new Map(GEAR_MODELS.map((m) => [m.id, m]))

export function getGearModel(id: string | undefined): GearModel | undefined {
  return id ? gearById.get(id) : undefined
}

/**
 * ชื่อแสดงผลของรุ่น — ถ้าชื่อรุ่นขึ้นต้นด้วยคำแรกของยี่ห้ออยู่แล้วจะไม่ซ้ำยี่ห้อ
 * เช่น Flair Espresso + "Flair 58 Plus 2" → "Flair 58 Plus 2", Niche + "Zero" → "Niche Zero"
 */
export function gearModelName(m: Pick<GearModel, 'brand' | 'model'>): string {
  const brandWord = compact(m.brand.split(/\s+/)[0] ?? '')
  const modelWord = compact(m.model.split(/\s+/)[0] ?? '')
  return brandWord && brandWord === modelWord ? m.model : `${m.brand} ${m.model}`
}

/** ช่วงเบอร์บดที่ผู้ผลิตแนะนำสำหรับวิธีชงนี้ (ไม่มี = undefined) */
export function grindGuideFor(m: GearModel | undefined, method: Method): GrindGuide | undefined {
  return m?.grindGuide?.find((g) => g.methods.includes(method))
}

/** ยี่ห้อทั้งหมดในฐานข้อมูล (ไม่ซ้ำ เรียงตามตัวอักษร) — ใช้เป็นคำแนะนำช่อง "ยี่ห้อ" */
export function catalogBrands(type?: GearType): string[] {
  const models = type ? GEAR_MODELS.filter((m) => m.type === type) : GEAR_MODELS
  return [...new Set(models.map((m) => m.brand))].sort((a, b) => a.localeCompare(b))
}

// ---------- สายพันธุ์ / แหล่งปลูก ----------

/** ค่าที่จะใส่ลงช่อง "แหล่งปลูก" ของเมล็ด (อังกฤษเสมอ → ข้อมูลไม่ขึ้นกับภาษา) */
export function originValue(o: OriginRef): string {
  return o.region ? `${o.countryName}, ${o.region}` : o.countryName
}

/** ชื่อแสดงผลภาษาท้องถิ่น (เฉพาะแหล่งที่มีชื่อไทย) */
export function originLocalLabel(o: OriginRef): string | undefined {
  return o.localRegion
}

export function getVariety(id: string): VarietyRef | undefined {
  return VARIETIES.find((v) => v.id === id)
}

export function getOrigin(id: string): OriginRef | undefined {
  return ORIGINS.find((o) => o.id === id)
}

/** หาสายพันธุ์จากข้อความที่ผู้ใช้กรอก (ชื่อสากล/ชื่อไทย/ชื่ออื่น) — ใช้แสดงแหล่งอ้างอิงใต้ช่อง */
export function findVariety(text: string): VarietyRef | undefined {
  const q = compact(text)
  if (!q) return undefined
  return VARIETIES.find((v) => [v.name, v.localName ?? '', ...(v.aliases ?? [])].some((n) => n && compact(n) === q))
}

/** หาแหล่งปลูกจากข้อความที่ผู้ใช้กรอก (ตรงทั้งค่า) */
export function findOrigin(text: string): OriginRef | undefined {
  const q = compact(text)
  if (!q) return undefined
  return ORIGINS.find((o) => compact(originValue(o)) === q || (o.localRegion && compact(`${o.localRegion}`) === q))
}
