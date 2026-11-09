import { bestRecipes, controlPoints, ratingSeries, ratingSummary } from './insights'
import type { Bean, Brew } from './types'

const T = '2026-11-01T00:00:00.000Z'
const bean = (id: string): Bean => ({
  id, name: id, roaster: 'R', origin: 'TH', roastLevel: 'light', roastDate: '2026-10-20', weightG: 250,
  remainingG: 250, category: 'coffee', archived: false, createdAt: T, updatedAt: T,
})
const brew = (id: string, over: Partial<Brew> = {}): Brew => ({
  id, brewedAt: '2026-11-05T01:00:00.000Z', method: 'v60', beanId: 'a', doseG: 15, waterG: 240, flavorTags: [],
  isBest: false, createdAt: T, updatedAt: T, ...over,
})
const day = (n: number) => `2026-11-${String(n).padStart(2, '0')}T01:00:00.000Z`

describe('ratingSeries / ratingSummary', () => {
  it('จุดคะแนนเรียงเก่า → ใหม่ เฉพาะที่ให้คะแนน', () => {
    const s = ratingSeries([brew('c', { rating: 4, brewedAt: day(3) }), brew('x'), brew('a', { rating: 2, brewedAt: day(1) })])
    expect(s.map((p) => p.id)).toEqual(['a', 'c'])
    expect(s.map((p) => p.rating)).toEqual([2, 4])
  })

  it('ไม่มีคะแนน → ไม่มีค่าเฉลี่ย/แนวโน้ม', () => {
    expect(ratingSummary([brew('x')])).toEqual({ total: 1, rated: 0 })
    expect(ratingSummary([])).toEqual({ total: 0, rated: 0 })
  })

  it('ค่าเฉลี่ยปัด 1 ตำแหน่ง; ต่ำกว่า 4 ครั้งยังไม่มีแนวโน้ม', () => {
    const s = ratingSummary([brew('1', { rating: 5, brewedAt: day(1) }), brew('2', { rating: 4, brewedAt: day(2) }), brew('3', { rating: 4, brewedAt: day(3) })])
    expect(s.average).toBe(4.3)
    expect(s.trend).toBeUndefined()
  })

  it('แนวโน้ม: เทียบ N ครั้งล่าสุดกับ N ครั้งก่อนหน้า (N = ครึ่งหนึ่ง สูงสุด 5)', () => {
    const ratings = [2, 3, 4, 5]
    const s = ratingSummary(ratings.map((r, i) => brew(String(i), { rating: r as 2 | 3 | 4 | 5, brewedAt: day(i + 1) })))
    expect(s.trend).toEqual({ size: 2, recent: 4.5, previous: 2.5, delta: 2 })

    const twelve = Array.from({ length: 12 }, (_, i) => brew(String(i), { rating: (i < 7 ? 3 : 4) as 3 | 4, brewedAt: day(i + 1) }))
    const t = ratingSummary(twelve).trend!
    expect(t.size).toBe(5)
    // ล่าสุด 5 ครั้ง = 4,4,4,4,4 · 5 ครั้งก่อนหน้า = 3,3,3,3,3 (2 ครั้งแรกสุดไม่ถูกนับ)
    expect(t).toEqual({ size: 5, recent: 4, previous: 3, delta: 1 })
  })

  it('ลำดับการให้คะแนนไม่ขึ้นกับลำดับอินพุต', () => {
    const a = [brew('1', { rating: 1, brewedAt: day(1) }), brew('2', { rating: 1, brewedAt: day(2) }), brew('3', { rating: 5, brewedAt: day(3) }), brew('4', { rating: 5, brewedAt: day(4) })]
    expect(ratingSummary([...a].reverse()).trend?.delta).toBe(4)
  })
})

