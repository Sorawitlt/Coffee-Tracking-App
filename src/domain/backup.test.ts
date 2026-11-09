import {
  BACKUP_APP, BACKUP_FORMAT_VERSION, BACKUP_INTERVAL_DAYS, backupCounts, backupReminder, buildBackup, parseBackup,
  type BackupFile, type BackupSource,
} from './backup'
import { DEFAULT_RECIPES } from './recipes'
import type { Bean, Brew, Gear, Recipe, Settings } from './types'

const T = '2026-11-01T00:00:00.000Z'

const bean: Bean = {
  id: 'bean-1', name: 'Ethiopia Guji', roaster: 'Roast Co', origin: 'Ethiopia', variety: 'Heirloom', process: 'natural',
  roastLevel: 'light', roastDate: '2026-10-30', weightG: 250, remainingG: -3.5, priceTotal: 500, currency: 'THB',
  category: 'coffee', notes: 'หอมดอกไม้', archived: false, createdAt: T, updatedAt: T,
}

const grinder: Gear = {
  id: 'g-1', type: 'grinder', name: 'Comandante', grindScale: { min: 0, max: 40, step: 1 }, notes: 'ใหม่', createdAt: T, updatedAt: T,
}

const myRecipe: Recipe = {
  id: 'r-1', name: 'V60 ของฉัน', method: 'v60', category: 'coffee', isDefault: false, doseG: 15, waterG: 240, tempC: 93,
  grindHint: 'mediumFine', totalTimeSec: 180,
  steps: [{ atSec: 0, action: 'bloom', targetWaterG: 45 }, { atSec: 45, action: 'custom', label: 'คนเบา ๆ' }],
  createdAt: T, updatedAt: T,
}

const fullBrew: Brew = {
  id: 'b-1', brewedAt: '2026-11-09T01:30:00.000Z', method: 'v60', beanId: 'bean-1', recipeId: 'r-1', grinderId: 'g-1', brewerId: 'gone',
  doseG: 15, waterG: 240, yieldG: 205, grindSetting: 21, tempC: 93, bloomSec: 45, totalTimeSec: 175, tds: 1.35,
  rating: 4, balance: -1, body: 0, sweetness: 3, sourAndBitter: false, flavorTags: ['citrus', 'floral'], notes: 'อร่อย', isBest: true,
  advice: {
    kind: 'underExtracted',
    adjustment: { variable: 'grind', direction: 'finer', steps: 1, from: 21, to: 20 },
    alternatives: [{ variable: 'temp', deltaC: 2, from: 93, to: 95 }, { variable: 'technique' }],
    notes: ['beanTooFresh'],
  },
  createdAt: T, updatedAt: T,
}

const minimalBrew: Brew = {
  id: 'b-2', brewedAt: '2026-11-09T02:00:00.000Z', method: 'espresso', beanId: 'bean-1', doseG: 18, waterG: 36,
  flavorTags: [], isBest: false, createdAt: T, updatedAt: T,
}

const settings: Settings = {
  id: 'app', language: 'en', units: 'imperial', theme: 'dark', defaultMethod: 'espresso', lastBackupAt: '2026-10-01T00:00:00.000Z',
}

const source: BackupSource = {
  beans: [bean], gear: [grinder], recipes: [...DEFAULT_RECIPES, myRecipe], brews: [fullBrew, minimalBrew], settings,
}

const EXPORTED_AT = '2026-11-09T03:00:00.000Z'

/** ไฟล์สำรองที่ถูกต้อง → JSON ที่แก้ไขได้ (deep clone) */
function file(): { app: unknown; formatVersion: unknown; exportedAt: unknown; data: Record<string, any> } {
  return JSON.parse(JSON.stringify(buildBackup(source, EXPORTED_AT)))
}

const parse = (f: unknown) => parseBackup(JSON.stringify(f))

describe('buildBackup', () => {
  it('ใส่ตัวระบุแอป เวอร์ชันฟอร์แมต และเวลาที่สำรอง', () => {
    const b = buildBackup(source, EXPORTED_AT)
    expect(b.app).toBe(BACKUP_APP)
    expect(b.formatVersion).toBe(BACKUP_FORMAT_VERSION)
    expect(b.exportedAt).toBe(EXPORTED_AT)
  })

  it('ไม่ใส่สูตรตั้งต้น และไม่ใส่ lastBackupAt / id ของ Settings', () => {
    const b = buildBackup(source, EXPORTED_AT)
    expect(b.data.recipes).toEqual([myRecipe])
    expect(b.data.settings).toEqual({ language: 'en', units: 'imperial', theme: 'dark', defaultMethod: 'espresso' })
  })

  it('ไม่แก้ข้อมูลต้นฉบับ', () => {
    const before = JSON.stringify(source)
    buildBackup(source, EXPORTED_AT)
    expect(JSON.stringify(source)).toBe(before)
  })
})

