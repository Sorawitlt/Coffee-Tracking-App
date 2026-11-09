import { beansToCsv, brewsToCsv, toLocalDateTime } from './export'
import type { Bean, Brew, Gear } from './types'

const T = '2026-11-01T00:00:00.000Z'

const bean: Bean = {
  id: 'bean-1', name: 'Ethiopia Guji', roaster: 'Roast, Co', origin: 'Ethiopia', roastLevel: 'light',
  roastDate: '2026-10-30', weightG: 250, remainingG: 235, priceTotal: 500, currency: 'THB',
  category: 'coffee', archived: false, createdAt: T, updatedAt: T,
}

const grinder: Gear = { id: 'g-1', type: 'grinder', name: 'Comandante', createdAt: T, updatedAt: T }

function brew(over: Partial<Brew> = {}): Brew {
  return {
    id: 'b-1', brewedAt: new Date(2026, 10, 9, 8, 30).toISOString(), method: 'v60', beanId: 'bean-1',
    doseG: 15, waterG: 240, flavorTags: [], isBest: false, createdAt: T, updatedAt: T, ...over,
  }
}

/** แยกไฟล์ CSV ที่ไม่มีช่องที่มีขึ้นบรรทัดใหม่ → { หัวคอลัมน์: ค่า } ต่อแถว */
function rows(csv: string): Record<string, string>[] {
  const [head, ...body] = csv.replace('﻿', '').trim().split('\r\n')
  const keys = head.split(',')
  return body.map((line) => {
    // ช่องที่ครอบด้วย " และมี , ข้างใน
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.filter((_, i, a) => i < a.length - 1 || a[i] !== '')
    return Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? '').replace(/,$/, '').replace(/^"|"$/g, '').replaceAll('""', '"')]))
  })
}

describe('toLocalDateTime', () => {
  it('แปลง ISO เป็น YYYY-MM-DD HH:mm ตามเวลาท้องถิ่น', () => {
    expect(toLocalDateTime(new Date(2026, 10, 9, 8, 5).toISOString())).toBe('2026-11-09 08:05')
  })
  it('อ่านไม่ได้ → ว่าง', () => {
    expect(toLocalDateTime('ไม่ใช่วันที่')).toBe('')
  })
})

describe('brewsToCsv', () => {
  it('มีหัวคอลัมน์ภาษาอังกฤษที่ระบุหน่วย และ BOM', () => {
    const csv = brewsToCsv([], [], [])
    expect(csv.startsWith('﻿')).toBe(true)
    const head = csv.replace('﻿', '').trim().split(',')
    for (const h of ['brewed_at', 'method', 'dose_g', 'water_g', 'ratio_1_to_x', 'temp_c', 'tds_pct', 'ey_pct', 'rating', 'cost_per_cup']) {
      expect(head).toContain(h)
    }
  })

  it('ค่าที่คำนวณได้ (ratio, วันหลังคั่ว, ต้นทุนต่อแก้ว) ตรงกับสูตรกลาง', () => {
    const [r] = rows(brewsToCsv([brew({ grinderId: 'g-1' })], [bean], [grinder]))
    expect(r.brewed_at).toBe('2026-11-09 08:30')
    expect(r.method).toBe('v60')
    expect(r.bean_name).toBe('Ethiopia Guji')
    expect(r.roaster).toBe('Roast, Co') // ช่องที่มี , ถูกครอบด้วย "
    expect(r.days_off_roast).toBe('10') // 30 ต.ค. → 9 พ.ย.
    expect(r.grinder).toBe('Comandante')
    expect(r.ratio_1_to_x).toBe('16')
    expect(r.beverage_g).toBe('210') // 240 − 15×2
    expect(r.beverage_estimated).toBe('TRUE')
    expect(r.cost_per_cup).toBe('30') // 500 ÷ 250 × 15
    expect(r.currency).toBe('THB')
  })

  it('คำนวณ EY จาก TDS และน้ำหนักที่ชั่งจริง', () => {
    const [r] = rows(brewsToCsv([brew({ tds: 1.4, yieldG: 200 })], [bean], []))
    expect(r.beverage_estimated).toBe('FALSE')
    expect(r.ey_pct).toBe('18.67') // 200 × 1.4 ÷ 15
  })

  it('ฟิลด์ตัวเลือกที่ไม่มีค่า → ช่องว่าง; เมล็ดไม่พบ → ช่องเมล็ดว่าง ไม่ error', () => {
    const [r] = rows(brewsToCsv([brew({ beanId: 'หายไป' })], [bean], []))
    expect(r.bean_name).toBe('')
    expect(r.temp_c).toBe('')
    expect(r.rating).toBe('')
    expect(r.cost_per_cup).toBe('')
    expect(r.currency).toBe('')
  })

  it('แท็กรสชาติ = รหัสคั่นด้วย ; และโน้ตที่ขึ้นต้นด้วยเครื่องหมายสูตรถูกป้องกัน', () => {
    const csv = brewsToCsv([brew({ flavorTags: ['citrus', 'floral'], notes: '=1+1', rating: 4, balance: -1 })], [bean], [])
    expect(csv).toContain('citrus;floral')
    expect(csv).toContain("'=1+1")
    const [r] = rows(csv)
    expect(r.rating).toBe('4')
    expect(r.balance).toBe('-1') // ตัวเลขติดลบไม่ถูกนำหน้าด้วย '
  })

  it('เรียงจากเก่า → ใหม่ โดยไม่แก้ array ที่ส่งเข้ามา', () => {
    const newer = brew({ id: 'new', brewedAt: new Date(2026, 10, 9, 9).toISOString() })
    const older = brew({ id: 'old', brewedAt: new Date(2026, 10, 8, 9).toISOString() })
    const input = [newer, older]
    expect(rows(brewsToCsv(input, [bean], [])).map((r) => r.brew_id)).toEqual(['old', 'new'])
    expect(input[0]).toBe(newer)
  })
})

describe('beansToCsv', () => {
  it('ส่งออกคงเหลือ ≥ 0 และเรียงตามวันที่คั่วล่าสุดก่อน', () => {
    const over = { ...bean, id: 'bean-2', name: 'Kenya', roastDate: '2026-11-05', remainingG: -12.5 }
    const out = rows(beansToCsv([bean, over]))
    expect(out.map((r) => r.name)).toEqual(['Kenya', 'Ethiopia Guji'])
    expect(out[0].remaining_g).toBe('0')
    expect(out[1].remaining_g).toBe('235')
    expect(out[1].archived).toBe('FALSE')
  })
})
