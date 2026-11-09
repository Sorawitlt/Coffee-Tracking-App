import { BEAN_PROCESSES, GEAR_TYPES, ROAST_LEVELS } from './inventory'
import {
  METHODS,
  type Adjustment,
  type Advice,
  type AdviceKind,
  type Bean,
  type Brew,
  type Category,
  type Gear,
  type GrindHint,
  type ISODateTime,
  type Language,
  type Recipe,
  type Settings,
  type StepAction,
  type Theme,
  type Units,
} from './types'

/**
 * Backup / Restore ด้วยไฟล์ JSON (PLAN ข้อ 3 โมดูล I) — Pure functions ไม่มี UI และไม่แตะฐานข้อมูล
 *
 * ไฟล์สำรองคือ "ข้อมูลทั้งหมดของผู้ใช้" ในรูปแบบเดียวกับ `types.ts` (ไม่ใช่ CSV ที่เป็นมุมมองสำหรับวิเคราะห์)
 * ตอน Restore ไฟล์ถูกตรวจทุกระเบียนก่อนแตะข้อมูลจริง — ไฟล์เสียหรือถูกแก้มือจะถูกปฏิเสธทั้งไฟล์
 * ไม่มีการนำเข้าครึ่ง ๆ กลาง ๆ
 *
 * กติกา
 * - สูตรตั้งต้น (`isDefault`) ไม่อยู่ในไฟล์ — แอป seed ใหม่ทุกครั้งที่เปิด จึงได้เวอร์ชันล่าสุดเสมอ
 * - `lastBackupAt` ไม่อยู่ในไฟล์ — เป็นสถานะของเครื่องนี้ ไม่ใช่ข้อมูลของผู้ใช้
 * - `formatVersion` ของไฟล์ใหม่กว่าที่แอปรู้จัก = ปฏิเสธ (กันนำเข้าข้อมูลที่อ่านไม่ครบ)
 * - ฟิลด์ที่ไม่รู้จักถูกทิ้ง; ฟิลด์ที่รู้จักแต่ผิดชนิด/ผิดช่วงค่า = ปฏิเสธทั้งไฟล์
 * - คำแนะนำ (`Brew.advice`) เป็นแค่ snapshot — ถ้ารูปแบบผิดจะถูกทิ้งเงียบ ๆ แทนที่จะปฏิเสธทั้งไฟล์
 */

export const BACKUP_APP = 'brew-log'
export const BACKUP_FORMAT_VERSION = 1

export type BackupTable = 'beans' | 'gear' | 'recipes' | 'brews'

/** ค่าตั้งที่ย้ายตามไฟล์ได้ (ไม่รวม `id` และ `lastBackupAt`) */
export type PortableSettings = Omit<Settings, 'id' | 'lastBackupAt'>

export interface BackupFile {
  app: typeof BACKUP_APP
  formatVersion: number
  exportedAt: ISODateTime
  data: {
    beans: Bean[]
    gear: Gear[]
    /** เฉพาะสูตรของผู้ใช้ */
    recipes: Recipe[]
    brews: Brew[]
    settings: PortableSettings
  }
}

export interface BackupSource {
  beans: readonly Bean[]
  gear: readonly Gear[]
  recipes: readonly Recipe[]
  brews: readonly Brew[]
  settings: Settings
}

export interface BackupCounts {
  beans: number
  gear: number
  recipes: number
  brews: number
}

export function buildBackup(source: BackupSource, exportedAt: ISODateTime): BackupFile {
  const { language, units, theme, defaultMethod } = source.settings
  return {
    app: BACKUP_APP,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt,
    data: {
      beans: [...source.beans],
      gear: [...source.gear],
      recipes: source.recipes.filter((r) => !r.isDefault),
      brews: [...source.brews],
      settings: { language, units, theme, defaultMethod },
    },
  }
}

