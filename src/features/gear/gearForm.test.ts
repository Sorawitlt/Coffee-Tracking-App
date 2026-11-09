import type { Gear } from '../../domain/types'
import { emptyGearForm, gearToForm, validateGearForm } from './gearForm'

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
