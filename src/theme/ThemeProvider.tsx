import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSettings, updateSettings, useLive } from '../db'
import { useSyncedChoice } from '../db/useSyncedChoice'
import type { Theme } from '../domain/types'
import {
  applyTheme,
  cacheTheme,
  DARK_QUERY,
  DEFAULT_THEME,
  readCachedTheme,
  resolveTheme,
  systemPrefersDark,
  type ResolvedTheme,
} from './theme'

export interface ThemeValue {
  /** ค่าที่ผู้ใช้เลือก */
  theme: Theme
  /** ธีมที่แสดงจริงตอนนี้ */
  resolved: ResolvedTheme
  /** เครื่อง (OS/เบราว์เซอร์) ตั้งเป็นโหมดมืดอยู่หรือไม่ */
  systemDark: boolean
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeValue>({
  theme: DEFAULT_THEME,
  resolved: 'light',
  systemDark: false,
  setTheme: () => {},
})

/**
 * ธีมเก็บใน `Settings.theme` (IndexedDB → ไปกับไฟล์สำรอง) และสำเนาใน localStorage — แบบเดียวกับภาษา (ขั้น 9)
 * โหมด "อัตโนมัติ" ตามการตั้งค่าเครื่องแบบสด (เปลี่ยนโหมดมืดของเครื่องตอนเปิดแอปอยู่ก็ตามทันที)
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [systemDark, setSystemDark] = useState(systemPrefersDark)
  const savedTheme = useLive(async () => (await getSettings()).theme)
  // ตาม DB (เช่น นำข้อมูลสำรองกลับ) แต่ค่าเก่าที่อ่านค้างมาไม่ทับค่าที่ผู้ใช้เพิ่งเลือก — ดู useSyncedChoice
  const [theme, setTheme] = useSyncedChoice(savedTheme, readCachedTheme, cacheTheme, saveTheme)

  useEffect(() => {
    let mq: MediaQueryList
    try {
      mq = window.matchMedia(DARK_QUERY)
    } catch {
      return
    }
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  const resolved = resolveTheme(theme, systemDark)
  useEffect(() => applyTheme(resolved), [resolved])

  const value = useMemo(() => ({ theme, resolved, systemDark, setTheme }), [theme, resolved, systemDark, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

const saveTheme = (theme: Theme) => updateSettings({ theme })

export function useTheme(): ThemeValue {
  return useContext(ThemeContext)
}
