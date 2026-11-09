import { LANGUAGE_NAME } from '../i18n'
import { useI18n } from '../i18n/I18nProvider'

/** ปุ่มสลับภาษา ไทย ⇄ English — กดครั้งเดียว แสดงชื่อ "อีกภาษา" (ภาษาที่จะเปลี่ยนไป) */
export function LanguageSwitch() {
  const { lang, t, setLanguage } = useI18n()
  const target = lang === 'th' ? 'en' : 'th'
  return (
    <button
      type="button"
      lang={target}
      onClick={() => setLanguage(target)}
      aria-label={t('app.language.switchTo')}
      className="flex min-h-12 min-w-12 items-center justify-center rounded-xl px-2 text-sm font-semibold text-stone-700 hover:bg-stone-200 dark:text-stone-200 dark:hover:bg-stone-800"
    >
      <span aria-hidden>🌐 {LANGUAGE_NAME[target]}</span>
    </button>
  )
}
