import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addBean, addBrew, addGear, db, getSettings, updateSettings } from '../db'
import { toLocalDate } from '../domain/calc'
import { LANGUAGE_CACHE_KEY } from '../i18n/I18nProvider'
import { SNOOZE_KEY } from '../features/export/reminder'
import App from './App'

const player = vi.hoisted(() => ({ unlock: vi.fn(), play: vi.fn() }))
vi.mock('../features/assistant/cues', () => ({ createCuePlayer: () => player, canVibrate: () => false }))

const NOW = new Date(2026, 10, 9, 8, 30, 15)
const THAI = /[ก-๙]/
const SWITCH_THAI = 'เปลี่ยนเป็นภาษาไทย'
const SWITCH_EN = 'Switch to English'

const daysAgoDate = (n: number) => toLocalDate(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n))
const daysAgoIso = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

/**
 * ข้อความ/ป้ายที่ผู้ใช้เห็นหรือโปรแกรมอ่านหน้าจออ่านออกเสียง และมีอักษรไทยปนอยู่ (ไม่นับปุ่มสลับภาษา — ตั้งใจเขียนเป็นภาษาปลายทาง)
 * ข้อมูลที่ผู้ใช้กรอกเองในชุดทดสอบเป็นอังกฤษทั้งหมด จึงมีอักษรไทยที่เหลืออยู่ = ข้อความของแอปที่ยังไม่ผ่าน i18n
 */
function thaiLeaks(): string[] {
  const leaks: string[] = []
  const skip = (el: Element | null) => el?.closest('[data-i18n-skip]') != null
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (THAI.test(n.textContent ?? '') && !skip(n.parentElement)) leaks.push(`text: ${n.textContent}`)
  }
  for (const el of document.body.querySelectorAll('[aria-label],[placeholder],[title],[alt]')) {
    if (skip(el)) continue
    for (const attr of ['aria-label', 'placeholder', 'title', 'alt']) {
      const v = el.getAttribute(attr)
      if (v && THAI.test(v)) leaks.push(`${attr}: ${v}`)
    }
  }
  for (const input of document.body.querySelectorAll('input, textarea, select option')) {
    const v = (input as HTMLInputElement).value
    if (v && THAI.test(v) && !skip(input)) leaks.push(`value: ${v}`)
  }
  return leaks
}

/** ปุ่มสลับภาษาไม่นับเป็นข้อความรั่ว — ติดป้ายให้ thaiLeaks ข้าม */
const markSwitch = () => {
  for (const b of screen.queryAllByRole('button', { name: SWITCH_THAI })) b.setAttribute('data-i18n-skip', '')
}
const expectNoThai = () => {
  markSwitch()
  expect(thaiLeaks()).toEqual([])
}

async function seed() {
  const fresh = await addBean({
    name: 'Fresh Guji', roaster: 'Roast Co', origin: 'Ethiopia', roastLevel: 'light', roastDate: daysAgoDate(2),
    weightG: 250, priceTotal: 500, currency: 'THB', category: 'coffee', process: 'natural',
  })
  const old = await addBean({
    name: 'Old Kenya', roaster: 'Roast Co', origin: 'Kenya', roastLevel: 'mediumDark', roastDate: daysAgoDate(60),
    weightG: 250, remainingG: 20, priceTotal: 480, currency: 'USD', category: 'coffee',
  })
  await addBean({
    name: 'Shelved', roaster: 'R', origin: 'Peru', roastLevel: 'dark', roastDate: daysAgoDate(90),
    weightG: 250, category: 'coffee', archived: true,
  })
  const grinder = await addGear({ type: 'grinder', name: 'Comandante', grindScale: { min: 1, max: 40, step: 1 } })
  await addGear({ type: 'brewer', name: 'Hario V60' })
  await addBrew({
    brewedAt: daysAgoIso(1), method: 'v60', beanId: fresh.id, grinderId: grinder.id, doseG: 15, waterG: 240,
    grindSetting: 20, tempC: 94, totalTimeSec: 180, tds: 1.3, yieldG: 200, rating: 3, balance: -2, body: -1,
    flavorTags: ['citrus', 'tea'], isBest: false, notes: 'sharp',
    advice: {
      kind: 'underExtracted',
      adjustment: { variable: 'grind', direction: 'finer', steps: 1, from: 20, to: 19 },
      alternatives: [{ variable: 'temp', deltaC: 2, from: 94, to: 96 }, { variable: 'time', deltaSec: 15, from: 180, to: 195 }],
      notes: ['beanTooFresh'],
    },
  })
  await addBrew({
    brewedAt: daysAgoIso(2), method: 'espresso', beanId: old.id, doseG: 18, waterG: 36, tds: 9, yieldG: 36, rating: 5,
    flavorTags: ['chocolate'], isBest: true,
    advice: { kind: 'best', alternatives: [], notes: ['beanStale'] },
  })
  await addBrew({ brewedAt: daysAgoIso(3), method: 'chemex', beanId: fresh.id, doseG: 30, waterG: 480, rating: 4, flavorTags: [] })
}

