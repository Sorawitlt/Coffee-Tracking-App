import { toLocalDate } from '../../domain/calc'
import { remainingDisplayG } from '../../domain/inventory'
import type { Bean, BeanProcess, Category, RoastLevel } from '../../domain/types'
import type { BeanInput } from '../../db/beans'
import type { MessageKey } from '../../i18n'
import { numberToText, optionalText, parseNumber } from '../formUtil'

/**
 * ตรรกะฟอร์มเมล็ด (Pure TS) — แยกจาก UI เพื่อทดสอบง่าย
 * ค่าในฟอร์มเป็น string ทั้งหมด แล้วแปลง/ตรวจสอบเป็น `BeanInput` ตอนบันทึก
 */

export interface BeanFormValues {
  name: string
  roaster: string
  origin: string
  variety: string
  process: BeanProcess | ''
  roastLevel: RoastLevel
  roastDate: string
  weightG: string
  remainingG: string
  priceTotal: string
  currency: string
  category: Category
  notes: string
}

/** ข้อผิดพลาดต่อช่อง เก็บเป็นคีย์ข้อความ — แปลตอนแสดง (สลับภาษากลางทางได้) */
export type BeanFormErrors = Partial<Record<keyof BeanFormValues, MessageKey>>

export type BeanFormResult = { ok: true; value: BeanInput } | { ok: false; errors: BeanFormErrors }

export const DEFAULT_CURRENCY = 'THB'

/** ฟอร์มเปล่าสำหรับเพิ่มเมล็ด — วันที่คั่วเว้นว่างให้ผู้ใช้กรอกเอง เพื่อไม่ให้ "วันหลังคั่ว" ผิดโดยไม่รู้ตัว */
export function emptyBeanForm(): BeanFormValues {
  return {
    name: '',
    roaster: '',
    origin: '',
    variety: '',
    process: '',
    roastLevel: 'medium',
    roastDate: '',
    weightG: '',
    remainingG: '',
    priceTotal: '',
    currency: DEFAULT_CURRENCY,
    category: 'coffee',
    notes: '',
  }
}

export function beanToForm(bean: Bean): BeanFormValues {
  return {
    name: bean.name,
    roaster: bean.roaster,
    origin: bean.origin,
    variety: bean.variety ?? '',
    process: bean.process ?? '',
    roastLevel: bean.roastLevel,
    roastDate: bean.roastDate,
    weightG: numberToText(bean.weightG),
    remainingG: numberToText(remainingDisplayG(bean)),
    priceTotal: numberToText(bean.priceTotal),
    currency: bean.currency ?? DEFAULT_CURRENCY,
    category: bean.category,
    notes: bean.notes ?? '',
  }
}

/** "YYYY-MM-DD" ที่เป็นวันจริงในปฏิทิน (ปฏิเสธ 2026-02-31) */
export function isRealLocalDate(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

export interface ValidateBeanOptions {
  /** `add` = เพิ่มใหม่ (เว้นคงเหลือ = เท่าน้ำหนักถุง), `edit` = แก้ไข (ต้องระบุคงเหลือ) */
  mode: 'add' | 'edit'
  /** "YYYY-MM-DD" ของวันนี้ (กำหนดได้เพื่อทดสอบ) */
  today?: string
}

export function validateBeanForm(v: BeanFormValues, { mode, today = toLocalDate(new Date()) }: ValidateBeanOptions): BeanFormResult {
  const errors: BeanFormErrors = {}

  const name = v.name.trim()
  if (!name) errors.name = 'bean.val.name'

  if (!v.roastDate) errors.roastDate = 'bean.val.roastDateRequired'
  else if (!isRealLocalDate(v.roastDate)) errors.roastDate = 'bean.val.roastDateInvalid'
  else if (v.roastDate > today) errors.roastDate = 'bean.val.roastDateFuture'

  const weightG = parseNumber(v.weightG)
  if (weightG === undefined) errors.weightG = 'bean.val.weightRequired'
  else if (!(weightG > 0)) errors.weightG = 'bean.val.weightPositive'

  let remainingG = parseNumber(v.remainingG)
  if (remainingG === undefined) {
    if (mode === 'edit') errors.remainingG = 'bean.val.remainingRequired'
    else remainingG = weightG // เพิ่มใหม่: ถุงเต็ม
  } else if (!(remainingG >= 0)) {
    errors.remainingG = 'bean.val.remainingNumber'
  } else if (weightG !== undefined && weightG > 0 && remainingG > weightG) {
    errors.remainingG = 'bean.val.remainingMax'
  }

  const priceTotal = parseNumber(v.priceTotal)
  if (priceTotal !== undefined && !(priceTotal >= 0)) errors.priceTotal = 'bean.val.price'

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      name,
      roaster: v.roaster.trim(),
      origin: v.origin.trim(),
      variety: optionalText(v.variety),
      process: v.process || undefined,
      roastLevel: v.roastLevel,
      roastDate: v.roastDate,
      weightG: weightG!,
      remainingG: remainingG!,
      priceTotal,
      currency: priceTotal === undefined ? undefined : v.currency || DEFAULT_CURRENCY,
      category: v.category,
      notes: optionalText(v.notes),
    },
  }
}