describe('parseBackup — ไฟล์ที่ถูกต้อง', () => {
  it('Round-trip: สำรอง → อ่านกลับ ได้ข้อมูลเหมือนเดิมทุกฟิลด์', () => {
    const result = parseBackup(JSON.stringify(buildBackup(source, EXPORTED_AT)))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.beans).toEqual([bean])
    expect(result.backup.gear).toEqual([grinder])
    expect(result.backup.recipes).toEqual([myRecipe])
    expect(result.backup.brews).toEqual([fullBrew, minimalBrew])
    expect(result.backup.settings).toEqual({ language: 'en', units: 'imperial', theme: 'dark', defaultMethod: 'espresso' })
    expect(result.backup.exportedAt).toBe(EXPORTED_AT)
  })

  it('ข้อมูลว่างเปล่าที่ถูกต้อง → อ่านได้ (Restore แล้วได้ฐานข้อมูลว่าง)', () => {
    const f = file()
    f.data = { beans: [], gear: [], recipes: [], brews: [] }
    const result = parse(f)
    expect(result.ok).toBe(true)
    if (result.ok) expect(backupCounts(result.backup)).toEqual({ beans: 0, gear: 0, recipes: 0, brews: 0 })
  })

  it('คงเหลือติดลบได้, อุปกรณ์ที่ถูกลบ (brewerId ไม่มีในไฟล์) ไม่ใช่ข้อผิดพลาด', () => {
    const result = parse(file())
    expect(result.ok).toBe(true)
  })

  it('สูตรตั้งต้นในไฟล์ถูกข้าม', () => {
    const f = file()
    f.data.recipes.push(JSON.parse(JSON.stringify(DEFAULT_RECIPES[0])))
    const result = parse(f)
    expect(result.ok && result.backup.recipes.map((r) => r.id)).toEqual(['r-1'])
  })

  it('ไม่มี settings ในไฟล์ → ได้ค่าว่าง (ใช้ค่าเริ่มต้นตอน Restore)', () => {
    const f = file()
    delete f.data.settings
    const result = parse(f)
    expect(result.ok && result.backup.settings).toEqual({})
  })

  it('ค่าตั้งที่ผิดบางตัว → ข้ามเฉพาะตัวนั้น ไม่ปฏิเสธทั้งไฟล์', () => {
    const f = file()
    f.data.settings = { language: 'fr', units: 'metric', theme: 123, defaultMethod: 'v60' }
    const result = parse(f)
    expect(result.ok && result.backup.settings).toEqual({ units: 'metric', defaultMethod: 'v60' })
  })

  it('ฟิลด์ที่ไม่รู้จักถูกทิ้ง ไม่ปนเข้าฐานข้อมูล', () => {
    const f = file()
    f.data.beans[0].hacked = 'x'
    f.data.brews[0].extra = { a: 1 }
    f.data.recipes[0].steps[0].junk = true
    f.data.gear[0].grindScale.other = 1
    const result = parse(f)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.backup.beans[0]).toEqual(bean)
    expect(result.backup.brews[0]).toEqual(fullBrew)
    expect(result.backup.recipes[0]).toEqual(myRecipe)
    expect(result.backup.gear[0]).toEqual(grinder)
  })

  it('ฟิลด์ตัวเลือกเป็น null → ถือว่าไม่มีค่า', () => {
    const f = file()
    f.data.beans[0].variety = null
    f.data.brews[1].tempC = null
    const result = parse(f)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect('variety' in result.backup.beans[0]).toBe(false)
      expect('tempC' in result.backup.brews[1]).toBe(false)
    }
  })

  it('ไฟล์เก่าที่ไม่มี flavorTags / isBest → เติม [] / false', () => {
    const f = file()
    delete f.data.brews[1].flavorTags
    delete f.data.brews[1].isBest
    const result = parse(f)
    expect(result.ok && result.backup.brews[1].flavorTags).toEqual([])
    expect(result.ok && result.backup.brews[1].isBest).toBe(false)
  })

  it('คำแนะนำที่รูปแบบผิด → ทิ้งคำแนะนำ แต่ยังนำเข้าการชงได้', () => {
    for (const bad of [{ kind: 'nope', alternatives: [], notes: [] }, 'text', { kind: 'best', alternatives: [{ variable: 'grind' }], notes: [] }]) {
      const f = file()
      f.data.brews[0].advice = bad
      const result = parse(f)
      expect(result.ok).toBe(true)
      if (result.ok) expect('advice' in result.backup.brews[0]).toBe(false)
    }
  })
})

