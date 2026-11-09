import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { Bean } from '../../domain/types'
import { getDefaultRecipe } from '../../domain/recipes'
import { BrewingScreen } from './BrewingScreen'
import { PREFS_KEY } from './prefs'
import { newSession, type AssistantSession, type SessionInput } from './session'

const player = vi.hoisted(() => ({ unlock: vi.fn(), play: vi.fn() }))
vi.mock('./cues', () => ({ createCuePlayer: () => player, canVibrate: () => true }))

const T0 = new Date(2026, 10, 9, 8, 30, 0).getTime()

const bean = { id: 'bean-1', name: 'Ethiopia Guji' } as Bean

const v60: SessionInput = {
  method: 'v60', beanId: 'bean-1', recipeId: 'default-v60', doseG: 15, waterG: 240, tempC: 94, grindSetting: 18,
}

const sessionOf = (input: SessionInput = v60, method = input.method): AssistantSession =>
  newSession(input, getDefaultRecipe(method))

let latest: AssistantSession
const onEdit = vi.fn()
const onCancel = vi.fn()

function Harness({ initial }: { initial: AssistantSession }) {
  const [session, setSession] = useState(initial)
  latest = session
  return (
    <BrewingScreen
      session={session}
      bean={bean}
      onChange={(next) => { latest = next; setSession(next) }}
      onCancel={onCancel}
      onEdit={onEdit}
    />
  )
}

/** เดินเวลา (วินาที) ทีละ 1 วินาที เหมือนใช้งานจริง — แต่ละก้าวเป็น act เดียว */
function advance(seconds: number) {
  for (let i = 0; i < seconds; i++) act(() => { vi.advanceTimersByTime(1000) })
}

const timerText = () => screen.getByRole('timer').textContent
/** ขั้นตอนปัจจุบัน (ข้อความเดียวกันอาจซ้ำในตารางขั้นตอนทั้งหมด จึงค้นเฉพาะในกรอบนี้) */
const panel = () => within(screen.getByRole('group', { name: 'ขั้นตอนปัจจุบัน' }))
const playedKinds = () => player.play.mock.calls.map((c) => c[0])

