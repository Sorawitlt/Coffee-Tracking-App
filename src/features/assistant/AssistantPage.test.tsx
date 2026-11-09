import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addBean, addBrew, addGear, db } from '../../db'
import { toLocalDate } from '../../domain/calc'
import { getDefaultRecipe } from '../../domain/recipes'
import AssistantPage from './AssistantPage'
import { SESSION_KEY, loadSession, newSession, saveSession, type AssistantSession } from './session'

const player = vi.hoisted(() => ({ unlock: vi.fn(), play: vi.fn() }))
vi.mock('./cues', () => ({ createCuePlayer: () => player, canVibrate: () => false }))

const NOW = new Date(2026, 10, 9, 8, 30, 15) // 8:30:15 ตามเวลาท้องถิ่น

function daysAgo(n: number): string {
  return toLocalDate(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n))
}

const seedBean = (over: Partial<Parameters<typeof addBean>[0]> = {}) =>
  addBean({
    name: 'Ethiopia Guji', roaster: 'Roast Co', origin: 'Ethiopia', roastLevel: 'light',
    roastDate: daysAgo(10), weightG: 250, priceTotal: 500, currency: 'THB', category: 'coffee', ...over,
  })

const goToBeans = vi.fn()

function setup(props: { active?: boolean } = {}) {
  const user = userEvent.setup()
  const utils = render(<AssistantPage onGoToBeans={goToBeans} {...props} />)
  return { user, ...utils }
}

function advance(seconds: number) {
  for (let i = 0; i < seconds; i++) act(() => { vi.advanceTimersByTime(1000) })
}

const timerText = () => screen.getByRole('timer').textContent
const clickStartBrew = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: '▶ เริ่มชง' }))
const clickStartTimer = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: '▶ เริ่มจับเวลา' }))

