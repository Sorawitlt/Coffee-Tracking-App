import { getGearModel } from '../../domain/catalog'
import type { Gear } from '../../domain/types'
import { applyCatalogModel, emptyGearForm, gearToForm, unlinkCatalog, validateGearForm } from './gearForm'

const DF64 = getGearModel('df-grinders-df64-gen-2')!
const NICHE = getGearModel('niche-zero')!
const FLAIR = getGearModel('flair-58-plus-2')!
const K_ULTRA = getGearModel('1zpresso-k-ultra')!

describe('validateGearForm', () => {
  it('ต้องมีชื่อ', () => {
    expect(validateGearForm({ ...emptyGearForm(), name: '  ' })).toMatchObject({ ok: false, errors: { name: expect.any(String) } })
  })

  it('เครื่องบดไม่ใส่สเกลได้', () => {
    expect(validateGearForm({ ...emptyGearForm(), name: ' C40 ' })).toEqual({
      ok: true, value: { type: 'grinder', name: 'C40', grindScale: undefined, notes: undefined },
    })
  })

  it('เครื่องบดใส่สเกลครบ', () => {
    const r = validateGearForm({ ...emptyGearForm(), name: 'C40', scaleMin: '0', scaleMax: '40', scaleStep: '1' })
    expect(r).toMatchObject({ ok: true, value: { grindScale: { min: 0, max: 40, step: 1 } } })
  })

  it('สเกลกรอกไม่ครบ → error เฉพาะช่องที่ขาด', () => {
    const r = validateGearForm({ ...emptyGearForm(), name: 'X', scaleMax: '40' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['scaleMin', 'scaleStep'])
  })

  it('สูงสุด ≤ ต่ำสุด → error ที่ช่องสูงสุด; ขั้นเกินช่วง → error ที่ช่องขั้น', () => {
    const base = { ...emptyGearForm(), name: 'X' }
    expect(validateGearForm({ ...base, scaleMin: '10', scaleMax: '5', scaleStep: '1' })).toMatchObject({
      ok: false, errors: { scaleMax: expect.any(String) },
    })
    expect(validateGearForm({ ...base, scaleMin: '0', scaleMax: '10', scaleStep: '11' })).toMatchObject({
      ok: false, errors: { scaleStep: expect.any(String) },
    })
    expect(validateGearForm({ ...base, scaleMin: '0', scaleMax: '10', scaleStep: '0' })).toMatchObject({
      ok: false, errors: { scaleStep: expect.any(String) },
    })
  })

  it('ชนิดที่ไม่ใช่เครื่องบด ไม่สนใจช่องสเกลที่ค้างอยู่', () => {
    const r = validateGearForm({ ...emptyGearForm('kettle'), name: 'Kettle', scaleMin: '9', scaleMax: '1', scaleStep: 'x' })
    expect(r).toEqual({ ok: true, value: { type: 'kettle', name: 'Kettle', grindScale: undefined, notes: undefined } })
  })
})

describe('gearToForm', () => {
  it('round-trip', () => {
    const gear: Gear = {
      id: 'g', type: 'grinder', name: 'C40', grindScale: { min: 0, max: 40, step: 0.5 }, notes: 'n',
      createdAt: 't', updatedAt: 't',
    }
    expect(validateGearForm(gearToForm(gear))).toEqual({
      ok: true, value: { type: 'grinder', name: 'C40', grindScale: { min: 0, max: 40, step: 0.5 }, notes: 'n' },
    })
  })
})

describe('applyCatalogModel', () => {
  it('ฟอร์มว่าง → เติมชนิด ยี่ห้อ รุ่น ชื่อ รหัส และสเกลจากฐานข้อมูล', () => {
    expect(applyCatalogModel(emptyGearForm('kettle'), DF64)).toMatchObject({
      type: 'grinder', brand: 'DF Grinders', model: 'DF64 Gen 2', name: 'DF Grinders DF64 Gen 2',
      catalogId: 'df-grinders-df64-gen-2', scaleMin: '0', scaleMax: '90', scaleStep: '0.5',
    })
  })

  it('ชื่อที่ตั้งเองและสเกลที่ปรับเองไม่ถูกทับ', () => {
    const v = { ...emptyGearForm(), name: 'DF64 ที่บ้าน', scaleMin: '5', scaleMax: '95', scaleStep: '1' }
    expect(applyCatalogModel(v, DF64)).toMatchObject({ name: 'DF64 ที่บ้าน', scaleMin: '5', scaleMax: '95', scaleStep: '1' })
  })

  it('เปลี่ยนรุ่น: ชื่อ/สเกลที่แอปเติมจากรุ่นก่อนถูกแทนด้วยของรุ่นใหม่', () => {
    const next = applyCatalogModel(applyCatalogModel(emptyGearForm(), DF64), NICHE)
    expect(next).toMatchObject({ name: 'Niche Zero', scaleMin: '0', scaleMax: '50', scaleStep: '0.5', catalogId: 'niche-zero' })
  })

  it('รุ่นที่ไม่มีสเกล: ล้างสเกลของรุ่นก่อน แต่ไม่ล้างสเกลที่ผู้ใช้กรอกเอง', () => {
    expect(applyCatalogModel(applyCatalogModel(emptyGearForm(), DF64), K_ULTRA)).toMatchObject({ scaleMin: '', scaleMax: '', scaleStep: '' })
    const own = { ...emptyGearForm(), name: 'K', scaleMin: '0', scaleMax: '200', scaleStep: '1' }
    expect(applyCatalogModel(own, K_ULTRA)).toMatchObject({ scaleMin: '0', scaleMax: '200', scaleStep: '1' })
  })

  it('อุปกรณ์ชง (Flair) → ชนิด brewer และบันทึกได้โดยไม่มีสเกล', () => {
    const v = applyCatalogModel(emptyGearForm(), FLAIR)
    expect(v.type).toBe('brewer')
    expect(validateGearForm(v)).toEqual({
      ok: true,
      value: { type: 'brewer', name: 'Flair 58 Plus 2', brand: 'Flair Espresso', model: 'Flair 58 Plus 2', catalogId: 'flair-58-plus-2', grindScale: undefined, notes: undefined },
    })
  })
})

describe('การเชื่อมฐานข้อมูลตอนบันทึก', () => {
  it('ยกเลิกการเชื่อม: ไม่มีรหัส แต่ยี่ห้อ/รุ่นยังอยู่', () => {
    const r = validateGearForm(unlinkCatalog(applyCatalogModel(emptyGearForm(), DF64)))
    expect(r).toMatchObject({ ok: true, value: { catalogId: undefined, brand: 'DF Grinders', model: 'DF64 Gen 2' } })
  })

  it('ผู้ใช้เปลี่ยนชนิดจนไม่ตรงกับรุ่น → ไม่บันทึกรหัสฐานข้อมูล', () => {
    const v = { ...applyCatalogModel(emptyGearForm(), DF64), type: 'kettle' as const }
    expect(validateGearForm(v)).toMatchObject({ ok: true, value: { catalogId: undefined } })
  })

  it('รหัสที่ไม่มีในฐานข้อมูลเวอร์ชันนี้ถูกคงไว้ (ไม่ทำข้อมูลหาย)', () => {
    const v = { ...emptyGearForm(), name: 'X', catalogId: 'retired-model' }
    expect(validateGearForm(v)).toMatchObject({ ok: true, value: { catalogId: 'retired-model' } })
  })

  it('gearToForm อ่านยี่ห้อ/รุ่น/รหัสกลับมาครบ', () => {
    const gear: Gear = {
      id: 'g', type: 'grinder', name: 'DF64', brand: 'DF Grinders', model: 'DF64 Gen 2', catalogId: DF64.id,
      createdAt: 't', updatedAt: 't',
    }
    expect(gearToForm(gear)).toMatchObject({ brand: 'DF Grinders', model: 'DF64 Gen 2', catalogId: DF64.id })
  })
})