beforeEach(async () => {
  await db.open()
  await Promise.all(db.tables.map((t) => t.clear()))
  localStorage.clear()
  localStorage.removeItem(SNOOZE_KEY)
  player.unlock.mockClear()
  player.play.mockClear()
})

const nav = () => screen.getByRole('navigation')
const tab = (user: ReturnType<typeof userEvent.setup>, name: RegExp) => user.click(within(nav()).getByRole('button', { name }))

describe('สลับภาษา', () => {
  it('ค่าเริ่มต้นเป็นภาษาไทย → กดปุ่ม → อังกฤษทั้งแอป บันทึกลง Settings และจำไว้ → กดอีกครั้งกลับเป็นไทย', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('navigation', { name: 'เมนูหลัก' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('th')

    await user.click(screen.getByRole('button', { name: SWITCH_EN }))
    expect(await screen.findByRole('navigation', { name: 'Main menu' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    expect(within(nav()).getAllByRole('button').map((b) => b.textContent)).toEqual(['☕Brew', '📖Log', '🫘Beans', '📊Insights'])
    await waitFor(async () => expect((await getSettings()).language).toBe('en'))
    expect(localStorage.getItem(LANGUAGE_CACHE_KEY)).toBe('en')

    await user.click(screen.getByRole('button', { name: SWITCH_THAI }))
    expect(await screen.findByRole('navigation', { name: 'เมนูหลัก' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('th')
    await waitFor(async () => expect((await getSettings()).language).toBe('th'))
  })

  it('เปิดแอปครั้งถัดไป: ภาษาที่บันทึกไว้ใน Settings ถูกใช้ (เช่น นำข้อมูลสำรองกลับมา)', async () => {
    await updateSettings({ language: 'en' })
    render(<App />)
    expect(await screen.findByRole('navigation', { name: 'Main menu' })).toBeInTheDocument()
  })

  it('ภาษาที่จำไว้ในเครื่องแสดงตั้งแต่เฟรมแรก ไม่กะพริบเป็นภาษาไทย', async () => {
    localStorage.setItem(LANGUAGE_CACHE_KEY, 'en')
    await updateSettings({ language: 'en' })
    render(<App />)
    expect(screen.getByRole('navigation', { name: 'Main menu' })).toBeInTheDocument()
  })
})

describe('ตัวตรวจจับข้อความไทยทำงานจริง', () => {
  it('โหมดไทยต้องเจออักษรไทย (กันตัวตรวจที่ผ่านเพราะตรวจอะไรไม่ได้เลย)', async () => {
    await seed()
    render(<App />)
    await screen.findByRole('form', { name: 'เตรียมชง' })
    markSwitch()
    expect(thaiLeaks().length).toBeGreaterThan(10)
  })
})

describe('โหมดอังกฤษ — ไม่มีข้อความไทยหลงเหลือในทุกหน้า', () => {
  async function openEnglishApp() {
    await seed()
    await updateSettings({ language: 'en' })
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('form', { name: 'Set up brew' })
    return user
  }

  it('แท็บชง (ฟอร์มเตรียมชง) → จับเวลา → สรุป → บันทึก', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(NOW)
    try {
      const user = await openEnglishApp()
      expectNoThai()
      // อัตราส่วนลัด + ช่องคำเตือนเมล็ดเหลือน้อย
      await user.selectOptions(screen.getByLabelText(/^Beans/), 'Old Kenya')
      expectNoThai()
      await user.selectOptions(screen.getByLabelText(/^Beans/), 'Fresh Guji')

      await user.click(screen.getByRole('button', { name: '▶ Start brewing' }))
      expect(await screen.findByRole('timer', { name: 'Elapsed time' })).toBeInTheDocument()
      expectNoThai()
      await user.click(screen.getByRole('button', { name: '▶ Start timer' }))
      for (let i = 0; i < 50; i++) act(() => { vi.advanceTimersByTime(1000) })
      expectNoThai()
      await user.click(screen.getByRole('button', { name: '⏸ Pause' }))
      await user.click(screen.getByRole('button', { name: 'Cancel this brew' }))
      expectNoThai()
      await user.click(screen.getByRole('button', { name: 'Keep brewing' }))
      await user.click(screen.getByRole('button', { name: '✓ Finish' }))
      expect(await screen.findByRole('heading', { name: 'Brew finished' })).toBeInTheDocument()
      expectNoThai()
      await user.click(screen.getByRole('button', { name: 'Discard this brew' }))
      expectNoThai()
      await user.click(screen.getByRole('button', { name: 'Keep' }))
      await user.click(screen.getByRole('button', { name: 'Save brew' }))
      expect(await screen.findByText(/Values from the brew assistant/)).toBeInTheDocument()
      expectNoThai()
      await user.click(screen.getByRole('button', { name: 'Save' }))
      expect(await screen.findByText(/Brew saved/)).toBeInTheDocument()
      expectNoThai()
    } finally {
      vi.useRealTimers()
    }
  })

  it('แท็บบันทึก: รายการ ตัวกรอง ฟอร์มใหม่/ชงซ้ำ/แก้ไข ผลชิม และหน้าคำแนะนำ', async () => {
    const user = await openEnglishApp()
    await tab(user, /Log/)
    expect(await screen.findByRole('button', { name: '+ Log a brew' })).toBeInTheDocument()
    expectNoThai()
    await user.click(screen.getByText('Filters'))
    expectNoThai()
    await user.type(screen.getByRole('searchbox'), 'citrus')
    expect(await screen.findByText(/Showing 1 of 3/)).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox'), 'zzz')
    expect(await screen.findByText('No brews match this filter')).toBeInTheDocument()
    expectNoThai()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    // ฟอร์มใหม่: ส่วนชิม + รายละเอียดเพิ่มเติม + ตรวจสอบข้อมูล
    await user.click(screen.getByRole('button', { name: '+ Log a brew' }))
    await screen.findByRole('form', { name: 'Log a brew' })
    for (const summary of screen.getAllByText(/Sweetness, flavour tags and notes|More details/)) await user.click(summary)
    expectNoThai()
    await user.clear(screen.getByLabelText(/^Coffee \(g\)/))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Please enter the coffee dose (grams)')).toBeInTheDocument()
    expectNoThai()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    // ชงซ้ำ / แก้ไข / ลบ
    await user.click((await screen.findAllByRole('button', { name: /^Brew again:/ }))[0])
    expect(await screen.findByRole('form', { name: 'Brew again' })).toBeInTheDocument()
    expectNoThai()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click((await screen.findAllByRole('button', { name: /^Edit brew:/ }))[0])
    expect(await screen.findByRole('form', { name: 'Edit brew' })).toBeInTheDocument()
    expectNoThai()
    await user.click(screen.getByRole('button', { name: 'Delete this brew' }))
    expectNoThai()
    await user.click(screen.getByRole('button', { name: 'Keep' }))

    // บันทึกแล้วได้หน้าคำแนะนำ "ครั้งหน้าลอง"
    await user.click(screen.getByRole('button', { name: 'Bitter' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('region', { name: 'Advice for next time' })).toBeInTheDocument()
    expectNoThai()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByText(/Brew updated/)).toBeInTheDocument()
    expectNoThai()
  })

  it('แท็บเมล็ด: คลังเมล็ด (การ์ด/ฟอร์ม/ตรวจข้อมูล/ลบ) และอุปกรณ์', async () => {
    const user = await openEnglishApp()
    await tab(user, /Beans/)
    expect(await screen.findByRole('button', { name: '+ Add beans' })).toBeInTheDocument()
    expectNoThai()
    await user.click(screen.getByLabelText(/Show archived/))
    expectNoThai()
    await user.click(screen.getByRole('button', { name: '+ Add beans' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Please enter the bean name')).toBeInTheDocument()
    expectNoThai()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    // เมล็ดที่ยังไม่มีประวัติการชงลบได้ (มีประวัติ = ลบไม่ได้ ต้องใช้ Archive แทน); กลับจากฟอร์มแล้วตัวเลือก "แสดงที่ Archive" รีเซ็ต
    await user.click(await screen.findByLabelText(/Show archived/))
    await user.click(await screen.findByRole('button', { name: /Shelved/ }))
    await user.click(await screen.findByRole('button', { name: /Delete these beans/ }))
    expectNoThai()
    await user.click(screen.getByRole('button', { name: 'Keep' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: /Gear/ }))
    expect(await screen.findByRole('button', { name: '+ Add gear' })).toBeInTheDocument()
    expectNoThai()
    await user.click(screen.getByRole('button', { name: '+ Add gear' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Please enter the gear name')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Min'), '5')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expectNoThai()
  })

  it('แท็บสรุป: ตัวเลข สูตรที่ดีที่สุด กราฟ และมุมมองตาราง', async () => {
    const user = await openEnglishApp()
    await tab(user, /Insights/)
    expect(await screen.findByRole('region', { name: 'Best recipe per bean' })).toBeInTheDocument()
    expectNoThai()
    for (const btn of screen.getAllByRole('button', { name: /View table/ })) await user.click(btn)
    expectNoThai()
    await user.click(screen.getByRole('button', { pressed: false, name: 'Espresso' }))
    expectNoThai()
  })

  it('หน้าข้อมูลของฉัน: สำรอง นำกลับ ส่งออก และแบนเนอร์เตือน', async () => {
    const user = await openEnglishApp()
    // ข้อมูลชิ้นแรกเก่ากว่า 14 วันและยังไม่เคยสำรอง → ถึงเวลาเตือน
    await db.beans.toCollection().modify({ createdAt: daysAgoIso(30) })
    await tab(user, /Log/)
    expect(await screen.findByRole('region', { name: 'Backup reminder' })).toBeInTheDocument()
    expectNoThai()
    await user.click(screen.getByRole('button', { name: /^My data:/ }))
    expect(await screen.findByRole('heading', { name: 'My data' })).toBeInTheDocument()
    expectNoThai()
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    await user.click(screen.getByRole('button', { name: /Download backup file/ }))
    expect(await screen.findByText(/Created brew-log-backup-.* beans · .* gear · .* my recipes · .* brews\)/)).toBeInTheDocument()
    expectNoThai()
    await user.click(screen.getByRole('button', { name: /Brew log \(\.csv\)/ }))
    expect(await screen.findByText(/rows\) — opens in Excel and Google Sheets/)).toBeInTheDocument()
    expectNoThai()
    // ไฟล์ที่ไม่ใช่ไฟล์สำรอง → ข้อความผิดพลาดเป็นภาษาอังกฤษ
    const file = new File(['not json'], 'x.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Backup file (.json)'), file)
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't read the file")
    expectNoThai()
  })

  it('ข้อความที่ค้างอยู่ตามภาษาใหม่ทันทีเมื่อสลับกลางทาง (ไม่ติดภาษาเดิม)', async () => {
    const user = await openEnglishApp()
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    await user.click(screen.getByRole('button', { name: /^My data:/ }))
    await user.click(await screen.findByRole('button', { name: /Download backup file/ }))
    expect(await screen.findByText(/^Created brew-log-backup/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: SWITCH_THAI }))
    expect(await screen.findByText(/^สร้างไฟล์ brew-log-backup/)).toBeInTheDocument()
  })
})
