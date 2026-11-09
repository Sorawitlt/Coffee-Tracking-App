import type { Theme } from '../domain/types'

/**
 * ธีม (สว่าง / มืด / อัตโนมัติตามเครื่อง) — ฟังก์ชันล้วน ไม่มี React
 *
 * ตรรกะเดียวกันนี้มีสำเนาย่อใน `index.html` (สคริปต์ inline ที่รันก่อนวาดเฟรมแรก กันจอกะพริบสีขาว)
 * แก้ที่นี่ต้องแก้ที่นั่นด้วย — test `theme.test.ts` ตรวจว่าทั้งสองใช้คีย์และสีเดียวกัน
 */

export type ResolvedTheme = 'light' | 'dark'

export const THEMES: readonly Theme[] = ['system', 'light', 'dark']
export const DEFAULT_THEME: Theme = 'system'

/** สำเนาใน localStorage — ให้เปิดแอปครั้งถัดไปแสดงธีมถูกตั้งแต่เฟรมแรก (ค่าหลักอยู่ใน Settings) */
export const THEME_CACHE_KEY = 'brewlog.theme'

export const DARK_QUERY = '(prefers-color-scheme: dark)'

/** สีแถบเบราว์เซอร์/สถานะ (`<meta name="theme-color">`) ตามธีมที่แสดงจริง */
export const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#6f4e37',
  dark: '#1c1917', // = stone-900 พื้นหลังโหมดมืด
}

export function isTheme(v: unknown): v is Theme {
  return typeof v === 'string' && (THEMES as readonly string[]).includes(v)
}

export function resolveTheme(theme: Theme, systemDark: boolean): ResolvedTheme {
  if (theme === 'system') return systemDark ? 'dark' : 'light'
  return theme
}

/**
 * ลำดับเมื่อกดปุ่มธีม: อัตโนมัติ → ธีมตรงข้ามกับเครื่อง → ธีมเดียวกับเครื่อง → อัตโนมัติ
 * กดครั้งแรกจึง "เห็นการเปลี่ยน" ทันทีเสมอ ไม่ว่าเครื่องจะตั้งสว่างหรือมืด
 */
export function nextTheme(theme: Theme, systemDark: boolean): Theme {
  const system: ResolvedTheme = systemDark ? 'dark' : 'light'
  const opposite: ResolvedTheme = systemDark ? 'light' : 'dark'
  if (theme === 'system') return opposite
  if (theme === opposite) return system
  return 'system'
}

/** ใส่ธีมให้เอกสาร: class `dark` (Tailwind), `color-scheme` (ฟอร์ม/สกรอลบาร์ของเบราว์เซอร์), สีแถบเบราว์เซอร์ */
export function applyTheme(resolved: ResolvedTheme, doc: Document = document) {
  const root = doc.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved])
}

export function systemPrefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches
  } catch {
    return false
  }
}

export function readCachedTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_CACHE_KEY)
    return isTheme(v) ? v : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function cacheTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_CACHE_KEY, theme)
  } catch {
    /* โหมดส่วนตัว/ปิดที่เก็บข้อมูล: ข้ามได้ — ค่าหลักอยู่ใน IndexedDB */
  }
}