describe('parseBackup — ไฟล์ที่ต้องปฏิเสธ', () => {
  it('ไม่ใช่ JSON', () => {
    expect(parseBackup('not json {')).toEqual({ ok: false, error: { code: 'notJson' } })
    expect(parseBackup('')).toEqual({ ok: false, error: { code: 'notJson' } })
  })

  it('JSON ที่ไม่ใช่ไฟล์สำรองของแอปนี้', () => {
    for (const v of [null, [], 42, 'x', {}, { app: 'other-app', formatVersion: 1, exportedAt: EXPORTED_AT, data: {} }]) {
      expect(parse(v)).toEqual({ ok: false, error: { code: 'notBackup' } })
    }
    const noVersion = file()
    delete noVersion.formatVersion
    expect(parse(noVersion)).toEqual({ ok: false, error: { code: 'notBackup' } })
    const zero = file()
    zero.formatVersion = 0
    expect(parse(zero)).toEqual({ ok: false, error: { code: 'notBackup' } })
    const badDate = file()
    badDate.exportedAt = 'เมื่อวาน'
    expect(parse(badDate)).toEqual({ ok: false, error: { code: 'notBackup' } })
  })

  it('ไฟล์จากเวอร์ชันใหม่กว่า', () => {
    const f = file()
    f.formatVersion = BACKUP_FORMAT_VERSION + 1
    expect(parse(f)).toEqual({ ok: false, error: { code: 'newerVersion', version: BACKUP_FORMAT_VERSION + 1 } })
  })

  it('ตารางหาย', () => {
    for (const table of ['beans', 'gear', 'recipes', 'brews'] as const) {
      const f = file()
      delete f.data[table]
      expect(parse(f)).toEqual({ ok: false, error: { code: 'missingTable', table } })
    }
    const notArray = file()
    notArray.data.beans = {}
    expect(parse(notArray)).toEqual({ ok: false, error: { code: 'missingTable', table: 'beans' } })
  })

  const invalid: [string, (f: ReturnType<typeof file>) => void, { table: string; index: number; field: string }][] = [
    ['ชื่อเมล็ดไม่ใช่ข้อความ', (f) => (f.data.beans[0].name = 5), { table: 'beans', index: 0, field: 'name' }],
    ['น้ำหนักถุงเป็นข้อความ', (f) => (f.data.beans[0].weightG = '250'), { table: 'beans', index: 0, field: 'weightG' }],
    ['น้ำหนักถุง ≤ 0', (f) => (f.data.beans[0].weightG = 0), { table: 'beans', index: 0, field: 'weightG' }],
    ['ระดับคั่วไม่รู้จัก', (f) => (f.data.beans[0].roastLevel = 'burnt'), { table: 'beans', index: 0, field: 'roastLevel' }],
    ['วันที่คั่วไม่มีจริง (30 ก.พ.)', (f) => (f.data.beans[0].roastDate = '2026-02-30'), { table: 'beans', index: 0, field: 'roastDate' }],
    ['วันที่คั่วรูปแบบผิด', (f) => (f.data.beans[0].roastDate = '9/11/2026'), { table: 'beans', index: 0, field: 'roastDate' }],
    ['archived ขาด', (f) => delete f.data.beans[0].archived, { table: 'beans', index: 0, field: 'archived' }],
    ['เวลาสร้างอ่านไม่ได้', (f) => (f.data.beans[0].createdAt = 'x'), { table: 'beans', index: 0, field: 'createdAt' }],
    ['ชนิดอุปกรณ์ไม่รู้จัก', (f) => (f.data.gear[0].type = 'robot'), { table: 'gear', index: 0, field: 'type' }],
    ['สเกลเบอร์บดไม่ครบ', (f) => (f.data.gear[0].grindScale = { min: 0 }), { table: 'gear', index: 0, field: 'grindScale' }],
    ['ขั้นตอนสูตรใช้ action ที่ไม่รู้จัก', (f) => (f.data.recipes[0].steps[0].action = 'dance'), { table: 'recipes', index: 0, field: 'steps' }],
    ['steps ไม่ใช่ array', (f) => (f.data.recipes[0].steps = 'x'), { table: 'recipes', index: 0, field: 'steps' }],
    ['วิธีชงไม่รู้จัก', (f) => (f.data.brews[0].method = 'siphon'), { table: 'brews', index: 0, field: 'method' }],
    ['กาแฟ 0 g', (f) => (f.data.brews[0].doseG = 0), { table: 'brews', index: 0, field: 'doseG' }],
    ['คะแนน 6 ดาว', (f) => (f.data.brews[0].rating = 6), { table: 'brews', index: 0, field: 'rating' }],
    ['คะแนนทศนิยม', (f) => (f.data.brews[0].rating = 3.5), { table: 'brews', index: 0, field: 'rating' }],
    ['balance เกินช่วง', (f) => (f.data.brews[1].balance = 3), { table: 'brews', index: 1, field: 'balance' }],
    ['ความหวานเกินช่วง', (f) => (f.data.brews[0].sweetness = 5), { table: 'brews', index: 0, field: 'sweetness' }],
    ['flavorTags มีตัวที่ไม่ใช่ข้อความ', (f) => (f.data.brews[0].flavorTags = ['citrus', 1]), { table: 'brews', index: 0, field: 'flavorTags' }],
    ['TDS ติดลบ', (f) => (f.data.brews[0].tds = -1), { table: 'brews', index: 0, field: 'tds' }],
    ['ระเบียนไม่ใช่ object', (f) => (f.data.brews[1] = 'x'), { table: 'brews', index: 1, field: '(record)' }],
    ['id ว่าง', (f) => (f.data.beans[0].id = ''), { table: 'beans', index: 0, field: 'id' }],
  ]

  it.each(invalid)('ระเบียนผิด: %s', (_name, mutate, expected) => {
    const f = file()
    mutate(f)
    expect(parse(f)).toEqual({ ok: false, error: { code: 'invalidRecord', ...expected } })
  })

  it('รหัสซ้ำในตารางเดียวกัน', () => {
    const f = file()
    f.data.brews[1].id = f.data.brews[0].id
    expect(parse(f)).toEqual({ ok: false, error: { code: 'duplicateId', table: 'brews', id: 'b-1' } })
  })

  it('บันทึกการชงอ้างถึงเมล็ดที่ไม่มีในไฟล์', () => {
    const f = file()
    f.data.brews[1].beanId = 'ghost'
    expect(parse(f)).toEqual({ ok: false, error: { code: 'missingBean', beanId: 'ghost' } })
  })
})

