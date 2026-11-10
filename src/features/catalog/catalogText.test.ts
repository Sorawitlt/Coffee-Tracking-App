import { getGearModel, type CatalogSource } from '../../domain/catalog'
import { createT } from '../../i18n'
import { capacityText, grindGuideRows, rangeText, sourceTitle, specRows } from './catalogText'

describe('ข้อความสเปก', () => {
  it('ความจุคงหน่วยของผู้ผลิตไว้ก่อน และประมาณ ml เมื่อเป็น oz', () => {
    expect(capacityText({ value: 30, unit: 'oz' })).toBe('30 oz (≈ 887 ml)')
    expect(capacityText({ value: 0.9, unit: 'l' })).toBe('0.9 L')
    expect(capacityText({ value: 90, unit: 'ml' })).toBe('90 ml')
  })

  it('ช่วงค่าเท่ากัน → ค่าเดียว', () => {
    expect(rangeText({ min: 16, max: 20 }, 'g')).toBe('16–20 g')
    expect(rangeText({ min: 18, max: 18 }, 'g')).toBe('18 g')
  })

  it('specRows: แสดงเฉพาะค่าที่มี และแปลตามภาษา', () => {
    const flair = getGearModel('flair-58-plus-2')!
    const en = specRows(flair, createT('en'))
    expect(en).toContainEqual({ label: 'Dose', value: '16–20 g' })
    expect(en).toContainEqual({ label: 'Basket', value: '58 mm' })
    expect(en).toContainEqual({ label: 'Features', value: 'Pressure gauge, Electric preheat base' })
    expect(en.find((r) => r.label === 'Burrs')).toBeUndefined()
    for (const row of en) expect(`${row.label} ${row.value}`).not.toMatch(/[ก-๙]/)

    const th = specRows(getGearModel('df-grinders-df64-gen-2')!)
    expect(th).toContainEqual({ label: 'เฟืองบด', value: 'แบน (Flat) · 64 mm' })
    expect(th).toContainEqual({ label: 'สเกลเบอร์บดในแอป', value: '0–90 (ขั้นละ 0.5)' })
  })

  it('ฟิลเตอร์แสดงชื่อรุ่นที่ใช้ร่วมกันได้', () => {
    expect(specRows(getGearModel('kalita-wave-185-filter')!, createT('en'))).toContainEqual({
      label: 'Fits', value: 'Kalita Wave 185 Stainless Steel Dripper, Kalita Wave 185 Glass Dripper',
    })
  })

  it('grindGuideRows ใช้ชื่อวิธีชง', () => {
    expect(grindGuideRows(getGearModel('comandante-c40-mk4')!)[0]).toEqual({ label: 'Espresso', value: '7–13' })
  })

  it('ชื่อแหล่งอ้างอิง: ไทยใช้ชื่อต้นฉบับถ้ามี อังกฤษใช้ชื่ออังกฤษเสมอ', () => {
    const src: CatalogSource = { kind: 'institution', url: 'https://x.test', title: 'DOA — Chumphon 2', titleLocal: 'กรมวิชาการเกษตร — ชุมพร 2' }
    expect(sourceTitle(src, 'th')).toBe('กรมวิชาการเกษตร — ชุมพร 2')
    expect(sourceTitle(src, 'en')).toBe('DOA — Chumphon 2')
    expect(sourceTitle({ ...src, titleLocal: undefined }, 'th')).toBe('DOA — Chumphon 2')
  })
})
