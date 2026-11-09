/**
 * แท็กรสชาติ (PLAN ข้อ 3 โมดูล F) — อิง SCA Flavor Wheel แบบย่อ
 *
 * `Brew.flavorTags` เก็บเป็น "รหัส" (เช่น 'citrus') ไม่ใช่ข้อความ → แปลภาษาที่ UI (`features/labels.ts`)
 * รหัสที่ไม่รู้จัก (เช่น จาก Import ในอนาคต) ต้องไม่ถูกลบทิ้งเมื่อแก้ไขบันทึก
 */

export const FLAVOR_GROUPS = [
  { id: 'fruity', tags: ['berry', 'citrus', 'stoneFruit', 'tropical', 'driedFruit'] },
  { id: 'floral', tags: ['floral', 'tea'] },
  { id: 'sweet', tags: ['honey', 'caramel', 'brownSugar', 'vanilla'] },
  { id: 'nutty', tags: ['nutty', 'chocolate'] },
  { id: 'spice', tags: ['spice'] },
  { id: 'roasted', tags: ['toasty', 'smoky', 'burnt'] },
  { id: 'other', tags: ['woody', 'earthy', 'fermented', 'vegetal'] },
] as const

export type FlavorGroup = (typeof FLAVOR_GROUPS)[number]['id']
export type FlavorTag = (typeof FLAVOR_GROUPS)[number]['tags'][number]

export const FLAVOR_TAGS: readonly FlavorTag[] = FLAVOR_GROUPS.flatMap((g) => g.tags)

export function isFlavorTag(code: string): code is FlavorTag {
  return (FLAVOR_TAGS as readonly string[]).includes(code)
}

/** เปิด/ปิดแท็ก — ไม่แตะรหัสอื่นที่อยู่ในรายการ (รวมรหัสที่ไม่รู้จัก) และไม่เพิ่มซ้ำ */
export function toggleFlavorTag(tags: readonly string[], code: string): string[] {
  return tags.includes(code) ? tags.filter((t) => t !== code) : [...tags, code]
}