describe('backupReminder', () => {
  const now = new Date('2026-11-09T12:00:00.000Z')
  const daysBefore = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()

  it('รอบเตือน = 14 วัน', () => {
    expect(BACKUP_INTERVAL_DAYS).toBe(14)
  })

  it('ไม่มีข้อมูล → ไม่เตือน แม้ไม่เคยสำรอง', () => {
    expect(backupReminder({ hasData: false, now })).toEqual({ due: false, neverBackedUp: true })
    expect(backupReminder({ hasData: false, lastBackupAt: daysBefore(100), now }).due).toBe(false)
  })

  it('เคยสำรองแล้ว: เตือนเมื่อครบ 14 วันพอดีขึ้นไป', () => {
    expect(backupReminder({ hasData: true, lastBackupAt: daysBefore(13), now })).toEqual({ due: false, daysSince: 13, neverBackedUp: false })
    expect(backupReminder({ hasData: true, lastBackupAt: daysBefore(14), now })).toEqual({ due: true, daysSince: 14, neverBackedUp: false })
    expect(backupReminder({ hasData: true, lastBackupAt: daysBefore(60), now }).due).toBe(true)
  })

  it('ยังไม่เคยสำรอง: นับจากข้อมูลชิ้นแรก (ผู้ใช้ใหม่ไม่ถูกเตือนทันที)', () => {
    expect(backupReminder({ hasData: true, firstDataAt: daysBefore(1), now })).toEqual({ due: false, daysSince: 1, neverBackedUp: true })
    expect(backupReminder({ hasData: true, firstDataAt: daysBefore(20), now })).toEqual({ due: true, daysSince: 20, neverBackedUp: true })
  })

  it('เคยสำรองแล้ว → ใช้เวลาสำรอง ไม่ใช้เวลาข้อมูลชิ้นแรก', () => {
    expect(backupReminder({ hasData: true, lastBackupAt: daysBefore(2), firstDataAt: daysBefore(90), now }).due).toBe(false)
  })

  it('เวลาในอนาคต (นาฬิกาเครื่องเพี้ยน) หรืออ่านไม่ได้ → ไม่เตือน ไม่ error', () => {
    expect(backupReminder({ hasData: true, lastBackupAt: daysBefore(-30), now }).due).toBe(false)
    expect(backupReminder({ hasData: true, lastBackupAt: 'พัง', now }).due).toBe(false)
    expect(backupReminder({ hasData: true, now }).due).toBe(false)
  })
})

describe('backupCounts', () => {
  it('นับตามตาราง', () => {
    expect(backupCounts(buildBackup(source, EXPORTED_AT).data)).toEqual({ beans: 1, gear: 1, recipes: 1, brews: 2 })
  })
})

// ตรวจชนิดข้อมูลว่า BackupFile ที่สร้างตรงกับ type (compile-time)
const _typed: BackupFile = buildBackup(source, EXPORTED_AT)
void _typed