export function backupCounts(data: { beans: readonly unknown[]; gear: readonly unknown[]; recipes: readonly unknown[]; brews: readonly unknown[] }): BackupCounts {
  return { beans: data.beans.length, gear: data.gear.length, recipes: data.recipes.length, brews: data.brews.length }
}

// ---------- ผลการอ่านไฟล์ ----------

/** ข้อผิดพลาดเป็น "รหัส" ไม่ใช่ข้อความ → UI แปลภาษาเอง */
export type BackupError =
  | { code: 'notJson' }
  | { code: 'notBackup' }
  | { code: 'newerVersion'; version: number }
  | { code: 'missingTable'; table: BackupTable }
  /** ระเบียนลำดับที่ `index` (เริ่มที่ 0) ของตาราง `table` มีฟิลด์ `field` ไม่ถูกต้อง */
  | { code: 'invalidRecord'; table: BackupTable; index: number; field: string }
  | { code: 'duplicateId'; table: BackupTable; id: string }
  /** มีบันทึกการชงอ้างถึงเมล็ดที่ไม่มีในไฟล์ */
  | { code: 'missingBean'; beanId: string }

export interface ParsedBackup {
  exportedAt: ISODateTime
  beans: Bean[]
  gear: Gear[]
  /** เฉพาะสูตรของผู้ใช้ (สูตรตั้งต้นในไฟล์ถูกข้าม) */
  recipes: Recipe[]
  brews: Brew[]
  settings: Partial<PortableSettings>
}

export type BackupParseResult = { ok: true; backup: ParsedBackup } | { ok: false; error: BackupError }

// ---------- ตัวตรวจฟิลด์ ----------

interface Check {
  test: (v: unknown) => boolean
  /** ไม่มีค่า (หรือ null) ได้ */
  optional?: boolean
  /** แปลงค่าที่ผ่านการตรวจแล้ว (เช่น ตัดคีย์เกิน) — คืน undefined = ทิ้งฟิลด์นี้ */
  normalize?: (v: unknown) => unknown
}

type Schema<T> = { readonly [K in keyof T]-?: Check }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

const optional = (c: Check): Check => ({ ...c, optional: true })

const str: Check = { test: isStr }
const id: Check = { test: (v) => isStr(v) && v.length > 0 }
const num: Check = { test: isNum }
const nonNeg: Check = { test: (v) => isNum(v) && v >= 0 }
const pos: Check = { test: (v) => isNum(v) && v > 0 }
const bool: Check = { test: (v) => typeof v === 'boolean' }
const int = (min: number, max: number): Check => ({ test: (v) => isNum(v) && Number.isInteger(v) && v >= min && v <= max })
const iso: Check = { test: (v) => isStr(v) && !Number.isNaN(Date.parse(v)) }
const strArray: Check = { test: (v) => Array.isArray(v) && v.every(isStr) }
const oneOf = (values: readonly string[]): Check => ({ test: (v) => isStr(v) && values.includes(v) })

const localDate: Check = {
  test: (v) => {
    const m = isStr(v) ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null
    if (!m) return false
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const date = new Date(Date.UTC(y, mo - 1, d))
    return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
  },
}

/** สร้างรายการค่าที่ยอมรับจาก Record — ถ้าเพิ่มค่าใน type แล้วลืมใส่ที่นี่ TypeScript จะแจ้ง error */
const keysOf = <T extends string>(m: Record<T, true>): T[] => Object.keys(m) as T[]

const CATEGORIES = keysOf<Category>({ coffee: true, tea: true, other: true })
const GRIND_HINTS = keysOf<GrindHint>({ veryFine: true, fine: true, mediumFine: true, medium: true, mediumCoarse: true, coarse: true })
const STEP_ACTIONS = keysOf<StepAction>({
  bloom: true, pour: true, stir: true, swirl: true, steep: true, press: true,
  extract: true, drawdown: true, heat: true, removeFromHeat: true, filter: true, custom: true,
})
const ADVICE_KINDS = keysOf<AdviceKind>({
  espressoFast: true, espressoSlow: true, uneven: true, underExtracted: true, overExtracted: true,
  tooWeak: true, tooStrong: true, best: true, balanced: true, needTasting: true,
})
const ADVICE_NOTES = ['beanTooFresh', 'beanStale']
const LANGUAGES = keysOf<Language>({ th: true, en: true })
const UNITS = keysOf<Units>({ metric: true, imperial: true })
const THEMES = keysOf<Theme>({ system: true, light: true, dark: true })

