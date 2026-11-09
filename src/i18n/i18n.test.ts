import en from './en.json'
import th from './th.json'
import { createT, isLanguage, tTh } from './index'

/** ป้ายปุ่มสลับภาษาเขียนเป็น "ภาษาปลายทาง" ตั้งใจ (คนที่อ่านภาษานั้นจะเห็นว่าปุ่มนี้พาไปไหน) */
const IN_TARGET_LANGUAGE = new Set(['app.language.switchTo'])

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
const baseKeys = (dict: Record<string, string>) => Object.keys(dict).filter((k) => !k.endsWith('_one'))

describe('พจนานุกรม th / en', () => {
  it('คีย์พื้นฐานของสองภาษาตรงกันทุกตัว', () => {
    expect(baseKeys(en).sort()).toEqual(baseKeys(th).sort())
  })

  it('คีย์พหูพจน์ `_one` มีเฉพาะในภาษาอังกฤษ และมีคีย์หลักคู่กันเสมอ', () => {
    expect(Object.keys(th).filter((k) => k.endsWith('_one'))).toEqual([])
    for (const k of Object.keys(en).filter((k) => k.endsWith('_one'))) {
      expect(en, k).toHaveProperty(k.replace(/_one$/, ''))
    }
  })

  it('ตัวแปร {…} ในแต่ละคีย์ตรงกันทั้งสองภาษา (แปลแล้วไม่ทำตัวแปรหาย/เพิ่ม)', () => {
    const t = th as Record<string, string>
    const e = en as Record<string, string>
    for (const k of baseKeys(t)) expect(placeholders(e[k]), k).toEqual(placeholders(t[k]))
    for (const k of Object.keys(e).filter((k) => k.endsWith('_one'))) {
      expect(placeholders(e[k]), k).toEqual(placeholders(e[k.replace(/_one$/, '')]))
    }
  })

  it('ข้อความอังกฤษไม่มีอักษรไทยปน และข้อความไทยไม่ว่างเปล่า (ยกเว้นคีย์ที่ตั้งใจให้ว่าง)', () => {
    for (const [k, v] of Object.entries(en)) if (!IN_TARGET_LANGUAGE.has(k)) expect(v, k).not.toMatch(/[ก-๙]/)
    for (const [k, v] of Object.entries(th)) if (!k.startsWith('label.stepHint.custom')) expect(v, k).not.toBe('')
  })
})

describe('createT', () => {
  it('แทนค่าตัวแปร และคงตัวแปรที่ไม่ได้ส่งไว้ตามเดิม', () => {
    expect(tTh('common.days', { n: 3 })).toBe('3 วัน')
    expect(createT('en')('bean.costPerCup', { cost: '£1' })).toBe('Cost ≈ £1 / cup ({dose} g)')
  })

  it('พหูพจน์อังกฤษ: n = 1 ใช้ _one, อื่น ๆ ใช้รูปปกติ; ภาษาไทยไม่แยก', () => {
    const en = createT('en')
    expect(en('common.days', { n: 1 })).toBe('1 day')
    expect(en('common.days', { n: 0 })).toBe('0 days')
    expect(en('common.days', { n: 2 })).toBe('2 days')
    expect(tTh('common.days', { n: 1 })).toBe('1 วัน')
  })

  it('คีย์ที่ไม่มี → แสดงชื่อคีย์ (ไม่พัง)', () => {
    expect(createT('en')('no.such.key' as never)).toBe('no.such.key')
  })

  it('isLanguage', () => {
    expect(isLanguage('th')).toBe(true)
    expect(isLanguage('en')).toBe(true)
    expect(isLanguage('fr')).toBe(false)
    expect(isLanguage(undefined)).toBe(false)
  })
})
