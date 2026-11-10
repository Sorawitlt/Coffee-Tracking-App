import type { CatalogSource } from '../../domain/catalog'
import { useI18n } from '../../i18n/I18nProvider'
import { SOURCE_KIND_KEY, sourceTitle } from './catalogText'

interface Props {
  /** ชื่อรายการที่พบในฐานข้อมูล (เช่น "Geisha (Panama)") */
  name: string
  sources: readonly CatalogSource[]
}

/** บรรทัดสั้นใต้ช่องกรอก: "📚 พบในฐานข้อมูล: <ลิงก์แหล่งหลัก>" */
export function CatalogRef({ name, sources }: Props) {
  const { t, lang } = useI18n()
  const primary = sources[0]
  if (!primary) return null
  return (
    <p className="text-sm text-stone-600 dark:text-stone-400">
      <span aria-hidden>📚 </span>
      {t('catalog.ref', { name })}{' '}
      <a
        href={primary.url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-words text-amber-800 underline underline-offset-2 dark:text-amber-400"
      >
        {sourceTitle(primary, lang)}
        <span className="sr-only"> {t('catalog.newTab')}</span>
      </a>{' '}
      ({t(SOURCE_KIND_KEY[primary.kind])})
    </p>
  )
}
