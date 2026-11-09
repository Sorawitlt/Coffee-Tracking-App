import { brewSearchText, filterBrews, isFilterActive, rangeStart } from './history'
import type { Bean, Brew } from './types'

const T = '2026-11-01T00:00:00.000Z'
const bean = (id: string, name: string, over: Partial<Bean> = {}): Bean => ({
  id, name, roaster: 'Roast Co', origin: 'Ethiopia', roastLevel: 'light', roastDate: '2026-10-20', weightG: 250,
  remainingG: 250, category: 'coffee', archived: false, createdAt: T, updatedAt: T, ...over,
})
const brew = (id: string, over: Partial<Brew> = {}): Brew => ({
  id, brewedAt: '2026-11-05T01:00:00.000Z', method: 'v60', beanId: 'a', doseG: 15, waterG: 240, flavorTags: [],
  isBest: false, createdAt: T, updatedAt: T, ...over,
})

const beans = new Map([
  ['a', bean('a', 'Guji Natural', { origin: 'Ethiopia', roaster: 'Roast Co' })],
  ['b', bean('b', 'Doi Chang', { origin: 'Thailand', roaster: 'Hill Roasters', variety: 'Catimor' })],
])
const labels = { method: (m: string) => (m === 'v60' ? 'V60' : 'Espresso'), flavorTag: (c: string) => (c === 'citrus' ? 'ส้ม / ซิตรัส' : c) }

const all: Brew[] = [
  brew('1', { rating: 5, isBest: true, flavorTags: ['citrus'], notes: 'หอมดอกไม้' }),
  brew('2', { beanId: 'b', method: 'espresso', rating: 3, brewedAt: '2026-10-01T01:00:00.000Z' }),
  brew('3', { beanId: 'b' }),
]
const ids = (bs: Brew[]) => bs.map((b) => b.id)

describe('filterBrews', () => {
  it('ไม่มีตัวกรอง = ทั้งหมด (ลำดับเดิม)', () => {
    expect(ids(filterBrews(all, {}, beans))).toEqual(['1', '2', '3'])
  })

  it('กรองตามวิธีชง เมล็ด คะแนนขั้นต่ำ และสูตรที่ดีที่สุด', () => {
    expect(ids(filterBrews(all, { method: 'espresso' }, beans))).toEqual(['2'])
    expect(ids(filterBrews(all, { beanId: 'b' }, beans))).toEqual(['2', '3'])
    expect(ids(filterBrews(all, { bestOnly: true }, beans))).toEqual(['1'])
  })

  it('คะแนนขั้นต่ำ: ครั้งที่ยังไม่ให้คะแนนถูกกรองออก', () => {
    expect(ids(filterBrews(all, { minRating: 3 }, beans))).toEqual(['1', '2'])
    expect(ids(filterBrews(all, { minRating: 4 }, beans))).toEqual(['1'])
  })

  it('ช่วงเวลา: รวมเวลาเริ่มต้นพอดี', () => {
    expect(ids(filterBrews(all, { since: '2026-11-05T01:00:00.000Z' }, beans))).toEqual(['1', '3'])
  })

  it('ค้นหาข้อความ: ชื่อเมล็ด โรงคั่ว แหล่งปลูก สายพันธุ์ โน้ต (ไม่สนตัวพิมพ์)', () => {
    expect(ids(filterBrews(all, { text: 'guji' }, beans))).toEqual(['1'])
    expect(ids(filterBrews(all, { text: 'HILL' }, beans))).toEqual(['2', '3'])
    expect(ids(filterBrews(all, { text: 'thailand' }, beans))).toEqual(['2', '3'])
    expect(ids(filterBrews(all, { text: 'catimor' }, beans))).toEqual(['2', '3'])
    expect(ids(filterBrews(all, { text: 'ดอกไม้' }, beans))).toEqual(['1'])
  })

  it('ค้นหาจากป้ายภาษาไทยของวิธีชงและแท็กรสชาติเมื่อส่ง labels มา', () => {
    expect(ids(filterBrews(all, { text: 'ซิตรัส' }, beans, labels))).toEqual(['1'])
    expect(ids(filterBrews(all, { text: 'espresso' }, beans, labels))).toEqual(['2'])
    expect(ids(filterBrews(all, { text: 'ซิตรัส' }, beans))).toEqual([]) // ไม่มี labels = ค้นด้วยรหัสเท่านั้น
    expect(ids(filterBrews(all, { text: 'citrus' }, beans))).toEqual(['1'])
  })

  it('หลายคำ = ต้องเจอทุกคำ (AND) และรวมกับตัวกรองอื่นได้', () => {
    expect(ids(filterBrews(all, { text: 'doi espresso' }, beans, labels))).toEqual(['2'])
    expect(ids(filterBrews(all, { text: 'guji espresso' }, beans, labels))).toEqual([])
    expect(ids(filterBrews(all, { text: 'doi', minRating: 3 }, beans, labels))).toEqual(['2'])
  })

  it('เมล็ดที่ถูกลบไปแล้วยังค้นจากโน้ตและวิธีชงได้ ไม่ error', () => {
    const orphan = brew('9', { beanId: 'gone', notes: 'หวานมาก' })
    expect(ids(filterBrews([orphan], { text: 'หวาน' }, beans))).toEqual(['9'])
    expect(brewSearchText(orphan, undefined)).toContain('v60')
  })

  it('คำค้นว่าง/เว้นวรรคล้วน = ไม่กรอง', () => {
    expect(filterBrews(all, { text: '   ' }, beans)).toHaveLength(3)
  })
})

describe('isFilterActive / rangeStart', () => {
  it('ตรวจว่ามีตัวกรองใช้อยู่ (minRating = 0 ถือว่ากำหนดแล้ว)', () => {
    expect(isFilterActive({})).toBe(false)
    expect(isFilterActive({ text: '  ' })).toBe(false)
    expect(isFilterActive({ text: 'x' })).toBe(true)
    expect(isFilterActive({ bestOnly: true })).toBe(true)
    expect(isFilterActive({ minRating: 0 })).toBe(true)
  })

  it('preset ช่วงเวลา', () => {
    const now = new Date('2026-11-09T00:00:00.000Z')
    expect(rangeStart('all', now)).toBeUndefined()
    expect(rangeStart('7d', now)).toBe('2026-11-02T00:00:00.000Z')
    expect(rangeStart('30d', now)).toBe('2026-10-10T00:00:00.000Z')
    expect(rangeStart('90d', now)).toBe('2026-08-11T00:00:00.000Z')
  })
})
