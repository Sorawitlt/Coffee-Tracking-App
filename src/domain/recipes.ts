import { METHOD_PROFILES } from './methods'
import type { Method, Recipe, RecipeStep } from './types'

/**
 * สูตรตั้งต้น 8 แบบ (PLAN ข้อ 5.1)
 *
 * - ใช้ ID คงที่ `default-<method>` → seed ซ้ำได้โดยไม่เกิดข้อมูลซ้ำ และตรงกันทุกอุปกรณ์เมื่อทำ sync
 * - สูตรตั้งต้นแก้ไขไม่ได้ ผู้ใช้ต้อง "ทำสำเนา" เป็นสูตรของตัวเอง
 * - `targetWaterG` ในแต่ละขั้น = น้ำหนักสะสมบนตาชั่ง
 */

/** เวลาคงที่ของสูตรตั้งต้น — ไม่ใช้ "ตอนนี้" เพื่อให้ seed ซ้ำแล้วได้ข้อมูลเหมือนเดิมทุกครั้ง */
const DEFAULTS_TIMESTAMP = '2026-11-09T00:00:00.000Z'

export const defaultRecipeId = (method: Method): string => `default-${method}`

type DefaultSpec = Pick<Recipe, 'doseG' | 'waterG' | 'tempC' | 'totalTimeSec'> & {
  name: string
  steps: RecipeStep[]
}

const SPECS: Record<Method, DefaultSpec> = {
  // 1 : 2 · 18 g → 36 g · 92–94 °C · 25–30 s
  espresso: {
    name: 'Espresso',
    doseG: 18,
    waterG: 36,
    tempC: 93,
    totalTimeSec: 28,
    steps: [{ atSec: 0, action: 'extract', targetWaterG: 36 }],
  },
  // 1 : 16 · 15 g : 240 g · 92–96 °C · 2:30–3:30
  v60: {
    name: 'V60',
    doseG: 15,
    waterG: 240,
    tempC: 94,
    totalTimeSec: 180,
    steps: [
      { atSec: 0, action: 'bloom', targetWaterG: 45 },
      { atSec: 45, action: 'pour', targetWaterG: 150 },
      { atSec: 75, action: 'pour', targetWaterG: 240 },
      { atSec: 105, action: 'drawdown' },
    ],
  },
  // 1 : 16 · 20 g : 320 g · 92–96 °C · 3:00–4:00
  kalita: {
    name: 'Kalita Wave',
    doseG: 20,
    waterG: 320,
    tempC: 94,
    totalTimeSec: 210,
    steps: [
      { atSec: 0, action: 'bloom', targetWaterG: 60 },
      { atSec: 45, action: 'pour', targetWaterG: 140 },
      { atSec: 75, action: 'pour', targetWaterG: 200 },
      { atSec: 105, action: 'pour', targetWaterG: 260 },
      { atSec: 135, action: 'pour', targetWaterG: 320 },
      { atSec: 165, action: 'drawdown' },
    ],
  },
  // 1 : 16 · 30 g : 480 g · 93–96 °C · 4:00–5:00
  chemex: {
    name: 'Chemex',
    doseG: 30,
    waterG: 480,
    tempC: 95,
    totalTimeSec: 270,
    steps: [
      { atSec: 0, action: 'bloom', targetWaterG: 90 },
      { atSec: 45, action: 'pour', targetWaterG: 240 },
      { atSec: 90, action: 'pour', targetWaterG: 360 },
      { atSec: 135, action: 'pour', targetWaterG: 480 },
      { atSec: 180, action: 'drawdown' },
    ],
  },
  // 1 : 15 · 15 g : 225 g · 85–92 °C · 1:30–2:30
  aeropress: {
    name: 'AeroPress',
    doseG: 15,
    waterG: 225,
    tempC: 88,
    totalTimeSec: 120,
    steps: [
      { atSec: 0, action: 'pour', targetWaterG: 225 },
      { atSec: 10, action: 'stir' },
      { atSec: 15, action: 'steep' },
      { atSec: 90, action: 'press' },
    ],
  },
  // 1 : 15 · 30 g : 450 g · 93–96 °C · 4:00 (+ พัก)
  frenchPress: {
    name: 'French Press',
    doseG: 30,
    waterG: 450,
    tempC: 95,
    totalTimeSec: 240,
    steps: [
      { atSec: 0, action: 'pour', targetWaterG: 450 },
      { atSec: 10, action: 'steep' },
      { atSec: 220, action: 'stir' },
      { atSec: 240, action: 'press' },
    ],
  },
  // ~1 : 7–10 · ผงเต็มตะกร้า น้ำถึงวาล์ว (ขนาด 3 ถ้วย) · เริ่มด้วยน้ำร้อนจัด · 4–6 นาที
  moka: {
    name: 'Moka Pot',
    doseG: 17,
    waterG: 150,
    totalTimeSec: 300,
    steps: [
      { atSec: 0, action: 'heat' },
      { atSec: 270, action: 'removeFromHeat' },
    ],
  },
  // 1 : 8 (หัวเชื้อ) · 100 g : 800 g · น้ำเย็น/อุณหภูมิห้อง · 12–18 ชม. ในตู้เย็น
  coldBrew: {
    name: 'Cold Brew',
    doseG: 100,
    waterG: 800,
    totalTimeSec: 15 * 3600,
    steps: [
      { atSec: 0, action: 'pour', targetWaterG: 800 },
      { atSec: 30, action: 'stir' },
      { atSec: 60, action: 'steep' },
      { atSec: 15 * 3600, action: 'filter' },
    ],
  },
}

function buildDefault(method: Method): Recipe {
  const spec = SPECS[method]
  const profile = METHOD_PROFILES[method]
  return {
    id: defaultRecipeId(method),
    method,
    category: profile.category,
    isDefault: true,
    grindHint: profile.grindHint,
    createdAt: DEFAULTS_TIMESTAMP,
    updatedAt: DEFAULTS_TIMESTAMP,
    ...spec,
  }
}

export const DEFAULT_RECIPES: readonly Recipe[] = (Object.keys(SPECS) as Method[]).map(buildDefault)

export function getDefaultRecipe(method: Method): Recipe {
  return buildDefault(method)
}

