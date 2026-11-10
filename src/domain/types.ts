/**
 * โมเดลข้อมูลหลักของ Brew Log (ดู docs/PLAN.md ข้อ 6)
 *
 * กติกาทั่วไป
 * - ทุกตารางใช้ `id` เป็น UUID (string) → รองรับ Cloud sync ภายหลัง
 * - เวลา (`createdAt`, `updatedAt`, `brewedAt`) เก็บเป็น ISO 8601 UTC เช่น "2026-11-09T06:30:00.000Z"
 * - วันที่ล้วน (`roastDate`) เก็บเป็น "YYYY-MM-DD" ตามเวลาท้องถิ่นของผู้ใช้
 * - น้ำหนักเป็นกรัม (g), อุณหภูมิเป็น °C, เวลาเป็นวินาที — การแปลงหน่วยทำที่ชั้น UI เท่านั้น
 * - ค่าที่คำนวณได้ (ratio, EY, วันหลังคั่ว, ต้นทุนต่อแก้ว) ไม่เก็บซ้ำ → ใช้ `domain/calc.ts`
 */

export type ISODateTime = string
/** "YYYY-MM-DD" */
export type LocalDate = string

export type Category = 'coffee' | 'tea' | 'other'

export const METHODS = [
  'espresso',
  'v60',
  'kalita',
  'chemex',
  'aeropress',
  'frenchPress',
  'moka',
  'coldBrew',
] as const
export type Method = (typeof METHODS)[number]

export type BeanProcess = 'washed' | 'natural' | 'honey' | 'anaerobic' | 'other'
export type RoastLevel = 'light' | 'mediumLight' | 'medium' | 'mediumDark' | 'dark'
export type GrindHint = 'veryFine' | 'fine' | 'mediumFine' | 'medium' | 'mediumCoarse' | 'coarse'

export interface Timestamps {
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface Bean extends Timestamps {
  id: string
  name: string
  roaster: string
  origin: string
  variety?: string
  process?: BeanProcess
  roastLevel: RoastLevel
  roastDate: LocalDate
  /** น้ำหนักถุงตอนซื้อ (g) */
  weightG: number
  /** คงเหลือ (g) — หักอัตโนมัติเมื่อบันทึกการชง; อาจติดลบได้ถ้าชงเกินที่บันทึกไว้ (UI ให้แสดงเป็น 0) */
  remainingG: number
  /** ราคาทั้งถุง */
  priceTotal?: number
  /** ISO 4217 เช่น "THB" */
  currency?: string
  category: Category
  notes?: string
  archived: boolean
}

export type GearType = 'grinder' | 'brewer' | 'kettle' | 'scale' | 'filter' | 'other'

/** สเกลเบอร์บด — ถือว่า "เลขน้อย = ละเอียด" (เป็นแบบที่เครื่องบดส่วนใหญ่ใช้) */
export interface GrindScale {
  min: number
  max: number
  step: number
}

export interface Gear extends Timestamps {
  id: string
  type: GearType
  /** ชื่อที่แสดงในแอป (ตั้งเองได้ เช่น "DF64 ที่บ้าน") */
  name: string
  /** ยี่ห้อ เช่น "DF Grinders" */
  brand?: string
  /** รุ่น เช่น "DF64 Gen 2" */
  model?: string
  /**
   * รหัสรุ่นในฐานข้อมูลอ้างอิง (`domain/catalog`) — ใช้แสดงสเปก/แหล่งอ้างอิง/ช่วงเบอร์บดที่ผู้ผลิตแนะนำ
   * ยี่ห้อ/รุ่นถูกคัดลอกมาเก็บที่ `brand`/`model` ด้วย → ข้อมูลยังครบแม้ฐานข้อมูลเวอร์ชันหน้าเปลี่ยนไป
   */
  catalogId?: string
  /** ใช้กับ type = 'grinder' */
  grindScale?: GrindScale
  notes?: string
}

export type StepAction =
  | 'bloom'
  | 'pour'
  | 'stir'
  | 'swirl'
  | 'steep'
  | 'press'
  | 'extract'
  | 'drawdown'
  | 'heat'
  | 'removeFromHeat'
  | 'filter'
  | 'custom'

export interface RecipeStep {
  /** เริ่มขั้นนี้ที่วินาทีที่เท่าไรนับจากเริ่มชง */
  atSec: number
  action: StepAction
  /** น้ำหนักน้ำสะสมเป้าหมายบนตาชั่ง (g) เมื่อจบขั้นนี้ */
  targetWaterG?: number
  /** ข้อความอิสระสำหรับสูตรของผู้ใช้ (สูตรตั้งต้นใช้ `action` แปลผ่าน i18n) */
  label?: string
}

export interface Recipe extends Timestamps {
  id: string
  name: string
  method: Method
  category: Category
  /** สูตรตั้งต้นของแอป (แก้ไขไม่ได้ — ให้ทำสำเนาแทน) */
  isDefault: boolean
  doseG: number
  /** น้ำที่ใช้ชง (g) — สำหรับ Espresso คือน้ำหนักช็อตเป้าหมาย */
  waterG: number
  /** ไม่ระบุ = ไม่เกี่ยวข้อง (เช่น Cold brew, Moka pot บนเตา) */
  tempC?: number
  grindHint: GrindHint
  /** เวลาชงเป้าหมาย (วินาที) */
  totalTimeSec: number
  steps: RecipeStep[]
}

/** สไลเดอร์ −2..+2 (จำนวนเต็ม) */
export type Scale5 = -2 | -1 | 0 | 1 | 2
export type Rating = 1 | 2 | 3 | 4 | 5

export interface Brew extends Timestamps {
  id: string
  brewedAt: ISODateTime
  method: Method
  beanId: string
  recipeId?: string
  grinderId?: string
  brewerId?: string
  doseG: number
  /** น้ำที่ใช้ชง (g) — สำหรับ Espresso คือน้ำหนักช็อต (beverage) */
  waterG: number
  /** น้ำหนักเครื่องดื่มที่ชั่งได้จริง (g) — ไม่ระบุ = ประมาณจากสูตร */
  yieldG?: number
  grindSetting?: number
  tempC?: number
  bloomSec?: number
  totalTimeSec?: number
  /** % TDS จาก Refractometer (ตัวเลือก) */
  tds?: number

