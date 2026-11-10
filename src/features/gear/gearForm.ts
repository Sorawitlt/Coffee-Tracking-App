import { gearModelName, getGearModel, type GearModel } from '../../domain/catalog'
import { isValidGrindScale } from '../../domain/inventory'
import type { Gear, GearType } from '../../domain/types'
import type { GearInput } from '../../db/gear'
import type { MessageKey } from '../../i18n'
import { numberToText, optionalText, parseNumber } from '../formUtil'

/** ตรรกะฟอร์มอุปกรณ์ (Pure TS) */

export interface GearFormValues {
  type: GearType
  name: string
  brand: string
  model: string
  /** รหัสรุ่นในฐานข้อมูลอ้างอิง ('' = ไม่ได้เชื่อม) */
  catalogId: string
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
  return { type, name: '', brand: '', model: '', catalogId: '', notes: '', scaleMin: '', scaleMax: '', scaleStep: '' }
}

export function gearToForm(gear: Gear): GearFormValues {
  return {
    type: gear.type,
    name: gear.name,
    brand: gear.brand ?? '',
    model: gear.model ?? '',
    catalogId: gear.catalogId ?? '',
    notes: gear.notes ?? '',
    scaleMin: numberToText(gear.grindScale?.min),
    scaleMax: numberToText(gear.grindScale?.max),
    scaleStep: numberToText(gear.grindScale?.step),
  }
}

const scaleText = (m: GearModel | undefined) =>
  m?.grindScale
    ? { scaleMin: numberToText(m.grindScale.min), scaleMax: numberToText(m.grindScale.max), scaleStep: numberToText(m.grindScale.step) }
    : undefined

/**
 * เลือกรุ่นจากฐานข้อมูล → เติมชนิด ยี่ห้อ รุ่น ชื่อ และสเกลเบอร์บด
 *
 * ไม่ทับค่าที่ผู้ใช้ตั้งเอง:
 * - ชื่อ: เติมเมื่อว่าง หรือยังเป็นชื่อที่แอปเติมจากรุ่นก่อนหน้า (ชื่อที่ตั้งเอง เช่น "DF64 ที่บ้าน" คงไว้)
 * - สเกลเบอร์บด: เติมเมื่อว่าง หรือยังเป็นสเกลของรุ่นก่อนหน้า (สเกลที่ปรับเองตามจุดศูนย์จริงคงไว้)
 */
export function applyCatalogModel(values: GearFormValues, model: GearModel): GearFormValues {
  const prev = getGearModel(values.catalogId || undefined)
  const name = values.name.trim()
  const autoName = !name || (prev !== undefined && name === gearModelName(prev))

  const prevScale = scaleText(prev)
  const scaleEmpty = !values.scaleMin && !values.scaleMax && !values.scaleStep
  const scaleIsPrev =
    prevScale !== undefined &&
    values.scaleMin === prevScale.scaleMin &&
    values.scaleMax === prevScale.scaleMax &&
    values.scaleStep === prevScale.scaleStep
  const nextScale = scaleText(model)
  const scale =
    scaleEmpty || scaleIsPrev
      ? (nextScale ?? { scaleMin: '', scaleMax: '', scaleStep: '' })
      : { scaleMin: values.scaleMin, scaleMax: values.scaleMax, scaleStep: values.scaleStep }

  return {
    ...values,
    ...scale,
    type: model.type,
    brand: model.brand,
    model: model.model,
    catalogId: model.id,
    name: autoName ? gearModelName(model) : values.name,
  }
}

/** ยกเลิกการเชื่อมกับฐานข้อมูล — คงยี่ห้อ/รุ่น/สเกลที่กรอกไว้ (ผู้ใช้แก้ต่อเองได้) */
export function unlinkCatalog(values: GearFormValues): GearFormValues {
  return { ...values, catalogId: '' }
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

  // ผู้ใช้เปลี่ยนชนิดเองจนไม่ตรงกับรุ่นในฐานข้อมูล = เลิกเชื่อม (กันสเปกเครื่องบดไปแสดงบนกาต้มน้ำ)
  // รหัสที่ไม่มีในฐานข้อมูลเวอร์ชันนี้ (เช่น ถูกถอดออกในอนาคต) = คงไว้ ไม่ทำข้อมูลผู้ใช้หาย
  const linked = getGearModel(v.catalogId || undefined)
  const catalogId = linked && linked.type !== v.type ? undefined : optionalText(v.catalogId)

  return {
    ok: true,
    value: {
      type: v.type,
      name,
      brand: optionalText(v.brand),
      model: optionalText(v.model),
      catalogId,
      grindScale,
      notes: optionalText(v.notes),
    },
  }
}
