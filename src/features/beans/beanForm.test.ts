import type { Bean } from '../../domain/types'
import { beanToForm, emptyBeanForm, isRealLocalDate, validateBeanForm, type BeanFormValues } from './beanForm'

const TODAY = '2026-11-09'

const valid = (over: Partial<BeanFormValues> = {}): BeanFormValues => ({
  ...emptyBeanForm(),
  name: '  Ethiopia Guji ',
  roastDate: '2026-11-01',
  weightG: '250',
  ...over,
})

describe('isRealLocalDate', () => {
  it('รับเฉพาะวันที่จริง', () => {
    expect(isRealLocalDate('2026-11-09')).toBe(true)
    expect(isRealLocalDate('2028-02-29')).toBe(true)
    expect(isRealLocalDate('2026-02-29')).toBe(false)
    expect(isRealLocalDate('2026-13-01')).toBe(false)
    expect(isRealLocalDate('09/11/2026')).toBe(false)
    expect(isRealLocalDate('')).toBe(false)
  })
})

describe('validateBeanForm — เพิ่มใหม่', () => {
  it('กรอกขั้นต่ำ (ชื่อ, วันคั่ว, น้ำหนัก) ผ่าน; คงเหลือ = ถุงเต็ม; ตัดช่องว่างชื่อ', () => {
    const r = validateBeanForm(valid(), { mode: 'add', today: TODAY })
    expect(r).toEqual({
      ok: true,
      value: {
        name: 'Ethiopia Guji', roaster: '', origin: '', variety: undefined, process: undefined,
        roastLevel: 'medium', roastDate: '2026-11-01', weightG: 250, remainingG: 250,
        priceTotal: undefined, currency: undefined, category: 'coffee', notes: undefined,
      },
    })
  })

  it('ใส่ราคา → เก็บสกุลเงินด้วย; ไม่ใส่ราคา → ไม่เก็บสกุลเงิน', () => {
    const withPrice = validateBeanForm(valid({ priceTotal: '480', currency: 'USD' }), { mode: 'add', today: TODAY })
    expect(withPrice).toMatchObject({ ok: true, value: { priceTotal: 480, currency: 'USD' } })
    const noPrice = validateBeanForm(valid({ currency: 'USD' }), { mode: 'add', today: TODAY })
    expect(noPrice).toMatchObject({ ok: true, value: { priceTotal: undefined, currency: undefined } })
  })

  it('ราคา 0 ใช้ได้ (ของแถม)', () => {
    expect(validateBeanForm(valid({ priceTotal: '0' }), { mode: 'add', today: TODAY })).toMatchObject({
      ok: true, value: { priceTotal: 0 },
    })
  })

  it('ฟิลด์จำเป็นว่าง → error ทุกช่อง', () => {
    const r = validateBeanForm(emptyBeanForm(), { mode: 'add', today: TODAY })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['name', 'roastDate', 'weightG'])
  })

  it('ชื่อเป็นช่องว่างล้วน → error', () => {
    const r = validateBeanForm(valid({ name: '   ' }), { mode: 'add', today: TODAY })
    expect(r).toMatchObject({ ok: false, errors: { name: expect.any(String) } })
  })

  it.each([
    ['วันที่ในอนาคต', '2026-11-10'],
    ['วันที่ไม่มีจริง', '2026-02-30'],
    ['รูปแบบผิด', '9/11/2026'],
  ])('วันที่คั่ว: %s → error', (_label, roastDate) => {
    const r = validateBeanForm(valid({ roastDate }), { mode: 'add', today: TODAY })
    expect(r).toMatchObject({ ok: false, errors: { roastDate: expect.any(String) } })
  })

  it('วันที่คั่ว = วันนี้ ใช้ได้', () => {
    expect(validateBeanForm(valid({ roastDate: TODAY }), { mode: 'add', today: TODAY }).ok).toBe(true)
  })

  it.each(['0', '-5', 'abc'])('น้ำหนักถุง "%s" → error', (weightG) => {
    const r = validateBeanForm(valid({ weightG }), { mode: 'add', today: TODAY })
    expect(r).toMatchObject({ ok: false, errors: { weightG: expect.any(String) } })
  })

  it('คงเหลือเกินน้ำหนักถุง / ติดลบ / ไม่ใช่ตัวเลข → error', () => {
    for (const remainingG of ['251', '-1', 'x']) {
      const r = validateBeanForm(valid({ remainingG }), { mode: 'add', today: TODAY })
      expect(r).toMatchObject({ ok: false, errors: { remainingG: expect.any(String) } })
    }
  })

  it('ราคาติดลบ / ไม่ใช่ตัวเลข → error', () => {
    for (const priceTotal of ['-1', 'abc']) {
      const r = validateBeanForm(valid({ priceTotal }), { mode: 'add', today: TODAY })
      expect(r).toMatchObject({ ok: false, errors: { priceTotal: expect.any(String) } })
    }
  })
})

describe('validateBeanForm — แก้ไข', () => {
  it('ต้องระบุคงเหลือ', () => {
    const r = validateBeanForm(valid({ remainingG: '' }), { mode: 'edit', today: TODAY })
    expect(r).toMatchObject({ ok: false, errors: { remainingG: expect.any(String) } })
  })

  it('คงเหลือ 0 ใช้ได้ (ถุงหมด)', () => {
    expect(validateBeanForm(valid({ remainingG: '0' }), { mode: 'edit', today: TODAY })).toMatchObject({
      ok: true, value: { remainingG: 0 },
    })
  })
})

describe('beanToForm', () => {
  const bean: Bean = {
    id: 'b1', name: 'X', roaster: 'R', origin: 'O', roastLevel: 'light', roastDate: '2026-11-01',
    weightG: 250, remainingG: -4, category: 'coffee', archived: false, createdAt: 't', updatedAt: 't',
  }
  it('คงเหลือติดลบแสดงเป็น 0; ฟิลด์ที่ไม่มีค่าเป็นช่องว่าง; สกุลเงินเริ่มต้น THB', () => {
    expect(beanToForm(bean)).toMatchObject({ remainingG: '0', variety: '', process: '', priceTotal: '', currency: 'THB', notes: '' })
  })
  it('แปลงกลับด้วย validate ได้ค่าเดิม (round-trip)', () => {
    const full: Bean = { ...bean, remainingG: 120.5, variety: 'Heirloom', process: 'washed', priceTotal: 450, currency: 'JPY', notes: 'n' }
    expect(validateBeanForm(beanToForm(full), { mode: 'edit', today: TODAY })).toEqual({
      ok: true,
      value: {
        name: 'X', roaster: 'R', origin: 'O', variety: 'Heirloom', process: 'washed', roastLevel: 'light',
        roastDate: '2026-11-01', weightG: 250, remainingG: 120.5, priceTotal: 450, currency: 'JPY',
        category: 'coffee', notes: 'n',
      },
    })
  })
})
