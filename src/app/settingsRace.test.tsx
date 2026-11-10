import { act, fireEvent, render, screen } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { I18nProvider, LANGUAGE_CACHE_KEY, useI18n } from '../i18n/I18nProvider'
import { ThemeProvider, useTheme } from '../theme/ThemeProvider'
import { THEME_CACHE_KEY } from '../theme/theme'

/**
 * ผู้ใช้กดเลือกธีม/ภาษา "ก่อน" ที่การอ่านค่าตั้งจาก IndexedDB ครั้งแรกกลับมา (เช่น กดทันทีที่หน้าแอปขึ้น)
 * → ค่าเก่าที่อ่านค้างมาต้องไม่ทับค่าที่ผู้ใช้เพิ่งเลือก ทั้งบนจอและในสำเนา localStorage
 * (เดิมถูกทับชั่วครู่ ถ้ารีโหลดในจังหวะนั้นแอปกลับไปใช้ค่าเดิม — ทำ `npm run audit` ข้อ
 * "เลือกโหมดมืดแล้วรีโหลด" ล้มตอน deploy)
 *
 * ควบคุมจังหวะได้แน่นอนด้วยการจำลอง `useLive` (ค่าที่ "อ่านจาก DB") — ไม่พึ่งความเร็วของ IndexedDB จำลอง
 */

const store = vi.hoisted(() => ({
  value: undefined as unknown,
  listeners: new Set<() => void>(),
  /** true = การบันทึกค้างไว้จนกว่าเทสต์จะสั่ง `finishSaves()` */
  holdSaves: false,
  heldSaves: [] as (() => void)[],
}))

vi.mock('../db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../db')>()),
  updateSettings: vi.fn(() =>
    store.holdSaves ? new Promise<void>((resolve) => store.heldSaves.push(resolve)) : Promise.resolve(),
  ),
  useLive: () =>
    useSyncExternalStore(
      (cb) => {
        store.listeners.add(cb)
        return () => store.listeners.delete(cb)
      },
      () => store.value,
    ),
}))

/** จำลองค่าที่ liveQuery ส่งมาจาก DB (ทั้ง Provider ธีมและภาษาอ่าน field ของตัวเองจากค่านี้) */
function dbEmits(value: string) {
  act(() => {
    store.value = value
    store.listeners.forEach((l) => l())
  })
}

/** ปล่อยให้การบันทึกเสร็จทั้งหมด (ทั้งที่ค้างไว้ และที่เสร็จทันทีแต่ยังรอ microtask) — ใน IndexedDB จริง
 * การบันทึกเสร็จก่อน liveQuery จะส่งค่าใหม่ เทสต์จึงเรียกก่อนจำลองค่าที่ DB ยืนยัน */
async function finishSaves() {
  await act(async () => {
    store.heldSaves.splice(0).forEach((resolve) => resolve())
  })
}

beforeEach(() => {
  store.value = undefined
  store.holdSaves = false
  store.heldSaves = []
  localStorage.clear()
  document.documentElement.className = ''
})

function ThemeProbe() {
  const { theme, setTheme } = useTheme()
  return (
    <>
      <button onClick={() => setTheme('dark')}>theme={theme}</button>
      <button onClick={() => setTheme('light')}>light</button>
      <button onClick={() => setTheme('system')}>system</button>
    </>
  )
}

const shown = () => screen.getByRole('button', { name: /^theme=/ })

function LanguageProbe() {
  const { lang, setLanguage } = useI18n()
  return <button onClick={() => setLanguage('en')}>lang={lang}</button>
}

describe('กดเลือกก่อนค่าจาก DB มาถึง แล้วค่าเก่าจาก DB ตามมาทีหลัง', () => {
  it('ธีม: คงค่าที่เลือก → ตามค่าจาก DB เมื่อ DB บันทึกตรงกันแล้ว → ยังตามการเปลี่ยนจากที่อื่น (Restore) ได้', async () => {
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
    fireEvent.click(shown())
    expect(shown()).toHaveTextContent('theme=dark')

    dbEmits('system') // ค่าเก่าที่อ่านไว้ก่อนผู้ใช้กด
    expect(shown()).toHaveTextContent('theme=dark')
    expect(localStorage.getItem(THEME_CACHE_KEY)).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    await finishSaves()
    dbEmits('dark') // DB บันทึกค่าที่เลือกเสร็จ
    expect(shown()).toHaveTextContent('theme=dark')

    dbEmits('light') // เปลี่ยนจากที่อื่น เช่น นำข้อมูลสำรองกลับ
    expect(shown()).toHaveTextContent('theme=light')
    expect(localStorage.getItem(THEME_CACHE_KEY)).toBe('light')
  })

  it('ภาษา: คงค่าที่เลือก → ตามค่าจาก DB เมื่อ DB บันทึกตรงกันแล้ว → ยังตามการเปลี่ยนจากที่อื่นได้', async () => {
    render(<I18nProvider><LanguageProbe /></I18nProvider>)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toHaveTextContent('lang=en')

    dbEmits('th')
    expect(screen.getByRole('button')).toHaveTextContent('lang=en')
    expect(localStorage.getItem(LANGUAGE_CACHE_KEY)).toBe('en')
    expect(document.documentElement.lang).toBe('en')

    await finishSaves()
    dbEmits('en')
    dbEmits('th') // Restore ไฟล์ที่ตั้งภาษาไทย
    expect(screen.getByRole('button')).toHaveTextContent('lang=th')
    expect(localStorage.getItem(LANGUAGE_CACHE_KEY)).toBe('th')
  })

  it('เลือกค่าเดียวกับที่ DB มีอยู่แล้ว → ไม่ค้างสถานะรอ (ยังตามการเปลี่ยนจากที่อื่นได้)', async () => {
    dbEmits('dark')
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
    fireEvent.click(shown()) // เลือก dark ซึ่ง DB เป็น dark อยู่แล้ว (liveQuery ไม่ส่งค่าซ้ำ)
    await finishSaves()
    dbEmits('light')
    expect(shown()).toHaveTextContent('theme=light')
  })

  it('กดหลายครั้งเร็ว ๆ ระหว่างยังบันทึกไม่เสร็จ: ค่าเก่าใน DB ที่บังเอิญตรงกับค่าล่าสุด ไม่ทำให้จอกระพริบกลับ', async () => {
    store.holdSaves = true
    dbEmits('system')
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
    fireEvent.click(shown()) // มืด
    fireEvent.click(screen.getByRole('button', { name: 'light' }))
    fireEvent.click(screen.getByRole('button', { name: 'system' })) // = ค่าเดิมใน DB
    expect(shown()).toHaveTextContent('theme=system')

    dbEmits('dark') // ผลการบันทึกครั้งแรกไหลมาถึงทีหลัง
    expect(shown()).toHaveTextContent('theme=system')
    dbEmits('light')
    expect(shown()).toHaveTextContent('theme=system')

    await finishSaves()
    dbEmits('system')
    expect(shown()).toHaveTextContent('theme=system')
    dbEmits('dark') // หลัง DB ยืนยันแล้ว กลับมาตามการเปลี่ยนจากที่อื่นได้
    expect(shown()).toHaveTextContent('theme=dark')
  })
})
