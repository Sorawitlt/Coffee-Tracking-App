/**
 * เขียนไฟล์ CSV ที่เปิดใน Excel / Google Sheets ได้ถูกต้อง (PLAN ข้อ 3 โมดูล I) — Pure functions ไม่มี UI
 *
 * - UTF-8 + BOM → Excel ภาษาไทยอ่านเป็น UTF-8 ไม่เพี้ยน
 * - ขึ้นบรรทัดใหม่แบบ CRLF (มาตรฐาน RFC 4180)
 * - ป้องกัน CSV/Formula injection: ข้อความที่ขึ้นต้นด้วย = + - @ จะถูกนำหน้าด้วย ' เพื่อไม่ให้ Excel/Sheets
 *   ตีความเป็นสูตร (ตัวเลขไม่ถูกแตะ จึงไม่กระทบค่าติดลบ)
 */

export type CsvCell = string | number | boolean | null | undefined

export interface CsvColumn<T> {
  header: string
  value: (row: T) => CsvCell
}

export const CSV_BOM = '﻿'

const FORMULA_START = /^[=+\-@\t\r]/
const NEEDS_QUOTES = /[",\r\n]/

/** แปลงค่า 1 ช่องเป็นข้อความ CSV (ใส่เครื่องหมายคำพูดเมื่อจำเป็น) */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  const text = FORMULA_START.test(value) ? `'${value}` : value
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** สร้างไฟล์ CSV ทั้งไฟล์ (มี BOM นำหน้า, ปิดท้ายด้วยขึ้นบรรทัดใหม่) */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [
    columns.map((c) => csvCell(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(',')),
  ]
  return CSV_BOM + lines.join('\r\n') + '\r\n'
}