const grindScale: Check = {
  test: (v) => isObj(v) && isNum(v.min) && isNum(v.max) && isNum(v.step),
  normalize: (v) => {
    const s = v as { min: number; max: number; step: number }
    return { min: s.min, max: s.max, step: s.step }
  },
}

const steps: Check = {
  test: (v) =>
    Array.isArray(v) &&
    v.every(
      (s) =>
        isObj(s) &&
        isNum(s.atSec) &&
        s.atSec >= 0 &&
        isStr(s.action) &&
        STEP_ACTIONS.includes(s.action as StepAction) &&
        (s.targetWaterG === undefined || s.targetWaterG === null || isNum(s.targetWaterG)) &&
        (s.label === undefined || s.label === null || isStr(s.label)),
    ),
  normalize: (v) =>
    (v as Record<string, unknown>[]).map((s) => ({
      atSec: s.atSec,
      action: s.action,
      ...(s.targetWaterG == null ? {} : { targetWaterG: s.targetWaterG }),
      ...(s.label == null ? {} : { label: s.label }),
    })),
}

const optNum = (v: unknown) => v === undefined || v === null || isNum(v)

function isAdjustment(v: unknown): v is Adjustment {
  if (!isObj(v)) return false
  switch (v.variable) {
    case 'grind':
      return (v.direction === 'finer' || v.direction === 'coarser') && isNum(v.steps) && optNum(v.from) && optNum(v.to)
    case 'ratio':
      return isNum(v.from) && isNum(v.to) && isNum(v.doseG) && isNum(v.waterG)
    case 'temp':
      return isNum(v.deltaC) && optNum(v.from) && optNum(v.to)
    case 'time':
      return isNum(v.deltaSec) && optNum(v.from) && optNum(v.to)
    case 'technique':
      return true
    default:
      return false
  }
}

function isAdvice(v: unknown): v is Advice {
  return (
    isObj(v) &&
    isStr(v.kind) &&
    ADVICE_KINDS.includes(v.kind as AdviceKind) &&
    (v.adjustment === undefined || isAdjustment(v.adjustment)) &&
    Array.isArray(v.alternatives) &&
    v.alternatives.every(isAdjustment) &&
    Array.isArray(v.notes) &&
    v.notes.every((n) => isStr(n) && ADVICE_NOTES.includes(n))
  )
}

/** คำแนะนำที่รูปแบบผิด = ทิ้ง ไม่ปฏิเสธทั้งไฟล์ (เป็นแค่ snapshot ที่คำนวณใหม่ได้จากการชงครั้งถัดไป) */
const advice: Check = { test: () => true, optional: true, normalize: (v) => (isAdvice(v) ? v : undefined) }

// ---------- Schema ของแต่ละตาราง ----------

const BEAN_SCHEMA: Schema<Bean> = {
  id,
  name: str,
  roaster: str,
  origin: str,
  variety: optional(str),
  process: optional(oneOf(BEAN_PROCESSES)),
  roastLevel: oneOf(ROAST_LEVELS),
  roastDate: localDate,
  weightG: pos,
  // คงเหลือติดลบได้ (ชงเกินที่บันทึกไว้)
  remainingG: num,
  priceTotal: optional(nonNeg),
  currency: optional(str),
  category: oneOf(CATEGORIES),
  notes: optional(str),
  archived: bool,
  createdAt: iso,
  updatedAt: iso,
}

