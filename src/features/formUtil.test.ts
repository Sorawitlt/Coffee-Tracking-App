import { numberToText, optionalText, parseNumber } from './formUtil'

describe('parseNumber', () => {
  it('แปลงตัวเลขปกติ ทศนิยม และ "," เป็นจุด', () => {
    expect(parseNumber('250')).toBe(250)
    expect(parseNumber(' 12.5 ')).toBe(12.5)
    expect(parseNumber('12,5')).toBe(12.5)
    expect(parseNumber('.5')).toBe(0.5)
    expect(parseNumber('15.')).toBe(15)
    expect(parseNumber('0')).toBe(0)
    expect(parseNumber('-3')).toBe(-3)
  })
  it('ว่าง → undefined', () => {
    expect(parseNumber('')).toBeUndefined()
    expect(parseNumber('   ')).toBeUndefined()
  })
  it('ไม่ใช่ตัวเลข → NaN (รวมรูปแบบที่ Number() ยอมแต่เราไม่ต้องการ)', () => {
    for (const bad of ['abc', '1e3', '0x10', '1.2.3', '12g', 'Infinity', '--1', '.', '-']) {
      expect(parseNumber(bad)).toBeNaN()
    }
  })
})

describe('numberToText / optionalText', () => {
  it('numberToText', () => {
    expect(numberToText(250)).toBe('250')
    expect(numberToText(12.5)).toBe('12.5')
    expect(numberToText(undefined)).toBe('')
    expect(numberToText(Number.NaN)).toBe('')
  })
  it('optionalText ตัดช่องว่าง และว่าง → undefined', () => {
    expect(optionalText('  a  ')).toBe('a')
    expect(optionalText('   ')).toBeUndefined()
  })
})
