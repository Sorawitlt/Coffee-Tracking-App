import { BEEP_PATTERNS, VIBRATE_PATTERNS, canVibrate, createCuePlayer } from './cues'

class FakeOscillator {
  type = ''
  frequency = { value: 0 }
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  state: 'suspended' | 'running' | 'closed' = 'suspended'
  currentTime = 0
  destination = {}
  oscillators: FakeOscillator[] = []
  resume = vi.fn(async () => { this.state = 'running' })
  constructor() { FakeAudioContext.instances.push(this) }
  createOscillator() { const o = new FakeOscillator(); this.oscillators.push(o); return o }
  createGain() {
    return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }
  }
}

const ON = { sound: true, vibrate: true }

function setVibrate(fn: unknown) {
  Object.defineProperty(navigator, 'vibrate', { configurable: true, writable: true, value: fn })
}

beforeEach(() => {
  FakeAudioContext.instances = []
  vi.stubGlobal('AudioContext', FakeAudioContext)
})
afterEach(() => {
  vi.unstubAllGlobals()
  // @ts-expect-error — ลบตัวที่เทสต์ใส่ไว้
  delete navigator.vibrate
})

describe('เสียงเตือน', () => {
  it('ก่อน unlock ยังไม่มีเสียง (เบราว์เซอร์ยังไม่อนุญาต) และไม่ error', () => {
    const p = createCuePlayer()
    expect(() => p.play('step', ON)).not.toThrow()
    expect(FakeAudioContext.instances).toHaveLength(0)
  })

  it('unlock สร้าง AudioContext และปลุกให้ทำงาน (iOS เริ่มด้วย suspended)', () => {
    const p = createCuePlayer()
    p.unlock()
    p.unlock() // เรียกซ้ำใช้ตัวเดิม
    expect(FakeAudioContext.instances).toHaveLength(1)
    expect(FakeAudioContext.instances[0].resume).toHaveBeenCalled()
  })

  it.each(['tick', 'step', 'target'] as const)('เสียง %s: เล่นตามรูปแบบที่กำหนด (จำนวนบี๊บ + ความถี่)', (kind) => {
    const p = createCuePlayer()
    p.unlock()
    p.play(kind, { sound: true, vibrate: false })
    const ctx = FakeAudioContext.instances[0]
    expect(ctx.oscillators.map((o) => o.frequency.value)).toEqual(BEEP_PATTERNS[kind].map((b) => b.freq))
    ctx.oscillators.forEach((o) => {
      expect(o.start).toHaveBeenCalledOnce()
      expect(o.stop).toHaveBeenCalledOnce()
    })
  })

  it('ปิดเสียง → ไม่มีเสียง', () => {
    const p = createCuePlayer()
    p.unlock()
    p.play('step', { sound: false, vibrate: false })
    expect(FakeAudioContext.instances[0].oscillators).toHaveLength(0)
  })

  it('เครื่องไม่รองรับ Web Audio → เงียบ ๆ ไม่ error', () => {
    vi.stubGlobal('AudioContext', undefined)
    const p = createCuePlayer()
    expect(() => { p.unlock(); p.play('step', ON) }).not.toThrow()
  })

  it('สร้าง AudioContext ไม่ได้ → ไม่พัง', () => {
    vi.stubGlobal('AudioContext', class { constructor() { throw new Error('denied') } })
    const p = createCuePlayer()
    expect(() => { p.unlock(); p.play('step', ON) }).not.toThrow()
  })
})

describe('สั่นเตือน', () => {
  it('สั่นตามรูปแบบ เมื่อเปิดสั่น', () => {
    const vibrate = vi.fn(() => true)
    setVibrate(vibrate)
    expect(canVibrate()).toBe(true)
    createCuePlayer().play('step', { sound: false, vibrate: true })
    expect(vibrate).toHaveBeenCalledWith([...VIBRATE_PATTERNS.step])
  })

  it('ปิดสั่น → ไม่สั่น', () => {
    const vibrate = vi.fn(() => true)
    setVibrate(vibrate)
    createCuePlayer().play('step', { sound: false, vibrate: false })
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('เครื่องไม่รองรับ (เช่น iOS Safari) → canVibrate เป็น false และไม่ error', () => {
    expect(canVibrate()).toBe(false)
    expect(() => createCuePlayer().play('target', ON)).not.toThrow()
  })

  it('เบราว์เซอร์ปฏิเสธการสั่น → ไม่ error', () => {
    setVibrate(() => { throw new Error('blocked') })
    expect(() => createCuePlayer().play('step', ON)).not.toThrow()
  })
})
