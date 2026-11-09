import { isValidGrindScale } from '../../domain/inventory'
import type { Gear, GearType } from '../../domain/types'
import type { GearInput } from '../../db/gear'
import type { MessageKey } from '../../i18n'
import { numberToText, optionalText, parseNumber } from '../formUtil'

/** ตรรกะฟอร์มอุปกรณ์ (Pure TS) */

export interface GearFormValues {
  type: GearType
  name: string
  notes: string
  /** สเกลเบอร์บด — ใช้เฉพาะ type = grinder */
  scaleMin: string
  scaleMax: string
  scaleStep: string
}

/** ข้อผิดพลาดต่อช่อง เก็บเป็นคีย์ข้อความ — แปลตอนแสดง */
export type GearFormErrors = Partial<Record<keyof GearFormValues, MessageKey>>

export type GearFormResult = { ok: true; value: GearInput } | { ok: false; errors: GearFormErrors }

export function emptyGearForm(type: GearType = 'grinder'): GearFormValues {
  return { type, name: '', notes: '', scaleMin: '', scaleMax: '', scaleStep: '' }
}

export function gearToForm(gear: Gear): GearFormValues {
  return {
    type: gear.type,
    name: gear.name,
    notes: gear.notes ?? '',
    scaleMin: numberToText(gear.grindScale?.min),
    scaleMax: numberToText(gear.grindScale?.max),
    scaleStep: numberToText(gear.grindScale?.step),
  }
}

export function validateGearForm(v: GearFormValues): GearFormResult {
  const errors: GearFormErrors = {}

  const name = v.name.trim()
  if (!name) errors.name = 'gear.val.name'

  let grindScale: GearInput['grindScale']
  if (v.type === 'grinder') {
    const min = parseNumber(v.scaleMin)
    const max = parseNumber(v.scaleMax)
    const step = parseNumber(v.scaleStep)
    const filled = [min, max, step].filter((n) => n !== undefined).length
    if (filled > 0) {
      // กรอกบางช่อง = ต้องกรอกครบทั้ง 3
      if (min === undefined) errors.scaleMin = 'gear.val.minRequired'
      if (max === undefined) errors.scaleMax = 'gear.val.maxRequired'
      if (step === undefined) errors.scaleStep = 'gear.val.stepRequired'
      if (filled === 3) {
        if (isValidGrindScale({ min: min!, max: max!, step: step! })) grindScale = { min: min!, max: max!, step: step! }
        else if (!(min! < max!)) errors.scaleMax = 'gear.val.maxGreater'
        else errors.scaleStep = 'gear.val.stepRange'
      }
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { type: v.type, name, grindScale, notes: optionalText(v.notes) } }
}
