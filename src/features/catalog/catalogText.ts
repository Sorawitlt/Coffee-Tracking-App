import type { Capacity, CatalogNote, CatalogSource, GearFeature, GearModel, NumRange, SourceKind } from '../../domain/catalog'
import { getGearModel, gearModelName } from '../../domain/catalog'
import type { Language } from '../../domain/types'
import { tTh, type MessageKey, type TFunction } from '../../i18n'
import { METHOD_LABEL } from '../labels'

/**
 * ข้อความของฐานข้อมูลอ้างอิง (ชั้น UI) — แปลงรหัสใน `domain/catalog` เป็นข้อความตามภาษา
 * หน่วยใช้สัญลักษณ์สากล (mm, ml, g, °C, bar, µm) เหมือนกันทุกภาษา
 */

export const SOURCE_KIND_KEY: Record<SourceKind, MessageKey> = {
  manufacturer: 'catalog.kind.manufacturer',
  institution: 'catalog.kind.institution',
  retailer: 'catalog.kind.retailer',
  community: 'catalog.kind.community',
}

export const FEATURE_KEY: Record<GearFeature, MessageKey> = {
  pressureGauge: 'catalog.feature.pressureGauge',
  electricPreheat: 'catalog.feature.electricPreheat',
  pid: 'catalog.feature.pid',
  dualBoiler: 'catalog.feature.dualBoiler',
  builtInGrinder: 'catalog.feature.builtInGrinder',
  timer: 'catalog.feature.timer',
  holdTemp: 'catalog.feature.holdTemp',
}

export const NOTE_KEY: Record<CatalogNote, MessageKey> = {
  findTrueZero: 'catalog.note.findTrueZero',
  scaleFromCommunity: 'catalog.note.scaleFromCommunity',
  steplessLogStep: 'catalog.note.steplessLogStep',
  countClicks: 'catalog.note.countClicks',
  notForEspresso: 'catalog.note.notForEspresso',
  scaleMaxCoversGuide: 'catalog.note.scaleMaxCoversGuide',
  inductionAdapter: 'catalog.note.inductionAdapter',
  resolutionVaries: 'catalog.note.resolutionVaries',
  highResMode: 'catalog.note.highResMode',
  europeanCup: 'catalog.note.europeanCup',
  manualLever: 'catalog.note.manualLever',
  tamper58: 'catalog.note.tamper58',
}

/** 1 US fl oz = 29.5735 ml (ผู้ผลิตในสหรัฐฯ ระบุเป็น oz) */
const ML_PER_OZ = 29.5735

export function rangeText(r: NumRange, unit = ''): string {
  const u = unit ? ` ${unit}` : ''
  return r.min === r.max ? `${r.min}${u}` : `${r.min}–${r.max}${u}`
}

/** ความจุตามหน่วยที่ผู้ผลิตระบุ + ค่าประมาณเป็น ml เมื่อเป็น oz (ค่าเดิมอยู่หน้าเสมอ) */
export function capacityText(c: Capacity): string {
  if (c.unit === 'oz') return `${c.value} oz (≈ ${Math.round(c.value * ML_PER_OZ)} ml)`
  if (c.unit === 'l') return `${c.value} L`
  return `${c.value} ml`
}

/** ชื่อแหล่งอ้างอิงตามภาษา: ภาษาไทยใช้ชื่อต้นฉบับภาษาไทยถ้ามี */
export function sourceTitle(src: CatalogSource, lang: Language): string {
  return lang === 'th' && src.titleLocal ? src.titleLocal : src.title
}

export interface SpecRow {
  label: string
  value: string
}

/** แถวสเปกที่มีค่า (ไม่มีค่า = ไม่แสดงแถว) เรียงตามความสำคัญต่อการชง */
export function specRows(m: GearModel, t: TFunction = tTh): SpecRow[] {
  const sp = m.specs
  const rows: SpecRow[] = []
  const add = (key: MessageKey, value: string | undefined) => {
    if (value) rows.push({ label: t(key), value })
  }

  add('catalog.spec.methods', sp.methods?.map((x) => METHOD_LABEL[x]).join(', '))
  add('catalog.spec.drive', sp.drive && t(sp.drive === 'manual' ? 'catalog.drive.manual' : 'catalog.drive.electric'))
  if (sp.burrShape || sp.burrMm) {
    const shape = sp.burrShape && t(sp.burrShape === 'flat' ? 'catalog.burr.flat' : 'catalog.burr.conical')
    add('catalog.spec.burr', [shape, sp.burrMm ? `${sp.burrMm} mm` : ''].filter(Boolean).join(' · '))
  }
  add('catalog.spec.adjustment', sp.adjustment && t(sp.adjustment === 'stepped' ? 'catalog.adjust.stepped' : 'catalog.adjust.stepless'))
  add('catalog.spec.settings', sp.settingsCount !== undefined ? String(sp.settingsCount) : undefined)
  add('catalog.spec.clicks', sp.clicksPerRotation !== undefined ? String(sp.clicksPerRotation) : undefined)
  add('catalog.spec.microns', sp.micronsPerClick !== undefined ? `${sp.micronsPerClick} µm` : undefined)
  add('catalog.spec.basket', sp.basketMm !== undefined ? `${sp.basketMm} mm` : undefined)
  add('catalog.spec.dose', sp.doseG && rangeText(sp.doseG, 'g'))
  add('catalog.spec.capacity', sp.capacity && capacityText(sp.capacity))
  add('catalog.spec.output', sp.output && capacityText(sp.output))
  add('catalog.spec.cups', sp.cups && rangeText(sp.cups))
  add('catalog.spec.pump', sp.pumpBar !== undefined ? `${sp.pumpBar} bar` : undefined)
  add('catalog.spec.opv', sp.opvBar !== undefined ? `${sp.opvBar} bar` : undefined)
  add('catalog.spec.temp', sp.tempRangeC && rangeText(sp.tempRangeC, '°C'))
  add('catalog.spec.maxWeight', sp.maxG !== undefined ? `${sp.maxG} g` : undefined)
  add('catalog.spec.resolution', sp.resolutionG !== undefined ? `${sp.resolutionG} g` : undefined)
  add(
    'catalog.spec.fits',
    sp.fits
      ?.map((id) => getGearModel(id))
      .filter((x): x is GearModel => x !== undefined)
      .map(gearModelName)
      .join(', '),
  )
  add('catalog.spec.features', m.features?.map((f) => t(FEATURE_KEY[f])).join(', '))
  if (m.grindScale) {
    add('catalog.spec.appScale', t('catalog.scaleValue', { min: m.grindScale.min, max: m.grindScale.max, step: m.grindScale.step }))
  }
  return rows
}

/** ช่วงเบอร์บดที่ผู้ผลิตแนะนำ เช่น "Espresso: 7–13" */
export function grindGuideRows(m: GearModel): SpecRow[] {
  return (m.grindGuide ?? []).map((g) => ({
    label: g.methods.map((x) => METHOD_LABEL[x]).join(', '),
    value: rangeText(g),
  }))
}
