import type { Recipe } from '../domain/types'
import { db } from './db'

/** อ่านสูตรตาม ID — ไม่พบ = undefined (เช่น ยังไม่ได้ seed สูตรตั้งต้น) */
export function getRecipe(id: string): Promise<Recipe | undefined> {
  return db.recipes.get(id)
}
