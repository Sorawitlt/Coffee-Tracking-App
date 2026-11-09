import type { Category, GrindHint, Method } from './types'

/**
 * ข้อมูลเฉพาะของแต่ละวิธีชง (อ้างอิง docs/PLAN.md ข้อ 5)
 * ใช้ร่วมกันระหว่างสูตรคำนวณ, สูตรตั้งต้น และ Dial-in Advisor
 */
export interface MethodProfile {
  method: Method
  category: Category
  style: 'espresso' | 'percolation' | 'immersion' | 'moka' | 'coldBrew'
  /** ช่วงเป้าหมาย TDS/EY ตาม SCA (ไม่มี = ไม่มีมาตรฐานอ้างอิง) */
  targets?: 'filter' | 'espresso'
  /** อุณหภูมิน้ำแนะนำ — ไม่มี = ไม่เกี่ยวข้อง (Advisor จะไม่แนะนำปรับอุณหภูมิ) */
  tempRangeC?: readonly [number, number]
  /** เวลาชงแนะนำ (วินาที) */
  timeRangeSec: readonly [number, number]
  /** ขนาดการปรับเวลา 1 ครั้งที่ Advisor แนะนำ (วินาที) */
  timeStepSec: number
  /** ขนาดการปรับอัตราส่วน 1 ครั้ง (เช่น 1:16 → 1:15) */
  ratioStep: number
  /** ปรับความเข้มด้วยการเปลี่ยน "กาแฟ" (ค่าน้ำคงที่) หรือ "น้ำ" (ตะกร้ามีขนาดตายตัว) */
  ratioAdjusts: 'dose' | 'water'
  grindHint: GrindHint
}

export const METHOD_PROFILES: Record<Method, MethodProfile> = {
  espresso: {
    method: 'espresso',
    category: 'coffee',
    style: 'espresso',
    targets: 'espresso',
    tempRangeC: [92, 94],
    timeRangeSec: [25, 30],
    timeStepSec: 3,
    ratioStep: 0.25,
    ratioAdjusts: 'water',
    grindHint: 'veryFine',
  },
  v60: {
    method: 'v60',
    category: 'coffee',
    style: 'percolation',
    targets: 'filter',
    tempRangeC: [92, 96],
    timeRangeSec: [150, 210],
    timeStepSec: 15,
    ratioStep: 1,
    ratioAdjusts: 'dose',
    grindHint: 'mediumFine',
  },
  kalita: {
    method: 'kalita',
    category: 'coffee',
    style: 'percolation',
    targets: 'filter',
    tempRangeC: [92, 96],
    timeRangeSec: [180, 240],
    timeStepSec: 15,
    ratioStep: 1,
    ratioAdjusts: 'dose',
    grindHint: 'medium',
  },
  chemex: {
    method: 'chemex',
    category: 'coffee',
    style: 'percolation',
    targets: 'filter',
    tempRangeC: [93, 96],
    timeRangeSec: [240, 300],
    timeStepSec: 15,
    ratioStep: 1,
    ratioAdjusts: 'dose',
    grindHint: 'mediumCoarse',
  },
  aeropress: {
    method: 'aeropress',
    category: 'coffee',
    style: 'immersion',
    targets: 'filter',
    tempRangeC: [85, 92],
    timeRangeSec: [90, 150],
    timeStepSec: 15,
    ratioStep: 1,
    ratioAdjusts: 'dose',
    grindHint: 'mediumFine',
  },
  frenchPress: {
    method: 'frenchPress',
    category: 'coffee',
    style: 'immersion',
    targets: 'filter',
    tempRangeC: [93, 96],
    timeRangeSec: [240, 240],
    timeStepSec: 30,
    ratioStep: 1,
    ratioAdjusts: 'dose',
    grindHint: 'coarse',
  },
  moka: {
    method: 'moka',
    category: 'coffee',
    style: 'moka',
    timeRangeSec: [240, 360],
    timeStepSec: 30,
    ratioStep: 0.5,
    ratioAdjusts: 'water',
    grindHint: 'mediumFine',
  },
  coldBrew: {
    method: 'coldBrew',
    category: 'coffee',
    style: 'coldBrew',
    timeRangeSec: [12 * 3600, 18 * 3600],
    timeStepSec: 2 * 3600,
    ratioStep: 1,
    ratioAdjusts: 'dose',
    grindHint: 'coarse',
  },
}

/** เกณฑ์เวลาไหลของ Espresso ที่ถือว่าผิดปกติ (PLAN ข้อ 5.3) */
export const ESPRESSO_FAST_SEC = 20
export const ESPRESSO_SLOW_SEC = 35
