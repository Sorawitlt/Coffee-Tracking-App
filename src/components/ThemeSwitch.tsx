import type { Theme } from '../domain/types'
import type { MessageKey } from '../i18n'
import { useT } from '../i18n/I18nProvider'
import { nextTheme } from '../theme/theme'
import { useTheme } from '../theme/ThemeProvider'

const ICON: Record<Theme, string> = { system: '🌓', light: '☀️', dark: '🌙' }
const NAME_KEY: Record<Theme, MessageKey> = {
  system: 'theme.system',
  light: 'theme.light',
  dark: 'theme.dark',
}

/** ปุ่มธีม — กดวน อัตโนมัติ → ตรงข้ามกับเครื่อง → เหมือนเครื่อง; ไอคอนแสดงค่าปัจจุบัน ป้ายบอกทั้งค่าปัจจุบันและค่าถัดไป */
export function ThemeSwitch() {
  const t = useT()
  const { theme, systemDark, setTheme } = useTheme()
  const next = nextTheme(theme, systemDark)
  const label = t('theme.button', { current: t(NAME_KEY[theme]), next: t(NAME_KEY[next]) })
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className="flex min-h-12 min-w-12 items-center justify-center rounded-xl text-2xl hover:bg-stone-200 dark:hover:bg-stone-800"
    >
      <span aria-hidden>{ICON[theme]}</span>
    </button>
  )
}
