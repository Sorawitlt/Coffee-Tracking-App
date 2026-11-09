import type { BackupCounts, BackupError, BackupTable } from '../../domain/backup'
import { tTh, type MessageKey, type TFunction } from '../../i18n'

/** ข้อความของไฟล์สำรอง — ข้อความอยู่ใน i18n (`backup.*`) ที่นี่ประกอบคีย์ + ค่าตัวแปร */

/** ข้อความที่ "ยังไม่แปล" — เก็บใน state ได้ แล้วแปลตอนแสดง (สลับภาษากลางทางแล้วข้อความตามภาษาใหม่) */
export type Message = (t: TFunction) => string

const TABLE_KEY: Record<BackupTable, MessageKey> = {
  beans: 'backup.table.beans',
  gear: 'backup.table.gear',
  recipes: 'backup.table.recipes',
  brews: 'backup.table.brews',
}

export function backupErrorText(error: BackupError, t: TFunction = tTh): string {
  switch (error.code) {
    case 'notJson':
      return t('backup.err.notJson')
    case 'notBackup':
      return t('backup.err.notBackup')
    case 'newerVersion':
      return t('backup.err.newerVersion')
    case 'missingTable':
      return t('backup.err.missingTable', { table: t(TABLE_KEY[error.table]) })
    case 'invalidRecord':
      return t('backup.err.invalidRecord', { table: t(TABLE_KEY[error.table]), n: error.index + 1, field: error.field })
    case 'duplicateId':
      return t('backup.err.duplicateId', { table: t(TABLE_KEY[error.table]) })
    case 'missingBean':
      return t('backup.err.missingBean')
  }
}

/** เช่น "3 เมล็ด · 1 อุปกรณ์ · 0 สูตรของฉัน · 42 บันทึกการชง" */
export function countsText(c: BackupCounts, t: TFunction = tTh): string {
  return t('backup.counts', { beans: c.beans, gear: c.gear, recipes: c.recipes, brews: c.brews })
}

/** เช่น "วันนี้", "3 วันที่แล้ว" */
export function daysAgoText(days: number, t: TFunction = tTh): string {
  return days <= 0 ? t('backup.today') : t('backup.daysAgo', { n: days })
}
