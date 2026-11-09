/**
 * ตัวช่วยแปลงค่าจากช่องฟอร์ม (string) — ใช้ร่วมกันทุกฟอร์ม
 */

/**
 * แปลงข้อความเป็นตัวเลข
 * - ว่าง → `undefined`
 * - รับ "," เป็นจุดทศนิยม (แป้นพิมพ์บางภาษา)
 * - ไม่ใช่ตัวเลข (รวม "1e3x", "abc", Infinity) → `NaN`
 */
export function parseNumber(text: string): number | undefined {
  const t = text.trim().replace(',', '.')
  if (t === '') return undefined
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(t)) return Number.NaN
  return Number(t)
}

/** แปลงตัวเลขกลับเป็นข้อความสำหรับใส่ช่องฟอร์ม (ไม่มีค่า → "") */
export function numberToText(n: number | undefined): string {
  return n === undefined || !Number.isFinite(n) ? '' : String(n)
}

/** ข้อความว่าง/ช่องว่างล้วน → `undefined` */
export function optionalText(text: string): string | undefined {
  const t = text.trim()
  return t === '' ? undefined : t
}