const GEAR_SCHEMA: Schema<Gear> = {
  id,
  type: oneOf(GEAR_TYPES),
  name: str,
  grindScale: optional(grindScale),
  notes: optional(str),
  createdAt: iso,
  updatedAt: iso,
}

const RECIPE_SCHEMA: Schema<Recipe> = {
  id,
  name: str,
  method: oneOf(METHODS),
  category: oneOf(CATEGORIES),
  isDefault: bool,
  doseG: pos,
  waterG: pos,
  tempC: optional(num),
  grindHint: oneOf(GRIND_HINTS),
  totalTimeSec: nonNeg,
  steps,
  createdAt: iso,
  updatedAt: iso,
}

const SCALE5 = int(-2, 2)

const BREW_SCHEMA: Schema<Brew> = {
  id,
  brewedAt: iso,
  method: oneOf(METHODS),
  beanId: id,
  recipeId: optional(str),
  grinderId: optional(str),
  brewerId: optional(str),
  doseG: pos,
  waterG: pos,
  yieldG: optional(nonNeg),
  grindSetting: optional(num),
  tempC: optional(num),
  bloomSec: optional(nonNeg),
  totalTimeSec: optional(nonNeg),
  tds: optional(nonNeg),
  rating: optional(int(1, 5)),
  balance: optional(SCALE5),
  body: optional(SCALE5),
  sweetness: optional(int(0, 4)),
  sourAndBitter: optional(bool),
  // ไฟล์จากเวอร์ชันเก่าที่ไม่มีสองฟิลด์นี้ → เติมค่าเริ่มต้นด้านล่าง
  flavorTags: optional(strArray),
  notes: optional(str),
  isBest: optional(bool),
  advice,
  createdAt: iso,
  updatedAt: iso,
}

const SETTINGS_SCHEMA: Schema<PortableSettings> = {
  language: oneOf(LANGUAGES),
  units: oneOf(UNITS),
  theme: oneOf(THEMES),
  defaultMethod: oneOf(METHODS),
}

// ---------- ตัวอ่านไฟล์ ----------

class BackupFailure extends Error {
  readonly error: BackupError
  constructor(error: BackupError) {
    super(error.code)
    this.error = error
  }
}

function parseRecord<T extends object>(raw: unknown, schema: Schema<T>, table: BackupTable, index: number): T {
  const fail = (field: string) => new BackupFailure({ code: 'invalidRecord', table, index, field })
  if (!isObj(raw)) throw fail('(record)')
  const out: Record<string, unknown> = {}
  for (const [key, check] of Object.entries(schema) as [string, Check][]) {
    const v = raw[key]
    if (v === undefined || v === null) {
      if (check.optional) continue
      throw fail(key)
    }
    if (!check.test(v)) throw fail(key)
    const value = check.normalize ? check.normalize(v) : v
    if (value !== undefined) out[key] = value
  }
  return out as T
}

function parseTable<T extends { id: string }>(raw: unknown, schema: Schema<T>, table: BackupTable): T[] {
  if (!Array.isArray(raw)) throw new BackupFailure({ code: 'missingTable', table })
  const seen = new Set<string>()
  return raw.map((item, index) => {
    const rec = parseRecord(item, schema, table, index)
    if (seen.has(rec.id)) throw new BackupFailure({ code: 'duplicateId', table, id: rec.id })
    seen.add(rec.id)
    return rec
  })
}

function parseSettings(raw: unknown): Partial<PortableSettings> {
  if (!isObj(raw)) return {}
  const out: Record<string, unknown> = {}
  for (const [key, check] of Object.entries(SETTINGS_SCHEMA) as [string, Check][]) {
    // ค่าตั้งที่ผิด = ใช้ค่าเดิมของเครื่อง ไม่ปฏิเสธไฟล์
    if (check.test(raw[key])) out[key] = raw[key]
  }
  return out as Partial<PortableSettings>
}

