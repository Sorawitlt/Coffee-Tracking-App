import Dexie, { type EntityTable } from 'dexie'
import type { Bean, Brew, Gear, Recipe, Settings } from '../domain/types'

/**
 * ฐานข้อมูล IndexedDB (Dexie) — Local-first
 *
 * ดัชนี (index) ใส่เฉพาะฟิลด์ที่ใช้ค้นหา/เรียงลำดับ
 * - ฟิลด์ boolean (archived, isBest) index ไม่ได้ใน IndexedDB → กรองในหน่วยความจำ (ข้อมูลส่วนตัวมีไม่มาก)
 * - เปลี่ยน schema ในอนาคต: เพิ่ม `db.version(n + 1)` ห้ามแก้ version เดิม
 */
export type BrewLogDB = Dexie & {
  beans: EntityTable<Bean, 'id'>
  gear: EntityTable<Gear, 'id'>
  recipes: EntityTable<Recipe, 'id'>
  brews: EntityTable<Brew, 'id'>
  settings: EntityTable<Settings, 'id'>
}

export const DB_NAME = 'brew-log'

export const db = new Dexie(DB_NAME) as BrewLogDB

db.version(1).stores({
  beans: 'id, name, roaster, roastDate, category, updatedAt',
  gear: 'id, type, updatedAt',
  recipes: 'id, method, category, updatedAt',
  brews: 'id, brewedAt, beanId, method, recipeId, rating, updatedAt, [beanId+brewedAt], [method+brewedAt]',
  settings: 'id',
})