  // --- ผลชิม (Tasting) ---
  rating?: Rating
  /** สมดุลรสชาติ: −2 = เปรี้ยวแหลม … 0 = สมดุล … +2 = ขม/ฝาด */
  balance?: Scale5
  /** ความเข้ม/บอดี้: −2 = บาง/จืด … 0 = พอดี … +2 = หนัก/เข้มเกิน */
  body?: Scale5
  /** ความหวาน 0..4 */
  sweetness?: 0 | 1 | 2 | 3 | 4
  /** รู้สึกทั้งเปรี้ยวและขมพร้อมกัน (สัญญาณสกัดไม่สม่ำเสมอ) */
  sourAndBitter?: boolean
  flavorTags: string[]
  notes?: string
  /** สูตรที่ดีที่สุดของเมล็ดนี้ */
  isBest: boolean
  /** คำแนะนำที่แสดงหลังบันทึก (snapshot ณ ตอนนั้น) */
  advice?: Advice
}

export type Units = 'metric' | 'imperial'
export type Theme = 'system' | 'light' | 'dark'
export type Language = 'th' | 'en'

export interface Settings {
  /** singleton key */
  id: 'app'
  language: Language
  units: Units
  theme: Theme
  lastBackupAt?: ISODateTime
  defaultMethod: Method
}

// --- Dial-in Advisor ---

export type AdviceKind =
  /** Espresso ไหลเร็ว < 20 s */
  | 'espressoFast'
  /** Espresso ไหลช้า > 35 s */
  | 'espressoSlow'
  /** สกัดไม่สม่ำเสมอ (Channeling) */
  | 'uneven'
  /** สกัดน้อยไป */
  | 'underExtracted'
  /** สกัดมากไป */
  | 'overExtracted'
  /** เข้มน้อยไป */
  | 'tooWeak'
  /** เข้มมากไป */
  | 'tooStrong'
  /** อร่อยแล้ว → ควรบันทึกเป็นสูตรที่ดีที่สุด */
  | 'best'
  /** รสสมดุลแต่ยังไม่ถึง 4 ดาว → คงสูตรไว้ ลองเปลี่ยนเมล็ด/สูตรทีละอย่าง */
  | 'balanced'
  /** ยังไม่มีผลชิมพอจะวินิจฉัย */
  | 'needTasting'

export type Adjustment =
  | { variable: 'grind'; direction: 'finer' | 'coarser'; steps: number; from?: number; to?: number }
  | { variable: 'ratio'; from: number; to: number; doseG: number; waterG: number }
  | { variable: 'temp'; deltaC: number; from?: number; to?: number }
  | { variable: 'time'; deltaSec: number; from?: number; to?: number }
  | { variable: 'technique' }

export type AdviceNote = 'beanTooFresh' | 'beanStale'

export interface Advice {
  kind: AdviceKind
  /** การปรับหลัก "1 อย่าง" สำหรับครั้งหน้า (ไม่มี = คงสูตรเดิม) */
  adjustment?: Adjustment
  /** ทางเลือกสำรองเรียงตามลำดับความสำคัญ */
  alternatives: Adjustment[]
  notes: AdviceNote[]
}