beforeEach(() => {
  localStorage.clear()
  player.unlock.mockClear()
  player.play.mockClear()
  onEdit.mockClear()
  onCancel.mockClear()
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(T0)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('ก่อนเริ่มจับเวลา', () => {
  it('แสดงสรุปค่า, เวลา 0:00, ขั้นแรก, และตารางขั้นตอนทั้งหมดของ V60', () => {
    render(<Harness initial={sessionOf()} />)
    expect(screen.getByText(/V60/)).toBeInTheDocument()
    expect(screen.getByText(/Ethiopia Guji/)).toBeInTheDocument()
    expect(screen.getByText(/กาแฟ 15 g · น้ำ 240 g \(1:16\) · 94 °C · บด 18/)).toBeInTheDocument()
    expect(timerText()).toBe('0:00')
    expect(screen.getByText(/ขั้นแรก: บลูม ถึง 45 g/)).toBeInTheDocument()

    const rows = within(screen.getByRole('list', { name: 'ขั้นตอนทั้งหมด' })).getAllByRole('listitem')
    expect(rows.map((r) => r.textContent)).toEqual([
      '0:00บลูมถึง 45 g',
      '0:45เทน้ำถึง 150 g',
      '1:15เทน้ำถึง 240 g',
      '1:45รอน้ำหยดหมด',
    ])
    expect(rows.some((r) => r.hasAttribute('aria-current'))).toBe(false)
    expect(screen.queryByRole('button', { name: /พัก|เสร็จสิ้น/ })).not.toBeInTheDocument()
  })

  it('ปุ่ม “แก้ไขค่า” ย้อนกลับไปตั้งค่า', async () => {
    render(<Harness initial={sessionOf()} />)
    await userEvent.click(screen.getByRole('button', { name: '← แก้ไขค่า' }))
    expect(onEdit).toHaveBeenCalledOnce()
  })
})

describe('จับเวลาและขั้นตอน (V60)', () => {
  it('กดเริ่ม: ปลดล็อกเสียง + เล่นสัญญาณขั้นแรกทันที + เก็บเวลาเริ่มชง', async () => {
    render(<Harness initial={sessionOf()} />)
    await userEvent.click(screen.getByRole('button', { name: '▶ เริ่มจับเวลา' }))
    expect(player.unlock).toHaveBeenCalled()
    expect(player.play).toHaveBeenCalledWith('step', { sound: true, vibrate: true })
    expect(latest.timer.status).toBe('running')
    expect(latest.startedAtMs).toBe(T0)
    expect(panel().getByText('ขั้นที่ 1 / 4')).toBeInTheDocument()
    expect(panel().getByText('บลูม')).toBeInTheDocument()
  })

  it('เดินเวลาตามจริง: เปลี่ยนขั้นตรงเวลา, ไฮไลต์ขั้นปัจจุบัน, แสดงขั้นถัดไป และเล่นเสียงถูกจังหวะ', async () => {
    render(<Harness initial={sessionOf()} />)
    await userEvent.click(screen.getByRole('button', { name: '▶ เริ่มจับเวลา' }))
    player.play.mockClear()

    advance(44)
    expect(timerText()).toBe('0:44')
    expect(panel().getByText('ขั้นที่ 1 / 4')).toBeInTheDocument()
    expect(panel().getByText('อีก 0:01 ถึงขั้นถัดไป')).toBeInTheDocument()
    // นับถอยหลัง 42, 43, 44 → tick ×3 ยังไม่มี step
    expect(playedKinds()).toEqual(['tick', 'tick', 'tick'])

    advance(1)
    expect(timerText()).toBe('0:45')
    expect(playedKinds()).toEqual(['tick', 'tick', 'tick', 'step'])
    expect(panel().getByText('ขั้นที่ 2 / 4')).toBeInTheDocument()
    expect(panel().getByText('ถึง 150 g', { exact: false })).toHaveTextContent('ถึง 150 g(+105 g)')
    expect(screen.getByText(/^ถัดไป/)).toHaveTextContent('ถัดไป 1:15 · เทน้ำ ถึง 240 g')

    const rows = within(screen.getByRole('list', { name: 'ขั้นตอนทั้งหมด' })).getAllByRole('listitem')
    expect(rows[1]).toHaveAttribute('aria-current', 'step')
    expect(rows[0]).not.toHaveAttribute('aria-current')
  })

  it('ครบทุกขั้นถึงเวลาเป้าหมาย: เตือน target และขึ้นข้อความให้กดเสร็จสิ้น', async () => {
    render(<Harness initial={sessionOf()} />)
    await userEvent.click(screen.getByRole('button', { name: '▶ เริ่มจับเวลา' }))
    advance(105)
    expect(panel().getByText('ขั้นที่ 4 / 4')).toBeInTheDocument()
    expect(panel().getByText('รอน้ำหยดหมด')).toBeInTheDocument()
    expect(panel().getByText('อีก 1:15 ถึงเวลาเป้าหมาย')).toBeInTheDocument()

    player.play.mockClear()
    advance(75)
    expect(timerText()).toBe('3:00')
    expect(playedKinds()).toContain('target')
    advance(1)
    expect(screen.getByText(/ครบเวลาเป้าหมายแล้ว/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  it('พัก: เวลาหยุดนิ่งและไม่มีเสียง · ต่อ: นับต่อจากเดิม', async () => {
    render(<Harness initial={sessionOf()} />)
    await userEvent.click(screen.getByRole('button', { name: '▶ เริ่มจับเวลา' }))
    advance(20)
    await userEvent.click(screen.getByRole('button', { name: '⏸ พัก' }))
    expect(latest.timer.status).toBe('paused')
    expect(screen.getByText(/หยุดพัก/)).toBeInTheDocument()

    player.play.mockClear()
    advance(60) // เวลาผ่านไปเท่าไรก็ไม่นับ และข้ามขั้น 0:45 ไปโดยไม่เล่นเสียง
    expect(timerText()).toBe('0:20')
    expect(player.play).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: '▶ ต่อ' }))
    expect(latest.timer.status).toBe('running')
    advance(5)
    expect(timerText()).toBe('0:25')
  })

  it('เสร็จสิ้น: เก็บเวลารวมและสถานะ finished', async () => {
    render(<Harness initial={sessionOf()} />)
    await userEvent.click(screen.getByRole('button', { name: '▶ เริ่มจับเวลา' }))
    advance(171)
    await userEvent.click(screen.getByRole('button', { name: '✓ เสร็จสิ้น' }))
    expect(latest.timer).toEqual({ status: 'finished', elapsedMs: 171_000 })
  })

  it('เบราว์เซอร์หน่วง timer (ซ่อนหน้า) แล้วกลับมา → เวลาถูกต้อง และไม่เล่นเสียงย้อนหลังที่เลยมานานแล้ว', async () => {
    render(<Harness initial={sessionOf()} />)
    await userEvent.click(screen.getByRole('button', { name: '▶ เริ่มจับเวลา' }))
    advance(40)
    player.play.mockClear()

    // ข้าม 10 วินาทีในครั้งเดียว: ขั้นที่ 45 ผ่านไปแล้ว 5 วินาที
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(timerText()).toBe('0:50')
    expect(panel().getByText('ขั้นที่ 2 / 4')).toBeInTheDocument()
    expect(player.play).not.toHaveBeenCalled()

    // แต่ถ้าเพิ่งผ่านมาไม่นาน (≤ 3 วินาที) ยังเตือน
    advance(20) // ถึง 1:10 → tick 72.. ยังไม่ถึง
    act(() => { vi.advanceTimersByTime(3000) }) // 1:13 → ผ่าน tick 72, 73 → เล่นอย่างเดียว
    expect(playedKinds()).toEqual(['tick'])
  })
})

describe('ยกเลิก', () => {
  it('ต้องยืนยันก่อน และเลือก “ชงต่อ” ได้', async () => {
    render(<Harness initial={sessionOf()} />)
    await userEvent.click(screen.getByRole('button', { name: '▶ เริ่มจับเวลา' }))
    await userEvent.click(screen.getByRole('button', { name: 'ยกเลิกการชงนี้' }))
    expect(onCancel).not.toHaveBeenCalled()
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'ชงต่อ' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'ยกเลิกการชงนี้' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'ยืนยันยกเลิก' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})

describe('Espresso', () => {
  const espresso: SessionInput = { method: 'espresso', beanId: 'bean-1', doseG: 18, waterG: 36, tempC: 93 }

  it('ขั้นเดียว “สกัดช็อต” เป้า 36 g และเตือนเมื่อถึงเวลาเป้าหมาย 28 วินาที', async () => {
    render(<Harness initial={sessionOf(espresso)} />)
    expect(screen.getByText(/ขั้นแรก: สกัดช็อต ช็อตถึง 36 g/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '▶ เริ่มจับเวลา' }))
    expect(panel().getByText('สกัดช็อต')).toBeInTheDocument()
    expect(panel().getByText('ช็อตถึง 36 g', { exact: false })).toBeInTheDocument()

    player.play.mockClear()
    advance(28)
    expect(timerText()).toBe('0:28')
    expect(playedKinds()).toEqual(['target'])
    expect(screen.getByText('เป้าหมาย 0:25–0:30')).toBeInTheDocument()
  })
})

describe('เซสชันที่กู้คืนมา', () => {
  it('เปิดแอปกลับมาตอนที่ยังเดินอยู่ → เวลาตรงกับนาฬิกาจริง ขั้นตอนถูกต้อง และไม่เล่นเสียงย้อนหลัง', () => {
    const s: AssistantSession = {
      ...sessionOf(),
      timer: { status: 'running', startedAtMs: T0 - 50_000, offsetMs: 0 },
      startedAtMs: T0 - 50_000,
    }
    render(<Harness initial={s} />)
    expect(timerText()).toBe('0:50')
    expect(panel().getByText('ขั้นที่ 2 / 4')).toBeInTheDocument()
    expect(player.play).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '⏸ พัก' })).toBeInTheDocument()
  })

  it('เวลาเกิน 1 ชั่วโมงแสดงเป็น ชม:นาที:วินาที (Cold brew) และไม่กันจอดับ', () => {
    const coldBrew: SessionInput = { method: 'coldBrew', beanId: 'bean-1', doseG: 100, waterG: 800 }
    const s: AssistantSession = {
      ...sessionOf(coldBrew),
      timer: { status: 'paused', elapsedMs: 3_661_000 },
      startedAtMs: T0 - 3_661_000,
    }
    render(<Harness initial={s} />)
    expect(timerText()).toBe('1:01:01')
    expect(screen.getByText(/ไม่กันหน้าจอดับ/)).toBeInTheDocument()
    expect(panel().getByText(/ขั้นที่ 3 \/ 4/)).toBeInTheDocument() // แช่ / รอ
    expect(panel().getByText('แช่ / รอ')).toBeInTheDocument()
  })
})

describe('เสียงและสั่น', () => {
  it('ปิดเสียง: จำไว้ในเครื่อง และสัญญาณถัดไปไม่มีเสียง (ส่ง sound:false)', async () => {
    render(<Harness initial={sessionOf()} />)
    const sound = screen.getByRole('button', { name: '🔔 เสียง: เปิด' })
    expect(sound).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(sound)
    expect(screen.getByRole('button', { name: '🔕 เสียง: ปิด' })).toHaveAttribute('aria-pressed', 'false')
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ sound: false, vibrate: true })

    await userEvent.click(screen.getByRole('button', { name: '▶ เริ่มจับเวลา' }))
    expect(player.play).toHaveBeenLastCalledWith('step', { sound: false, vibrate: true })
  })

  it('ใช้ค่าที่เคยตั้งไว้ในเครื่อง และเปิดเสียงกลับมาแล้วลองให้ฟังทันที', async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ sound: false, vibrate: false }))
    render(<Harness initial={sessionOf()} />)
    expect(screen.getByRole('button', { name: '🔕 เสียง: ปิด' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '📴 สั่น: ปิด' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '🔕 เสียง: ปิด' }))
    expect(player.play).toHaveBeenCalledWith('tick', { sound: true, vibrate: false })
  })
})

