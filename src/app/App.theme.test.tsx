import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db, getSettings, updateSettings } from '../db'
import { THEME_CACHE_KEY } from '../theme/theme'
import App from './App'

/** จำลองการตั้งค่าโหมดมืดของเครื่อง (jsdom ไม่มี matchMedia) — เปลี่ยนค่ากลางทางได้ */
function mockSystemDark(initial: boolean) {
  let matches = initial
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  window.matchMedia = vi.fn((query: string) => ({
    get matches() {
      return matches
    },
    media: query,
    onchange: null,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  })) as unknown as typeof window.matchMedia
  return (next: boolean) => {
    matches = next
    act(() => listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent)))
  }
}

const isDark = () => document.documentElement.classList.contains('dark')
const themeButton = () => screen.getByRole('button', { name: /^ธีม:/ })

beforeEach(async () => {
  await db.open()
  await Promise.all(db.tables.map((t) => t.clear()))
  localStorage.clear()
  document.documentElement.className = ''
})

afterEach(() => {
  // @ts-expect-error — คืนสภาพ jsdom (ไม่มี matchMedia)
  delete window.matchMedia
})

describe('ธีม (Dark mode)', () => {
  it('ค่าเริ่มต้น = อัตโนมัติ ตามเครื่อง และตามทันทีเมื่อเครื่องเปลี่ยนโหมด', async () => {
    const setSystemDark = mockSystemDark(true)
    render(<App />)
    await waitFor(() => expect(isDark()).toBe(true))
    expect(themeButton()).toHaveAccessibleName('ธีม: อัตโนมัติ (ตามเครื่อง) — แตะเพื่อเปลี่ยนเป็นโหมดสว่าง')
    setSystemDark(false)
    expect(isDark()).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('กดปุ่มวน อัตโนมัติ → มืด → สว่าง → อัตโนมัติ (เครื่องสว่าง) และบันทึกลง Settings + localStorage', async () => {
    mockSystemDark(false)
    const user = userEvent.setup()
    render(<App />)
    expect(isDark()).toBe(false)

    await user.click(themeButton())
    expect(isDark()).toBe(true)
    expect(themeButton()).toHaveAccessibleName(/^ธีม: โหมดมืด/)
    expect(localStorage.getItem(THEME_CACHE_KEY)).toBe('dark')
    await waitFor(async () => expect((await getSettings()).theme).toBe('dark'))

    await user.click(themeButton())
    expect(isDark()).toBe(false)
    expect(themeButton()).toHaveAccessibleName(/^ธีม: โหมดสว่าง/)

    await user.click(themeButton())
    expect(themeButton()).toHaveAccessibleName(/^ธีม: อัตโนมัติ/)
    await waitFor(async () => expect((await getSettings()).theme).toBe('system'))
  })

  it('เลือกเองแล้วไม่ตามเครื่องอีก', async () => {
    const setSystemDark = mockSystemDark(false)
    const user = userEvent.setup()
    render(<App />)
    await user.click(themeButton()) // → มืด
    setSystemDark(true)
    setSystemDark(false)
    expect(isDark()).toBe(true)
  })

  it('ค่าใน Settings เปลี่ยนจากที่อื่น (เช่น นำข้อมูลสำรองกลับ) → ธีมตามทันที', async () => {
    mockSystemDark(false)
    render(<App />)
    await waitFor(async () => expect((await getSettings()).theme).toBe('system'))
    await act(() => updateSettings({ theme: 'dark' }))
    await waitFor(() => expect(isDark()).toBe(true))
    expect(localStorage.getItem(THEME_CACHE_KEY)).toBe('dark')
  })

  it('ไม่มี matchMedia (เบราว์เซอร์เก่า) → ใช้โหมดสว่าง ไม่พัง', async () => {
    render(<App />)
    expect(themeButton()).toBeInTheDocument()
    expect(isDark()).toBe(false)
  })
})

describe('Accessibility พื้นฐานของโครงหน้า', () => {
  it('มี landmark ครบ (banner / main / navigation) และลิงก์ข้ามไปเนื้อหาหลัก', () => {
    render(<App />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
    expect(screen.getByRole('navigation', { name: 'เมนูหลัก' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ข้ามไปยังเนื้อหาหลัก' })).toHaveAttribute('href', '#main')
  })
})
