import type { BackupCounts, BackupError, BackupTable } from '../../domain/backup'

/** ข้อความภาษาไทยของไฟล์สำรอง (รวมไว้ที่เดียวเพื่อย้ายเข้า i18n ในขั้น 9 ได้ง่าย) */

const TABLE_LABEL: Record<BackupTable, string> = {
  beans: 'เมล็ด',
  gear: 'อุปกรณ์',
  recipes: 'สูตร',
  brews: 'บันทึกการชง',
}

export function backupErrorText(error: BackupError): string {
  switch (error.code) {
    case 'notJson':
      return 'อ่านไฟล์ไม่ได้ — ไม่ใช่ไฟล์ JSON หรือไฟล์เสียหาย'
    case 'notBackup':
      return 'ไฟล์นี้ไม่ใช่ไฟล์สำรองของ Brew Log (ต้องเป็นไฟล์ .json ที่สร้างจากปุ่ม "ดาวน์โหลดไฟล์สำรอง")'
    case 'newerVersion':
      return 'ไฟล์นี้สร้างจากแอปเวอร์ชันใหม่กว่า — กรุณาอัปเดตแอปก่อนนำกลับ'
    case 'missingTable':
      return `ไฟล์ไม่ครบ: ไม่พบข้อมูล${TABLE_LABEL[error.table]}`
    case 'invalidRecord':
      return `ข้อมูลในไฟล์ไม่ถูกต้อง: ${TABLE_LABEL[error.table]}รายการที่ ${error.index + 1} (ฟิลด์ ${error.field})`
    case 'duplicateId':
      return `ข้อมูลในไฟล์ไม่ถูกต้อง: ${TABLE_LABEL[error.table]}มีรหัสซ้ำกัน`
    case 'missingBean':
      return 'ข้อมูลในไฟล์ไม่ครบ: มีบันทึกการชงที่อ้างถึงเมล็ดซึ่งไม่อยู่ในไฟล์'
  }
}

/** เช่น "3 เมล็ด · 1 อุปกรณ์ · 0 สูตรของฉัน · 42 บันทึกการชง" */
export function countsText(c: BackupCounts): string {
  return `${c.beans} เมล็ด · ${c.gear} อุปกรณ์ · ${c.recipes} สูตรของฉัน · ${c.brews} บันทึกการชง`
}

/** เช่น "วันนี้", "3 วันที่แล้ว" */
export function daysAgoText(days: number): string {
  return days <= 0 ? 'วันนี้' : `${days} วันที่แล้ว`
}
