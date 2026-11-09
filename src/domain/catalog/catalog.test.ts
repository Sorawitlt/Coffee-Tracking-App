import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { GEAR_TYPES, isValidGrindScale } from '../inventory'
import { METHODS } from '../types'
import { renderCatalogMarkdown } from './catalogDoc'
import {
  GEAR_MODELS,
  ORIGINS,
  VARIETIES,
  catalogBrands,
  compact,
  findOrigin,
  findVariety,
  gearModelName,
  getGearModel,
  grindGuideFor,
  originValue,
  searchGearModels,
  type CatalogSource,
} from './index'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const SOURCE_KINDS = ['manufacturer', 'institution', 'retailer', 'community']

function checkSources(id: string, sources: readonly CatalogSource[]) {
  expect(sources.length, `${id}: ต้องมีแหล่งอ้างอิง`).toBeGreaterThan(0)
  for (const src of sources) {
    expect(() => new URL(src.url), `${id}: URL ใช้ไม่ได้ ${src.url}`).not.toThrow()
    expect(new URL(src.url).protocol, `${id}: ต้องเป็น https ${src.url}`).toBe('https:')
    expect(SOURCE_KINDS, id).toContain(src.kind)
    expect(src.title.trim(), `${id}: ต้องมีชื่อแหล่ง`).not.toBe('')
    // ชื่อหลักแสดงในทุกภาษา → ต้องไม่มีอักษรไทย (ชื่อไทยใส่ titleLocal)
    expect(src.title, `${id}: title ต้องเป็นภาษาอังกฤษ`).not.toMatch(/[ก-๙]/)
  }
}

