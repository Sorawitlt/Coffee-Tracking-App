import type { BrewDraft, DialValues } from '../../domain/brewDraft'
import type { Brew, Method } from '../../domain/types'
import type { BrewInput } from '../../db/brews'
import type { MessageKey } from '../../i18n'
import { numberToText, optionalText, parseNumber } from '../formUtil'

/**
 * ตรรกะฟอร์มบันทึกการชง (Pure TS) — แยกจาก UI เพื่อทดสอบง่าย
 * ค่าในฟอร์มเป็น string ทั้งหมด แล้วแปลง/ตรวจสอบเป็น `BrewInput` ตอนบันทึก
 * บังคับกรอกแค่ วิธีชง, เมล็ด, กาแฟ, น้ำ (PLAN ข้อ 4)
 */

export interface BrewFormValues {
  method: Method
  beanId: string
  doseG: string
  waterG: string
  grindSetting: string
  tempC: string
  grinderId: string
  brewerId: string
  totalTimeSec: string
  yieldG: string
  tds: string
  /** รูปแบบของ `<input type="datetime-local">` เช่น "2026-11-09T08:30" (เวลาท้องถิ่น) */
  brewedAt: string
  /** ไม่แสดงในฟอร์ม แต่ต้องเก็บไว้ไม่ให้สูตรที่ผูกอยู่หลุดตอนแก้ไข */
  recipeId: string
}

/** ข้อผิดพลาดต่อช่อง เก็บเป็นคีย์ข้อความ — แปลตอนแสดง */
export type BrewFormErrors = Partial<Record<keyof BrewFormValues, MessageKey>>

export type BrewFormResult = { ok: true; value: BrewInput } | { ok: false; errors: BrewFormErrors }

// ---------- วันที่-เวลา ----------

const pad = (n: number) => String(n).padStart(2, '0')

/** Date → "YYYY-MM-DDTHH:mm" ตามเวลาท้องถิ่น */
export function toDateTimeLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** "YYYY-MM-DDTHH:mm" → Date (ตีความเป็นเวลาท้องถิ่น); รูปแบบผิดหรือไม่ใช่วันจริง → undefined */
export function fromDateTimeLocal(text: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text)
  if (!m) return undefined
  const [y, mo, d, h, mi] = m.slice(1).map(Number)
  const date = new Date(y, mo - 1, d, h, mi)
  const real = date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d && date.getHours() === h
  return real ? date : undefined
}

// ---------- แปลงไป-กลับ ----------

/** ค่าเริ่มต้นของฟอร์มจากค่าที่เติมอัตโนมัติ (ชงใหม่ / ชงซ้ำ) */
export function draftToForm(draft: BrewDraft, beanId: string, at: Date): BrewFormValues {
  return {
    method: draft.method,
    beanId,
    doseG: numberToText(draft.doseG),
    waterG: numberToText(draft.waterG),
    grindSetting: numberToText(draft.grindSetting),
    tempC: numberToText(draft.tempC),
    grinderId: draft.grinderId ?? '',
    brewerId: draft.brewerId ?? '',
    totalTimeSec: '',
    yieldG: '',
    tds: '',
    brewedAt: toDateTimeLocal(at),
    recipeId: draft.recipeId ?? '',
  }
}

/** ฟอร์มสำหรับแก้ไขบันทึกเดิม */
export function brewToForm(brew: Brew): BrewFormValues {
  return {
    ...draftToForm(brew, brew.beanId, new Date(brew.brewedAt)),
    totalTimeSec: numberToText(brew.totalTimeSec),
    yieldG: numberToText(brew.yieldG),
    tds: numberToText(brew.tds),
  }
}

/** ค่าตั้งที่ใช้เทียบ "ค่าที่เปลี่ยน" — ช่องว่าง/ไม่ใช่ตัวเลขนับเป็นไม่มีค่า */
export function formToDialValues(v: BrewFormValues): DialValues {
  const num = (text: string) => {
    const n = parseNumber(text)
    return n === undefined || Number.isNaN(n) ? undefined : n
  }
  return {
    doseG: num(v.doseG),
    waterG: num(v.waterG),
    grindSetting: num(v.grindSetting),
    tempC: num(v.tempC),
    grinderId: v.grinderId || undefined,
  }
}

// ---------- ตรวจสอบ ----------

/** เผื่อนาฬิกาเครื่องเดินเร็วเล็กน้อย */
const FUTURE_TOLERANCE_MS = 5 * 60_000

export function validateBrewForm(v: BrewFormValues, { now = new Date() }: { now?: Date } = {}): BrewFormResult {
  const errors: BrewFormErrors = {}

  if (!v.beanId) errors.beanId = 'brew.val.bean'

  const doseG = parseNumber(v.doseG)
  if (doseG === undefined) errors.doseG = 'brew.val.doseRequired'
  else if (!(doseG > 0)) errors.doseG = 'brew.val.dosePositive'

  const waterG = parseNumber(v.waterG)
  if (waterG === undefined) errors.waterG = 'brew.val.waterRequired'
  else if (!(waterG > 0)) errors.waterG = 'brew.val.waterPositive'

  const grindSetting = parseNumber(v.grindSetting)
  if (grindSetting !== undefined && !(grindSetting >= 0)) errors.grindSetting = 'brew.val.grind'

  const tempC = parseNumber(v.tempC)
  if (tempC !== undefined && !(tempC >= 0 && tempC <= 100)) errors.tempC = 'brew.val.temp'

  const totalTimeSec = parseNumber(v.totalTimeSec)
  if (totalTimeSec !== undefined && !(totalTimeSec > 0)) errors.totalTimeSec = 'brew.val.time'

  const yieldG = parseNumber(v.yieldG)
  if (yieldG !== undefined && !(yieldG > 0)) errors.yieldG = 'brew.val.yield'

  const tds = parseNumber(v.tds)
  if (tds !== undefined && !(tds > 0 && tds <= 30)) errors.tds = 'brew.val.tds'

  const at = fromDateTimeLocal(v.brewedAt)
  if (!at) errors.brewedAt = 'brew.val.dateInvalid'
  else if (at.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) errors.brewedAt = 'brew.val.dateFuture'

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      brewedAt: at!.toISOString(),
      method: v.method,
      beanId: v.beanId,
      recipeId: optionalText(v.recipeId),
      grinderId: v.grinderId || undefined,
      brewerId: v.brewerId || undefined,
      doseG: doseG!,
      waterG: waterG!,
      yieldG,
      grindSetting,
      tempC,
      totalTimeSec,
      tds,
    },
  }
}