describe('controlPoints (TDS × EY)', () => {
  const beans = new Map([['a', bean('a')]])

  it('คำนวณ EY จากน้ำหนักเครื่องดื่มที่ชั่งจริง และจัดสถานะเทียบช่วง SCA', () => {
    // V60: yield 225 g × TDS 1.35% ÷ 15 g = 20.25% → ok/ok
    const [p] = controlPoints([brew('1', { tds: 1.35, yieldG: 225 })], beans, 'filter')
    expect(p).toMatchObject({ tds: 1.35, ey: 20.3, tdsStatus: 'ok', eyStatus: 'ok', inRange: true })
  })

  it('ไม่ได้ชั่งจริง → ประมาณจากสูตร (น้ำ − กาแฟ×2)', () => {
    // (240 − 30) × 1.3 ÷ 15 = 18.2
    const [p] = controlPoints([brew('1', { tds: 1.3 })], beans, 'filter')
    expect(p.ey).toBe(18.2)
  })

  it('สกัดน้อย + จืด → low/low ไม่อยู่ในกรอบ', () => {
    const [p] = controlPoints([brew('1', { tds: 1.0, yieldG: 220 })], beans, 'filter')
    expect(p).toMatchObject({ tdsStatus: 'low', eyStatus: 'low', inRange: false })
  })

  it('แยก family: Espresso ใช้ช่วง TDS 8–12%; กรองแล้วไม่ปนกัน', () => {
    const brews = [
      brew('f', { tds: 1.3, yieldG: 225 }),
      brew('e', { method: 'espresso', doseG: 18, waterG: 36, yieldG: 36, tds: 9 }),
    ]
    expect(controlPoints(brews, beans, 'filter').map((p) => p.id)).toEqual(['f'])
    const [e] = controlPoints(brews, beans, 'espresso')
    expect(e).toMatchObject({ id: 'e', ey: 18, tdsStatus: 'ok', eyStatus: 'ok', inRange: true })
  })

  it('ข้ามการชงที่ไม่มี TDS และวิธีที่ไม่มีมาตรฐาน (Cold brew, Moka)', () => {
    const brews = [
      brew('none'), brew('cold', { method: 'coldBrew', tds: 1.5 }), brew('moka', { method: 'moka', tds: 3 }),
    ]
    expect(controlPoints(brews, beans, 'filter')).toEqual([])
    expect(controlPoints(brews, beans, 'espresso')).toEqual([])
  })

  it('เรียงเก่า → ใหม่', () => {
    const ps = controlPoints([brew('new', { tds: 1.3, brewedAt: day(5) }), brew('old', { tds: 1.3, brewedAt: day(1) })], beans, 'filter')
    expect(ps.map((p) => p.id)).toEqual(['old', 'new'])
  })
})

describe('bestRecipes', () => {
  it('ติดดาวไว้ = ใช้ตามนั้น (แม้มีครั้งอื่นที่คะแนนสูงกว่า)', () => {
    const r = bestRecipes([brew('s', { isBest: true, rating: 4 }), brew('top', { rating: 5, brewedAt: day(9) })])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ starred: true, brew: { id: 's' } })
  })

  it('ไม่ติดดาว = คะแนนสูงสุด เสมอกันเอาล่าสุด; ไม่มีคะแนนเลย = ไม่แสดง', () => {
    const r = bestRecipes([
      brew('old5', { rating: 5, brewedAt: day(1) }),
      brew('new5', { rating: 5, brewedAt: day(2) }),
      brew('four', { rating: 4, brewedAt: day(3) }),
      brew('unrated', { beanId: 'z' }),
    ])
    expect(r.map((x) => [x.brew.id, x.starred])).toEqual([['new5', false]])
  })

  it('แยกกลุ่มตามเมล็ด + วิธีชง และเรียงใหม่ก่อน', () => {
    const r = bestRecipes([
      brew('v-a', { rating: 4, brewedAt: day(1) }),
      brew('e-a', { method: 'espresso', rating: 3, brewedAt: day(5) }),
      brew('v-b', { beanId: 'b', rating: 5, brewedAt: day(3) }),
    ])
    expect(r.map((x) => x.brew.id)).toEqual(['e-a', 'v-b', 'v-a'])
  })
})
