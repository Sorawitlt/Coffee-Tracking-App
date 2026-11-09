import { FLAVOR_GROUPS, FLAVOR_TAGS, isFlavorTag, toggleFlavorTag } from './flavors'

describe('แท็กรสชาติ', () => {
  it('ทุกแท็กไม่ซ้ำกัน และอยู่กลุ่มเดียว', () => {
    expect(new Set(FLAVOR_TAGS).size).toBe(FLAVOR_TAGS.length)
    expect(FLAVOR_TAGS).toHaveLength(FLAVOR_GROUPS.reduce((n, g) => n + g.tags.length, 0))
  })

  it('isFlavorTag รู้จักเฉพาะรหัสในรายการ', () => {
    expect(isFlavorTag('citrus')).toBe(true)
    expect(isFlavorTag('ส้ม')).toBe(false)
  })

  it('toggleFlavorTag เพิ่ม/เอาออกโดยไม่แตะรหัสอื่น (รวมรหัสที่ไม่รู้จัก) และไม่เพิ่มซ้ำ', () => {
    const tags = ['legacy-tag', 'citrus']
    expect(toggleFlavorTag(tags, 'honey')).toEqual(['legacy-tag', 'citrus', 'honey'])
    expect(toggleFlavorTag(tags, 'citrus')).toEqual(['legacy-tag'])
    expect(toggleFlavorTag(toggleFlavorTag(tags, 'honey'), 'honey')).toEqual(tags)
    expect(tags).toEqual(['legacy-tag', 'citrus']) // ไม่แก้อาร์เรย์เดิม
  })
})