describe('ความถูกต้องของข้อมูลอุปกรณ์', () => {
  it('id ไม่ซ้ำ และเป็นตัวพิมพ์เล็ก-ขีด (คงที่ตลอดไป)', () => {
    const ids = GEAR_MODELS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('ทุกรุ่นมีแหล่งอ้างอิง https และวันที่ตรวจสอบ', () => {
    for (const m of GEAR_MODELS) {
      checkSources(m.id, m.sources)
      expect(m.verifiedAt, m.id).toMatch(ISO_DATE)
      expect(m.brand.trim(), m.id).not.toBe('')
      expect(m.model.trim(), m.id).not.toBe('')
      expect(GEAR_TYPES, m.id).toContain(m.type)
    }
  })

  it('สเกลเบอร์บดถูกต้อง และมีเฉพาะเครื่องบด', () => {
    for (const m of GEAR_MODELS) {
      if (!m.grindScale) continue
      expect(m.type, m.id).toBe('grinder')
      expect(isValidGrindScale(m.grindScale), m.id).toBe(true)
    }
  })

  it('สเกลจากชุมชนผู้ใช้ต้องมีแหล่งชุมชนและหมายเหตุกำกับ', () => {
    for (const m of GEAR_MODELS) {
      const flagged = m.notes?.includes('scaleFromCommunity') ?? false
      if (flagged) {
        expect(m.grindScale, m.id).toBeDefined()
        expect(m.sources.some((s) => s.kind === 'community'), m.id).toBe(true)
      }
    }
  })

  it('ช่วงที่ผู้ผลิตแนะนำ: ต้องมีแหล่งผู้ผลิต, อยู่ในสเกล, วิธีชงถูกต้อง', () => {
    for (const m of GEAR_MODELS) {
      for (const g of m.grindGuide ?? []) {
        expect(m.sources.some((s) => s.kind === 'manufacturer'), m.id).toBe(true)
        expect(g.min, m.id).toBeLessThanOrEqual(g.max)
        expect(g.methods.length, m.id).toBeGreaterThan(0)
        for (const method of g.methods) expect(METHODS, m.id).toContain(method)
        if (m.grindScale) {
          expect(g.min, m.id).toBeGreaterThanOrEqual(m.grindScale.min)
          expect(g.max, m.id).toBeLessThanOrEqual(m.grindScale.max)
        }
      }
    }
  })

  it('สเปกเป็นตัวเลขบวก ช่วงค่าถูกต้อง และอ้างรุ่นที่มีจริง', () => {
    const ids = new Set(GEAR_MODELS.map((m) => m.id))
    for (const m of GEAR_MODELS) {
      const sp = m.specs
      for (const n of [sp.burrMm, sp.settingsCount, sp.clicksPerRotation, sp.micronsPerClick, sp.basketMm, sp.pumpBar, sp.opvBar, sp.maxG, sp.resolutionG, sp.capacity?.value, sp.output?.value]) {
        if (n !== undefined) expect(n, m.id).toBeGreaterThan(0)
      }
      for (const r of [sp.doseG, sp.cups, sp.tempRangeC]) if (r) expect(r.min, m.id).toBeLessThanOrEqual(r.max)
      for (const method of sp.methods ?? []) expect(METHODS, m.id).toContain(method)
      for (const fit of sp.fits ?? []) expect(ids.has(fit), `${m.id} → ${fit}`).toBe(true)
      if (m.type === 'brewer') expect(sp.methods?.length, `${m.id}: อุปกรณ์ชงต้องบอกวิธีชง`).toBeGreaterThan(0)
    }
  })
})

describe('ความถูกต้องของข้อมูลเมล็ด', () => {
  it('สายพันธุ์: id ไม่ซ้ำ มีแหล่งอ้างอิง', () => {
    const ids = VARIETIES.map((v) => v.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const v of VARIETIES) {
      checkSources(v.id, v.sources)
      expect(v.verifiedAt).toMatch(ISO_DATE)
      expect(v.name).not.toMatch(/[ก-๙]/)
    }
  })

  it('แหล่งปลูก: id ไม่ซ้ำ รหัสประเทศ 2 ตัวอักษร มีแหล่งอ้างอิง', () => {
    const ids = ORIGINS.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const o of ORIGINS) {
      checkSources(o.id, o.sources)
      expect(o.country).toMatch(/^[A-Z]{2}$/)
      expect(originValue(o)).not.toMatch(/[ก-๙]/)
    }
  })
})

describe('ค้นหารุ่นอุปกรณ์', () => {
  it('อุปกรณ์ของผู้ใช้จริง: DF64 และ Flair 58 Plus 2 ค้นเจอได้หลายแบบ', () => {
    for (const q of ['DF64', 'df 64', 'DF-64', 'turin df64', 'df64 gen 2']) {
      expect(searchGearModels(q)[0]?.id, q).toBe('df-grinders-df64-gen-2')
    }
    for (const q of ['Flair 58 Plus 2', 'flair 58+ 2', 'flair58plus2']) {
      expect(searchGearModels(q)[0]?.id, q).toBe('flair-58-plus-2')
    }
  })

  it('ไม่สนตัวพิมพ์/วรรณยุกต์ละติน และทุกคำต้องตรง', () => {
    expect(searchGearModels('specialita').map((m) => m.id)).toContain('eureka-mignon-specialita')
    expect(searchGearModels('HARIO v60').every((m) => m.brand === 'Hario')).toBe(true)
    expect(searchGearModels('hario zzz')).toEqual([])
  })

  it('ตรงชื่อรุ่นเต็มมาก่อนตรงบางส่วน', () => {
    expect(searchGearModels('encore')[0]?.id).toBe('baratza-encore')
    expect(searchGearModels('encore esp')[0]?.id).toBe('baratza-encore-esp')
  })

  it('กรองตามชนิดและจำกัดจำนวน; คำค้นว่าง = ทั้งหมดของชนิดนั้น', () => {
    const grinders = searchGearModels('', { type: 'grinder' })
    expect(grinders.length).toBe(GEAR_MODELS.filter((m) => m.type === 'grinder').length)
    expect(grinders.every((m) => m.type === 'grinder')).toBe(true)
    expect(searchGearModels('', { limit: 3 })).toHaveLength(3)
  })

  it('getGearModel / gearModelName / catalogBrands', () => {
    expect(getGearModel('niche-zero')?.brand).toBe('Niche')
    expect(getGearModel('no-such-id')).toBeUndefined()
    expect(getGearModel(undefined)).toBeUndefined()
    expect(gearModelName(getGearModel('flair-58-plus-2')!)).toBe('Flair 58 Plus 2')
    expect(gearModelName(getGearModel('niche-zero')!)).toBe('Niche Zero')
    expect(gearModelName(getGearModel('df-grinders-df64-gen-2')!)).toBe('DF Grinders DF64 Gen 2')
    expect(catalogBrands('grinder')).toContain('DF Grinders')
    expect(new Set(catalogBrands()).size).toBe(catalogBrands().length)
  })

  it('grindGuideFor คืนช่วงตามวิธีชง', () => {
    const c40 = getGearModel('comandante-c40-mk4')
    expect(grindGuideFor(c40, 'espresso')).toMatchObject({ min: 7, max: 13 })
    expect(grindGuideFor(c40, 'v60')).toMatchObject({ min: 18, max: 35 })
    expect(grindGuideFor(c40, 'coldBrew')).toBeUndefined()
    expect(grindGuideFor(undefined, 'espresso')).toBeUndefined()
  })

  it('compact ตัดช่องว่าง/ขีด/วรรณยุกต์ละติน แต่คงอักษรไทย', () => {
    expect(compact('DF-64 Gen 2')).toBe('df64gen2')
    expect(compact('Specialità')).toBe('specialita')
    expect(compact('เชียงใหม่ 80')).toBe('เชียงใหม่80')
  })
})

describe('หาสายพันธุ์/แหล่งปลูกจากข้อความ', () => {
  it('ชื่อสากล ชื่อไทย และชื่ออื่น', () => {
    expect(findVariety('Gesha')?.id).toBe('geisha-panama')
    expect(findVariety('เชียงใหม่ 80')?.id).toBe('th-chiang-mai-80')
    expect(findVariety('chiang mai 80')?.id).toBe('th-chiang-mai-80')
    expect(findVariety('')).toBeUndefined()
    expect(findVariety('unknown')).toBeUndefined()
  })

  it('แหล่งปลูก: ค่าเต็มภาษาอังกฤษ หรือชื่อไทย', () => {
    expect(findOrigin('Thailand, Chiang Rai (Doi Chaang)')?.id).toBe('th-chiang-rai-doi-chaang')
    expect(findOrigin('ethiopia')?.id).toBe('et')
    expect(findOrigin('ชุมพร')?.id).toBe('th-chumphon')
    expect(findOrigin('Atlantis')).toBeUndefined()
  })
})

describe('เอกสาร docs/CATALOG.md', () => {
  const path = resolve(__dirname, '../../../docs/CATALOG.md')

  it('ตรงกับข้อมูลในโค้ด (อัปเดตด้วย UPDATE_CATALOG_DOC=1)', () => {
    const expected = renderCatalogMarkdown()
    if (process.env.UPDATE_CATALOG_DOC) writeFileSync(path, expected)
    expect(existsSync(path)).toBe(true)
    expect(readFileSync(path, 'utf8')).toBe(expected)
  })

  it('มีทุก id และทุก URL อ้างอิง', () => {
    const doc = renderCatalogMarkdown()
    for (const m of GEAR_MODELS) {
      expect(doc).toContain(m.id)
      for (const src of m.sources) expect(doc).toContain(src.url)
    }
    for (const x of [...VARIETIES, ...ORIGINS]) for (const src of x.sources) expect(doc).toContain(src.url)
  })
})
