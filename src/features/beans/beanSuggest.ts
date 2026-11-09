import { ORIGINS, VARIETIES, originValue } from '../../domain/catalog'
import type { Bean, Language } from '../../domain/types'

/**
 * คำแนะนำตอนกรอกฟอร์มเมล็ด (Pure) — ใช้กับ `<datalist>` จึงยังพิมพ์ค่าอื่นเองได้เสมอ
 * - ค่าที่ใส่ลงช่องเป็นภาษาอังกฤษ (ชื่อสากล) → ข้อมูล/CSV ไม่เปลี่ยนตามภาษา
 * - ภาษาไทยแสดงชื่อไทยเป็นป้ายช่วยอ่าน (เฉพาะรายการที่มีชื่อไทยทางการ)
 */

export interface SuggestOption {
  value: string
  label?: string
}

export function varietyOptions(lang: Language): SuggestOption[] {
  return VARIETIES.map((v) => ({ value: v.name, label: lang === 'th' ? v.localName : undefined }))
}

export function originOptions(lang: Language): SuggestOption[] {
  return ORIGINS.map((o) => ({ value: originValue(o), label: lang === 'th' ? o.localRegion : undefined }))
}

/**
 * โรงคั่วที่ผู้ใช้เคยกรอก (ไม่มีรายชื่อโรงคั่วในฐานข้อมูล — เปลี่ยนบ่อยเกินกว่าจะยืนยันได้)
 * ไม่ซ้ำแบบไม่สนตัวพิมพ์ (ใช้ตัวสะกดของครั้งล่าสุด) เรียงตามตัวอักษร
 */
export function roasterOptions(beans: readonly Pick<Bean, 'roaster' | 'updatedAt'>[]): SuggestOption[] {
  const latest = new Map<string, { name: string; at: string }>()
  for (const b of beans) {
    const name = b.roaster.trim()
    if (!name) continue
    const key = name.toLocaleLowerCase()
    const prev = latest.get(key)
    if (!prev || b.updatedAt > prev.at) latest.set(key, { name, at: b.updatedAt })
  }
  return [...latest.values()].map((x) => ({ value: x.name })).sort((a, b) => a.value.localeCompare(b.value))
}