describe('กันจอดับ', () => {
  afterEach(() => {
    // @ts-expect-error — ลบตัวที่เทสต์ใส่ไว้
    delete navigator.wakeLock
  })

  it('เครื่องไม่รองรับ → บอกผู้ใช้ให้ตั้งเวลาล็อกจอเอง', () => {
    render(<Harness initial={sessionOf()} />)
    expect(screen.getByRole('status')).toHaveTextContent('ไม่รองรับการกันจอดับ')
  })

  it('รองรับ → ขอ lock และแจ้งว่าจอจะไม่ดับ', async () => {
    const sentinel = { released: false, release: vi.fn(async () => undefined), addEventListener: vi.fn() }
    const request = vi.fn(async () => sentinel)
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
    render(<Harness initial={sessionOf()} />)
    await act(async () => {})
    expect(request).toHaveBeenCalledWith('screen')
    expect(screen.getByRole('status')).toHaveTextContent('หน้าจอจะไม่ดับระหว่างชง')
  })

  it('การชงแบบแช่นาน (Cold brew) ไม่ขอ lock', async () => {
    const request = vi.fn(async () => ({ released: false, release: vi.fn(), addEventListener: vi.fn() }))
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
    const coldBrew: SessionInput = { method: 'coldBrew', beanId: 'bean-1', doseG: 100, waterG: 800 }
    render(<Harness initial={sessionOf(coldBrew)} />)
    await act(async () => {})
    expect(request).not.toHaveBeenCalled()
  })
})