beforeEach(async () => {
  await db.open()
  await Promise.all(db.tables.map((t) => t.clear()))
  localStorage.clear()
  goToBeans.mockClear()
  player.unlock.mockClear()
  player.play.mockClear()
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('เตรียมชง', () => {
  it('ยังไม่มีเมล็ด → บอกให้ไปเพิ่มเมล็ดก่อน (ไม่มีปุ่มย้อนกลับที่ไม่มีที่ไป)', async () => {
    const { user } = setup()
    expect(await screen.findByText(/ต้องมีเมล็ดในคลังก่อน/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ย้อนกลับ' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ไปเพิ่มเมล็ด' }))
    expect(goToBeans).toHaveBeenCalled()
  })

  it('เติมค่าจากสูตรตั้งต้น V60 + แสดงเฉพาะช่องที่ต้องใช้ก่อนชง (ไม่มีเวลา/TDS/วันเวลา)', async () => {
    await seedBean()
    setup()
    expect(await screen.findByRole('form', { name: 'เตรียมชง' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^กาแฟ \(g\)/)).toHaveValue('15')
    expect(screen.getByLabelText(/^น้ำ \(g\)/)).toHaveValue('240')
    expect(screen.getByText('อัตราส่วน 1:16')).toBeInTheDocument()
    expect(screen.queryByLabelText(/เวลาชง/)).not.toBeInTheDocument()
    expect(screen.queryByText(/TDS/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ยกเลิก' })).not.toBeInTheDocument()
  })

  it('ปุ่มอัตราส่วนลัด: ตั้งน้ำจากกาแฟ และไฮไลต์ปุ่มที่ตรงกับค่าปัจจุบัน', async () => {
    await seedBean()
    const { user } = setup()
    const presets = await screen.findByRole('group', { name: 'อัตราส่วนลัด' })
    expect(within(presets).getByRole('button', { name: '1:16' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(presets).getByRole('button', { name: '1:17' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(within(presets).getByRole('button', { name: '1:17' }))
    expect(screen.getByLabelText(/^น้ำ \(g\)/)).toHaveValue('255')
    expect(screen.getByText('อัตราส่วน 1:17')).toBeInTheDocument()
    expect(within(presets).getByRole('button', { name: '1:17' })).toHaveAttribute('aria-pressed', 'true')

    // ปรับกาแฟแล้วกดลัดอีกครั้ง คำนวณจากกาแฟใหม่
    await user.click(screen.getByRole('button', { name: 'เพิ่ม กาแฟ (g)' })) // 15.5
    await user.click(within(presets).getByRole('button', { name: '1:15' }))
    expect(screen.getByLabelText(/^น้ำ \(g\)/)).toHaveValue('232.5')
  })

  it('ไม่มีปุ่มอัตราส่วนลัดตอนบันทึกการชงทั่วไป (เฉพาะผู้ช่วยชง)', async () => {
    // BrewForm โหมดอื่นไม่ได้รับผลกระทบ — ตรวจใน LogPage.test อยู่แล้ว; ที่นี่ยืนยันว่าโหมด start มีครบทุกวิธีชง
    await seedBean()
    const { user } = setup()
    await screen.findByRole('group', { name: 'อัตราส่วนลัด' })
    await user.selectOptions(screen.getByLabelText(/วิธีชง/), 'espresso')
    const presets = screen.getByRole('group', { name: 'อัตราส่วนลัด' })
    expect(within(presets).getAllByRole('button').map((b) => b.textContent)).toEqual(['1:1.5', '1:2', '1:2.5', '1:3'])
    expect(within(presets).getByRole('button', { name: '1:2' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('กดเริ่มชง → หน้าพร้อมชง: ยังไม่หักน้ำหนักเมล็ด และเก็บเซสชันไว้ใน storage', async () => {
    const bean = await seedBean()
    const { user } = setup()
    await screen.findByRole('form', { name: 'เตรียมชง' })
    await clickStartBrew(user)

    expect(await screen.findByRole('button', { name: '▶ เริ่มจับเวลา' })).toBeInTheDocument()
    expect(timerText()).toBe('0:00')
    expect(await screen.findByText(/Ethiopia Guji/)).toBeInTheDocument()
    expect((await db.beans.get(bean.id))!.remainingG).toBe(250)
    expect(await db.brews.count()).toBe(0)

    const saved = loadSession()!
    expect(saved).toMatchObject({ timer: { status: 'ready' }, input: { method: 'v60', beanId: bean.id, doseG: 15, waterG: 240, recipeId: 'default-v60' } })
  })

  it('ปรับน้ำก่อนชง → เป้าน้ำหนักในแต่ละขั้นปรับตาม', async () => {
    await seedBean()
    const { user } = setup()
    const presets = await screen.findByRole('group', { name: 'อัตราส่วนลัด' })
    await user.click(within(presets).getByRole('button', { name: '1:18' })) // น้ำ 270 (×1.125)
    await clickStartBrew(user)
    const rows = within(await screen.findByRole('list', { name: 'ขั้นตอนทั้งหมด' })).getAllByRole('listitem')
    // 45×1.125=50.6→51 · 150×1.125=168.75→169 · 240→270
    expect(rows.map((r) => r.textContent)).toEqual([
      '0:00บลูมถึง 51 g', '0:45เทน้ำถึง 169 g', '1:15เทน้ำถึง 270 g', '1:45รอน้ำหยดหมด',
    ])
  })

  it('“แก้ไขค่า” ย้อนกลับมาตั้งค่าใหม่ โดยค่าที่ปรับไว้ยังอยู่', async () => {
    await seedBean()
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: 'เพิ่ม กาแฟ (g)' })) // 15.5
    await clickStartBrew(user)
    await user.click(await screen.findByRole('button', { name: '← แก้ไขค่า' }))

    expect(await screen.findByRole('form', { name: 'เตรียมชง' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^กาแฟ \(g\)/)).toHaveValue('15.5')
    expect(loadSession()).toBeUndefined()
  })
})

describe('ชง V60 ตามผู้ช่วย → บันทึก', () => {
  it('ทั้งกระบวนการ: เริ่ม → เดินตามขั้น → เสร็จสิ้น → บันทึก ได้เวลาจริง หักน้ำหนักเมล็ด และกลับมาเตรียมชงครั้งใหม่', async () => {
    const bean = await seedBean()
    const { user } = setup()
    await screen.findByRole('form', { name: 'เตรียมชง' })
    await clickStartBrew(user)
    await clickStartTimer(user)

    advance(46)
    expect(timerText()).toBe('0:46')
    expect(within(screen.getByRole('group', { name: 'ขั้นตอนปัจจุบัน' })).getByText('ขั้นที่ 2 / 4')).toBeInTheDocument()
    expect(loadSession()!.timer.status).toBe('running')

    advance(125) // รวม 171 วินาที
    await user.click(screen.getByRole('button', { name: '✓ เสร็จสิ้น' }))

    // สรุป: ยังไม่ได้บันทึก/ยังไม่หัก
    expect(await screen.findByRole('region', { name: 'ชงเสร็จแล้ว' })).toBeInTheDocument()
    expect(screen.getByText('2:51')).toBeInTheDocument()
    expect(await db.brews.count()).toBe(0)
    expect((await db.beans.get(bean.id))!.remainingG).toBe(250)

    await user.click(screen.getByRole('button', { name: 'บันทึกการชง' }))
    expect(await screen.findByText(/ค่าจากผู้ช่วยชง — เวลาชงจริง 2:51/)).toBeInTheDocument()
    expect(screen.getByLabelText('เวลาชง (วินาที)')).toHaveValue('171')
    expect(screen.getByLabelText(/^กาแฟ \(g\)/)).toHaveValue('15')

    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('✓ บันทึกการชงแล้ว')).toBeInTheDocument()

    const [brew] = await db.brews.toArray()
    expect(brew).toMatchObject({
      method: 'v60', beanId: bean.id, recipeId: 'default-v60', doseG: 15, waterG: 240, tempC: 94, totalTimeSec: 171,
    })
    // เวลาที่ชง = ตอนกดเริ่มจับเวลา (8:30)
    expect(brew.brewedAt).toBe(new Date(2026, 10, 9, 8, 30).toISOString())
    expect((await db.beans.get(bean.id))!.remainingG).toBe(235)

    // เสร็จแล้วเคลียร์เซสชัน กลับไปหน้าเตรียมชง
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    expect(await screen.findByRole('form', { name: 'เตรียมชง' })).toBeInTheDocument()
    // ครั้งหน้าเติมค่าจากการชงครั้งนี้
    expect(screen.getByText(/เติมค่าจากการชงครั้งล่าสุดของเมล็ดนี้/)).toBeInTheDocument()
  })

  it('ชิมหลังชง → บันทึก → หน้า “ครั้งหน้าลอง” (เซสชันถูกล้างตั้งแต่บันทึก กันบันทึกซ้ำ) → เสร็จสิ้นกลับหน้าเตรียมชง', async () => {
    await seedBean()
    const { user } = setup()
    await screen.findByRole('form', { name: 'เตรียมชง' })
    await clickStartBrew(user)
    await clickStartTimer(user)
    advance(171)
    await user.click(screen.getByRole('button', { name: '✓ เสร็จสิ้น' }))
    await user.click(await screen.findByRole('button', { name: 'บันทึกการชง' }))

    await user.click(await screen.findByRole('button', { name: '3 ดาว' }))
    await user.click(screen.getByRole('button', { name: 'ขม' }))
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))

    const advice = await screen.findByRole('region', { name: 'คำแนะนำสำหรับครั้งหน้า' })
    expect(within(advice).getByText(/สกัดมากไป/)).toBeInTheDocument()
    // ไม่ได้ระบุเครื่องบด/เบอร์บด → ปรับบดไม่ได้ → ข้ามไปแนะนำอุณหภูมิ (94 → 92)
    expect(within(advice).getByText('น้ำเย็นลง 2 °C (94 → 92 °C)')).toBeInTheDocument()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    expect(await db.brews.count()).toBe(1)
    expect((await db.brews.toArray())[0]).toMatchObject({ rating: 3, balance: 1, totalTimeSec: 171 })

    await user.click(screen.getByRole('button', { name: 'เสร็จสิ้น' }))
    expect(await screen.findByText('✓ บันทึกการชงแล้ว')).toBeInTheDocument()
    expect(await screen.findByRole('form', { name: 'เตรียมชง' })).toBeInTheDocument()
    expect(await db.brews.count()).toBe(1)
  })

  it('ไฮไลต์ค่าที่ต่างจากครั้งก่อนในฟอร์มบันทึกหลังชง (ปรับทีละตัวแปร)', async () => {
    const bean = await seedBean()
    await addBrew({
      brewedAt: new Date(NOW.getTime() - 86_400_000).toISOString(), method: 'v60', beanId: bean.id,
      doseG: 15, waterG: 240, grindSetting: 18, tempC: 94,
    })
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: 'ลด เบอร์บด' })) // 17
    await clickStartBrew(user)
    await clickStartTimer(user)
    advance(30)
    await user.click(screen.getByRole('button', { name: '✓ เสร็จสิ้น' }))
    await user.click(await screen.findByRole('button', { name: 'บันทึกการชง' }))

    expect(await screen.findByText('▲ เปลี่ยน · ครั้งก่อน 18')).toBeInTheDocument()
    expect(screen.getByLabelText('เบอร์บด')).toHaveValue('17')
  })

  it('ยกเลิกในฟอร์มบันทึก → กลับหน้าสรุป ผลการชงยังอยู่', async () => {
    await seedBean()
    const { user } = setup()
    await screen.findByRole('form', { name: 'เตรียมชง' })
    await clickStartBrew(user)
    await clickStartTimer(user)
    advance(30)
    await user.click(screen.getByRole('button', { name: '✓ เสร็จสิ้น' }))
    await user.click(await screen.findByRole('button', { name: 'บันทึกการชง' }))
    await user.click(await screen.findByRole('button', { name: 'ยกเลิก' }))

    expect(await screen.findByRole('region', { name: 'ชงเสร็จแล้ว' })).toBeInTheDocument()
    expect(screen.getByText('0:30')).toBeInTheDocument()
    expect(loadSession()!.timer.status).toBe('finished')
    expect(await db.brews.count()).toBe(0)
  })

  it('กดเสร็จสิ้นพลาด → “กลับไปจับเวลาต่อ” ได้ เริ่มต่อจากเวลาตอนกด', async () => {
    await seedBean()
    const { user } = setup()
    await screen.findByRole('form', { name: 'เตรียมชง' })
    await clickStartBrew(user)
    await clickStartTimer(user)
    advance(50)
    await user.click(screen.getByRole('button', { name: '✓ เสร็จสิ้น' }))
    advance(300) // อยู่หน้าสรุปนาน ไม่ถูกนับ
    await user.click(await screen.findByRole('button', { name: '↩ กลับไปจับเวลาต่อ' }))

    expect(timerText()).toBe('0:50')
    expect(screen.getByRole('button', { name: '▶ ต่อ' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '▶ ต่อ' }))
    advance(10)
    expect(timerText()).toBe('1:00')
  })

  it('ทิ้งผลการชง: ต้องยืนยัน ไม่บันทึก ไม่หักน้ำหนัก และล้างเซสชัน', async () => {
    const bean = await seedBean()
    const { user } = setup()
    await screen.findByRole('form', { name: 'เตรียมชง' })
    await clickStartBrew(user)
    await clickStartTimer(user)
    advance(20)
    await user.click(screen.getByRole('button', { name: '✓ เสร็จสิ้น' }))
    await user.click(await screen.findByRole('button', { name: 'ทิ้งผลการชงนี้' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'ยืนยันทิ้ง' }))

    expect(await screen.findByRole('form', { name: 'เตรียมชง' })).toBeInTheDocument()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    expect(await db.brews.count()).toBe(0)
    expect((await db.beans.get(bean.id))!.remainingG).toBe(250)
  })

  it('ยกเลิกระหว่างจับเวลา → กลับหน้าเตรียมชง ล้างเซสชัน', async () => {
    await seedBean()
    const { user } = setup()
    await screen.findByRole('form', { name: 'เตรียมชง' })
    await clickStartBrew(user)
    await clickStartTimer(user)
    advance(10)
    await user.click(screen.getByRole('button', { name: 'ยกเลิกการชงนี้' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'ยืนยันยกเลิก' }))
    expect(await screen.findByRole('form', { name: 'เตรียมชง' })).toBeInTheDocument()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })
})

describe('Espresso', () => {
  it('เลือก Espresso → 18 g : 36 g → จับเวลา 28 วินาที → บันทึกเวลาจริง', async () => {
    const bean = await seedBean()
    const grinder = await addGear({ type: 'grinder', name: 'Niche', grindScale: { min: 0, max: 50, step: 1 } })
    const { user } = setup()
    await user.selectOptions(await screen.findByLabelText(/วิธีชง/), 'espresso')
    expect(screen.getByLabelText(/^กาแฟ \(g\)/)).toHaveValue('18')
    expect(screen.getByLabelText(/^น้ำ \(g\)/)).toHaveValue('36')
    await user.selectOptions(screen.getByLabelText('เครื่องบด'), grinder.id)
    await clickStartBrew(user)

    expect(await screen.findByText(/ขั้นแรก: สกัดช็อต ช็อตถึง 36 g/)).toBeInTheDocument()
    await clickStartTimer(user)
    advance(28)
    expect(player.play).toHaveBeenCalledWith('target', expect.anything())
    await user.click(screen.getByRole('button', { name: '✓ เสร็จสิ้น' }))
    await user.click(await screen.findByRole('button', { name: 'บันทึกการชง' }))
    await user.click(await screen.findByRole('button', { name: 'บันทึก' }))

    await waitFor(async () => expect(await db.brews.count()).toBe(1))
    const [brew] = await db.brews.toArray()
    expect(brew).toMatchObject({
      method: 'espresso', beanId: bean.id, doseG: 18, waterG: 36, totalTimeSec: 28, grinderId: grinder.id,
      recipeId: 'default-espresso',
    })
  })
})

describe('กลับมาชงต่อหลังปิดแอป', () => {
  const seedSession = (over: Partial<AssistantSession>, beanId: string): AssistantSession => {
    const s: AssistantSession = {
      ...newSession({ method: 'v60', beanId, recipeId: 'default-v60', doseG: 15, waterG: 240, tempC: 94 }, getDefaultRecipe('v60')),
      ...over,
    }
    saveSession(s)
    return s
  }

  it('เซสชันที่กำลังเดินอยู่ → เปิดมาที่หน้าจับเวลา เวลาตรงกับนาฬิกาจริง', async () => {
    const bean = await seedBean()
    seedSession(
      { timer: { status: 'running', startedAtMs: NOW.getTime() - 50_000, offsetMs: 0 }, startedAtMs: NOW.getTime() - 50_000 },
      bean.id,
    )
    setup()
    expect(await screen.findByRole('button', { name: '⏸ พัก' })).toBeInTheDocument()
    expect(timerText()).toBe('0:50')
    advance(5)
    expect(timerText()).toBe('0:55')
  })

  it('เซสชันที่จบแล้วแต่ยังไม่บันทึก → เปิดมาที่หน้าสรุป', async () => {
    const bean = await seedBean()
    seedSession({ timer: { status: 'finished', elapsedMs: 171_000 }, startedAtMs: NOW.getTime() - 400_000 }, bean.id)
    setup()
    expect(await screen.findByRole('region', { name: 'ชงเสร็จแล้ว' })).toBeInTheDocument()
    expect(screen.getByText('2:51')).toBeInTheDocument()
  })

  it('ข้อมูลเซสชันเสีย → เปิดมาที่หน้าเตรียมชงตามปกติ', async () => {
    await seedBean()
    localStorage.setItem(SESSION_KEY, '{"version":1,"oops":true}')
    setup()
    expect(await screen.findByRole('form', { name: 'เตรียมชง' })).toBeInTheDocument()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('เมล็ดของเซสชันที่ค้างอยู่ถูกลบไปแล้ว → ทิ้งเซสชันพร้อมแจ้งเตือน (ไม่ทิ้งเซสชันใหม่ที่เริ่มทีหลัง)', async () => {
    const live = await seedBean()
    seedSession({}, 'bean-ที่ถูกลบ')
    const { user } = setup()
    expect(await screen.findByText(/เมล็ดที่ใช้ชงถูกลบไปแล้ว/)).toBeInTheDocument()
    expect(await screen.findByRole('form', { name: 'เตรียมชง' })).toBeInTheDocument()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()

    // เริ่มการชงใหม่ด้วยเมล็ดที่ยังอยู่ต้องไม่ถูกทิ้งตาม
    await clickStartBrew(user)
    expect(await screen.findByRole('button', { name: '▶ เริ่มจับเวลา' })).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(500) })
    expect(loadSession()?.input.beanId).toBe(live.id)
  })
})

describe('สลับไปแท็บอื่นระหว่างชง', () => {
  it('ไม่ได้จับเวลาอยู่ + แท็บไม่ได้แสดง → ไม่ render อะไร', async () => {
    await seedBean()
    const { container } = setup({ active: false })
    await act(async () => {})
    expect(container).toBeEmptyDOMElement()
  })

  it('กำลังจับเวลาอยู่ → ยังทำงานเบื้องหลัง (ซ่อนหน้าแต่เสียงเตือนยังดัง) และกลับมาเห็นเวลาถูกต้อง', async () => {
    await seedBean()
    const { user, rerender, container } = setup()
    await screen.findByRole('form', { name: 'เตรียมชง' })
    await clickStartBrew(user)
    await clickStartTimer(user)
    advance(10)

    rerender(<AssistantPage active={false} onGoToBeans={goToBeans} />)
    expect(container.firstElementChild).toHaveAttribute('hidden')
    expect(screen.queryByRole('timer')).not.toBeInTheDocument() // ซ่อนจากผู้ใช้
    player.play.mockClear()
    advance(36) // ถึง 0:46 — ขั้นที่ 2 เริ่ม
    expect(player.play).toHaveBeenCalledWith('step', expect.anything())

    rerender(<AssistantPage active onGoToBeans={goToBeans} />)
    expect(container.firstElementChild).not.toHaveAttribute('hidden')
    expect(timerText()).toBe('0:46')
  })
})
