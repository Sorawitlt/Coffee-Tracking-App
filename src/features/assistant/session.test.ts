import { getDefaultRecipe } from '../../domain/recipes'
import { READY } from '../../domain/timer'
import { toDateTimeLocal } from '../brew/brewForm'
import {
  SESSION_KEY, clearSession, loadSession, newSession, parseSession, saveSession, sessionDurationSec,
  sessionToSaveValues, sessionToSetupValues, type AssistantSession, type SessionInput,
} from './session'

const input: SessionInput = {
  method: 'v60', beanId: 'bean-1', recipeId: 'default-v60', grinderId: 'grinder-1',
  grindSetting: 18, doseG: 15, waterG: 240, tempC: 94,
}
const fresh = (): AssistantSession => newSession(input, getDefaultRecipe('v60'))

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('newSession', () => {
  it('ยังไม่เริ่มจับเวลา และสร้างแผนจากสูตรตามน้ำที่ตั้ง', () => {
    const s = newSession({ ...input, waterG: 300 }, getDefaultRecipe('v60'))
    expect(s.timer).toEqual(READY)
    expect(s.startedAtMs).toBeUndefined()
    expect(s.plan.steps.map((x) => x.targetWaterG)).toEqual([56, 188, 300, undefined])
    expect(s.plan.totalTimeSec).toBe(180)
  })
})

describe('เก็บ / อ่านเซสชัน', () => {
  it('บันทึกแล้วอ่านกลับได้เหมือนเดิม (ทั้งสถานะ ready, running, paused, finished)', () => {
    const base = fresh()
    const states: AssistantSession[] = [
      base,
      { ...base, timer: { status: 'running', startedAtMs: 1_000, offsetMs: 500 }, startedAtMs: 900 },
      { ...base, timer: { status: 'paused', elapsedMs: 42_000 }, startedAtMs: 900 },
      { ...base, timer: { status: 'finished', elapsedMs: 171_000 }, startedAtMs: 900 },
    ]
    for (const s of states) {
      saveSession(s)
      expect(loadSession()).toEqual(s)
    }
  })

  it('ไม่มีข้อมูล → undefined', () => {
    expect(loadSession()).toBeUndefined()
  })

  it('clearSession ล้างออกจริง', () => {
    saveSession(fresh())
    clearSession()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    expect(loadSession()).toBeUndefined()
  })

  it('JSON เสีย → ไม่พัง คืน undefined และล้างทิ้งไม่ให้ค้าง', () => {
    localStorage.setItem(SESSION_KEY, '{not json')
    expect(loadSession()).toBeUndefined()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('รูปแบบผิด (เวอร์ชันอื่น) → ทิ้ง', () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...fresh(), version: 99 }))
    expect(loadSession()).toBeUndefined()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('storage ใช้ไม่ได้ (โหมดส่วนตัว/เต็ม) → ไม่ throw', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => saveSession(fresh())).not.toThrow()
    expect(() => clearSession()).not.toThrow()
    expect(loadSession()).toBeUndefined()
  })
})

describe('parseSession — ข้อมูลใน storage ไม่น่าเชื่อถือ', () => {
  const valid = () => JSON.parse(JSON.stringify(fresh())) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

  it('ของจริงผ่าน', () => {
    expect(parseSession(valid())).toEqual(fresh())
  })

  it.each<[string, (s: Record<string, any>) => void]>([ // eslint-disable-line @typescript-eslint/no-explicit-any
    ['method ไม่รู้จัก', (s) => { s.input.method = 'siphon' }],
    ['ไม่มี beanId', (s) => { s.input.beanId = '' }],
    ['กาแฟติดลบ', (s) => { s.input.doseG = -1 }],
    ['น้ำไม่ใช่ตัวเลข', (s) => { s.input.waterG = '240' }],
    ['อุณหภูมิเป็น NaN แบบสตริง', (s) => { s.input.tempC = 'hot' }],
    ['เวลาเป้าหมายเป็น 0', (s) => { s.plan.totalTimeSec = 0 }],
    ['steps ไม่ใช่ array', (s) => { s.plan.steps = 'x' }],
    ['action ไม่รู้จัก', (s) => { s.plan.steps[0].action = 'dance' }],
    ['index ไม่ต่อเนื่อง', (s) => { s.plan.steps[1].index = 5 }],
    ['startSec ติดลบ', (s) => { s.plan.steps[0].startSec = -1 }],
    ['timer สถานะแปลก', (s) => { s.timer = { status: 'exploded' } }],
    ['running ขาด offsetMs', (s) => { s.timer = { status: 'running', startedAtMs: 1 }; s.startedAtMs = 1 }],
    ['paused เวลาติดลบ', (s) => { s.timer = { status: 'paused', elapsedMs: -5 }; s.startedAtMs = 1 }],
    ['เริ่มแล้วแต่ไม่มีเวลาเริ่ม', (s) => { s.timer = { status: 'paused', elapsedMs: 5 } }],
  ])('%s → ทิ้ง', (_name, mutate) => {
    const s = valid()
    mutate(s)
    expect(parseSession(s)).toBeUndefined()
  })

  it.each([null, undefined, 42, 'x', [], {}])('ค่าที่ไม่ใช่เซสชัน (%j) → undefined', (v) => {
    expect(parseSession(v)).toBeUndefined()
  })
})

describe('แปลงเป็นค่าในฟอร์ม', () => {
  it('ค่าตั้งก่อนชง: กลับไปแก้ไขได้ครบ', () => {
    const v = sessionToSetupValues(fresh(), new Date(2026, 10, 9, 8, 30))
    expect(v).toMatchObject({
      method: 'v60', beanId: 'bean-1', doseG: '15', waterG: '240', tempC: '94', grindSetting: '18',
      grinderId: 'grinder-1', recipeId: 'default-v60', totalTimeSec: '',
    })
  })

  it('ค่าบันทึกหลังชง: เวลาจริงจากตัวจับเวลา + เวลาเริ่มชงเป็นเวลาที่ชง', () => {
    const startedAtMs = new Date(2026, 10, 9, 8, 30, 45).getTime()
    const s: AssistantSession = { ...fresh(), timer: { status: 'finished', elapsedMs: 171_400 }, startedAtMs }
    const v = sessionToSaveValues(s, startedAtMs + 200_000)
    expect(v.totalTimeSec).toBe('171')
    expect(v.brewedAt).toBe('2026-11-09T08:30')
    expect(v).toMatchObject({ doseG: '15', waterG: '240', recipeId: 'default-v60', grindSetting: '18' })
    expect(v.brewedAt).toBe(toDateTimeLocal(new Date(startedAtMs)))
  })

  it('เวลา 0 วินาที → ปล่อยว่าง (ไม่บังคับให้เป็นตัวเลข 0 ที่ไม่ผ่านการตรวจสอบ)', () => {
    const s: AssistantSession = { ...fresh(), timer: { status: 'finished', elapsedMs: 300 }, startedAtMs: 1 }
    expect(sessionToSaveValues(s, 1_000).totalTimeSec).toBe('')
    expect(sessionDurationSec(s, 0)).toBe(0)
  })

  it('sessionDurationSec ปัดเป็นวินาทีเต็ม และนับตามนาฬิกาตอนกำลังเดิน', () => {
    const running: AssistantSession = { ...fresh(), timer: { status: 'running', startedAtMs: 10_000, offsetMs: 2_000 }, startedAtMs: 10_000 }
    expect(sessionDurationSec(running, 40_600)).toBe(33) // 2 + 30.6 = 32.6 → 33
  })
})
