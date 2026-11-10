import { originOptions, roasterOptions, varietyOptions } from './beanSuggest'

describe('คำแนะนำฟอร์มเมล็ด', () => {
  it('โรงคั่ว: ไม่ซ้ำแบบไม่สนตัวพิมพ์ ใช้ตัวสะกดล่าสุด ข้ามค่าว่าง เรียงตามตัวอักษร', () => {
    const out = roasterOptions([
      { roaster: 'roots', updatedAt: '2026-01-01' },
      { roaster: 'Roots ', updatedAt: '2026-02-01' },
      { roaster: '  ', updatedAt: '2026-03-01' },
      { roaster: 'Akha Ama', updatedAt: '2026-01-05' },
    ])
    expect(out).toEqual([{ value: 'Akha Ama' }, { value: 'Roots' }])
  })

  it('ค่าที่ใส่ลงช่องเป็นอังกฤษเสมอ; ภาษาไทยมีป้ายชื่อไทยช่วยอ่าน', () => {
    const th = varietyOptions('th').find((o) => o.value === 'Chiang Mai 80')
    expect(th).toEqual({ value: 'Chiang Mai 80', label: 'เชียงใหม่ 80' })
    expect(varietyOptions('en').find((o) => o.value === 'Chiang Mai 80')).toEqual({ value: 'Chiang Mai 80', label: undefined })
    expect(originOptions('th')).toContainEqual({ value: 'Thailand, Chiang Rai (Doi Tung)', label: 'เชียงราย (ดอยตุง)' })
    for (const o of [...originOptions('en'), ...varietyOptions('en')]) {
      expect(o.value).not.toMatch(/[ก-๙]/)
      expect(o.label).toBeUndefined()
    }
  })
})