/** อ่านและตรวจไฟล์สำรอง (ข้อความ JSON) — คืน error เป็นรหัส ไม่ throw */
export function parseBackup(text: string): BackupParseResult {
  try {
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      throw new BackupFailure({ code: 'notJson' })
    }
    if (!isObj(json) || json.app !== BACKUP_APP || !isNum(json.formatVersion) || !isObj(json.data) || !iso.test(json.exportedAt)) {
      throw new BackupFailure({ code: 'notBackup' })
    }
    if (json.formatVersion > BACKUP_FORMAT_VERSION) {
      throw new BackupFailure({ code: 'newerVersion', version: json.formatVersion })
    }
    if (json.formatVersion < 1) throw new BackupFailure({ code: 'notBackup' })

    const { data } = json
    const beans = parseTable(data.beans, BEAN_SCHEMA, 'beans')
    const gear = parseTable(data.gear, GEAR_SCHEMA, 'gear')
    // สูตรตั้งต้นในไฟล์ถูกข้าม — แอป seed เวอร์ชันล่าสุดให้เอง (ตรวจรูปแบบแล้วจึงข้าม ไฟล์เสียยังถูกปฏิเสธ)
    const recipes = parseTable(data.recipes, RECIPE_SCHEMA, 'recipes').filter((r) => !r.isDefault)
    const brews = parseTable(data.brews, BREW_SCHEMA, 'brews').map(
      (b): Brew => ({ ...b, flavorTags: b.flavorTags ?? [], isBest: b.isBest ?? false }),
    )

    const beanIds = new Set(beans.map((b) => b.id))
    const orphan = brews.find((b) => !beanIds.has(b.beanId))
    if (orphan) throw new BackupFailure({ code: 'missingBean', beanId: orphan.beanId })

    return {
      ok: true,
      backup: { exportedAt: json.exportedAt as string, beans, gear, recipes, brews, settings: parseSettings(data.settings) },
    }
  } catch (err) {
    if (err instanceof BackupFailure) return { ok: false, error: err.error }
    throw err
  }
}

// ---------- เตือนสำรองข้อมูล ----------

/** เตือนให้สำรองข้อมูลทุก 2 สัปดาห์ (PLAN ข้อ 2) */
export const BACKUP_INTERVAL_DAYS = 14

const DAY_MS = 86_400_000

export interface BackupReminderInput {
  lastBackupAt?: ISODateTime
  /** เวลาที่สร้างข้อมูลชิ้นแรก — ใช้เป็นจุดเริ่มนับเมื่อยังไม่เคยสำรองเลย */
  firstDataAt?: ISODateTime
  /** มีข้อมูลที่ควรสำรองอยู่หรือไม่ */
  hasData: boolean
  now: Date
}

export interface BackupReminder {
  due: boolean
  /** ครบกำหนดแล้วกี่วันนับจากการสำรองล่าสุด (หรือจากข้อมูลชิ้นแรกถ้ายังไม่เคยสำรอง) */
  daysSince?: number
  neverBackedUp: boolean
}

/**
 * ถึงเวลาเตือนสำรองข้อมูลหรือยัง
 * - ไม่มีข้อมูล = ไม่เตือน
 * - เคยสำรองแล้ว: นับจากครั้งล่าสุด; ยังไม่เคย: นับจากข้อมูลชิ้นแรก (ผู้ใช้ใหม่ไม่ถูกเตือนทันที)
 */
export function backupReminder({ lastBackupAt, firstDataAt, hasData, now }: BackupReminderInput): BackupReminder {
  const neverBackedUp = lastBackupAt === undefined
  const baseline = Date.parse(lastBackupAt ?? firstDataAt ?? '')
  if (!hasData || Number.isNaN(baseline)) return { due: false, neverBackedUp }
  const daysSince = Math.floor((now.getTime() - baseline) / DAY_MS)
  return { due: daysSince >= BACKUP_INTERVAL_DAYS, daysSince, neverBackedUp }
}
