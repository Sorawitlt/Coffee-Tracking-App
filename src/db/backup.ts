import { backupCounts, buildBackup, type BackupCounts, type BackupFile, type ParsedBackup } from '../domain/backup'
import { nowIso } from '../domain/id'
import { DEFAULT_RECIPES } from '../domain/recipes'
import type { Bean, Brew, Gear, ISODateTime } from '../domain/types'
import { db } from './db'
import { DEFAULT_SETTINGS, getSettings, updateSettings } from './settings'
import { stripUndefined } from './util'

/**
 * Backup / Restore ระดับฐานข้อมูล (ตรรกะตรวจไฟล์อยู่ที่ `domain/backup.ts`)
 * - อ่านทุกตารางใน Transaction เดียว → ไฟล์สำรองเป็นภาพ ณ เวลาเดียวกัน ไม่เหลื่อมกันระหว่างตาราง
 * - Restore ทั้งหมดอยู่ใน Transaction เดียว → ล้มเหลวกลางทางแล้วข้อมูลเดิมยังอยู่ครบ
 */

/** ข้อมูลทั้งหมดที่ใช้สร้างไฟล์ CSV */
export async function readTables(): Promise<{ beans: Bean[]; gear: Gear[]; brews: Brew[] }> {
  return db.transaction('r', [db.beans, db.gear, db.brews], async () => ({
    beans: await db.beans.toArray(),
    gear: await db.gear.toArray(),
    brews: await db.brews.toArray(),
  }))
}

/** สร้างไฟล์สำรอง (ยังไม่ถือว่า "สำรองแล้ว" จนกว่าจะเรียก `markBackedUp`) */
export async function createBackup(exportedAt: ISODateTime = nowIso()): Promise<BackupFile> {
  const source = await db.transaction('r', [db.beans, db.gear, db.recipes, db.brews, db.settings], async () => ({
    beans: await db.beans.toArray(),
    gear: await db.gear.toArray(),
    recipes: await db.recipes.toArray(),
    brews: await db.brews.toArray(),
    settings: await getSettings(),
  }))
  return buildBackup(source, exportedAt)
}

/** บันทึกว่าสำรองข้อมูลแล้ว (ใช้คำนวณการเตือน) */
export async function markBackedUp(at: ISODateTime = nowIso()): Promise<void> {
  await updateSettings({ lastBackupAt: at })
}

/** จำนวนข้อมูลของผู้ใช้ในเครื่องตอนนี้ (สูตรตั้งต้นไม่นับ) */
export async function countData(): Promise<BackupCounts> {
  return db.transaction('r', [db.beans, db.gear, db.recipes, db.brews], async () => ({
    beans: await db.beans.count(),
    gear: await db.gear.count(),
    recipes: await db.recipes.filter((r) => !r.isDefault).count(),
    brews: await db.brews.count(),
  }))
}

/**
 * แทนที่ข้อมูลทั้งหมดในเครื่องด้วยข้อมูลจากไฟล์สำรอง (ข้อมูลเดิมหายทั้งหมด)
 * - ยอดคงเหลือเมล็ดใช้ตามไฟล์ตรง ๆ ไม่คำนวณจากประวัติการชงใหม่
 * - สูตรตั้งต้นถูก seed ใหม่เป็นเวอร์ชันของแอป; การตั้งค่าที่ไฟล์ไม่มีใช้ค่าเริ่มต้น
 * - `lastBackupAt` ของเครื่องนี้คงเดิม (Restore ไม่ใช่การสำรอง)
 */
export async function restoreBackup(backup: ParsedBackup): Promise<BackupCounts> {
  await db.transaction('rw', [db.beans, db.gear, db.recipes, db.brews, db.settings], async () => {
    const { lastBackupAt } = await getSettings()
    await Promise.all([db.beans.clear(), db.gear.clear(), db.recipes.clear(), db.brews.clear()])
    await db.beans.bulkAdd(backup.beans)
    await db.gear.bulkAdd(backup.gear)
    // สูตรตั้งต้นใส่ทีหลังเสมอ — ถ้ารหัสสูตรของผู้ใช้ในไฟล์ชนกับสูตรตั้งต้น สูตรตั้งต้นของแอปชนะ
    await db.recipes.bulkPut([...backup.recipes, ...DEFAULT_RECIPES])
    await db.brews.bulkAdd(backup.brews)
    await db.settings.put(stripUndefined({ ...DEFAULT_SETTINGS, ...backup.settings, lastBackupAt, id: 'app' as const }))
  })
  return backupCounts(backup)
}
