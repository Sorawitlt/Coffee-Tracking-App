import type { CatalogSource } from '../../domain/catalog'
import { useI18n } from '../../i18n/I18nProvider'
import { SOURCE_KIND_KEY, sourceTitle } from './catalogText'

/** รายการแหล่งอ้างอิง (ลิงก์เปิดแท็บใหม่) พร้อมป้ายชนิดแหล่ง */
export function SourceList({ sources }: { sources: readonly CatalogSource[] }) {
  const { t, lang } = useI18n()
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm">
      {sources.map((src) => (
        <li key={src.url}>
          <a
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-words text-amber-800 underline underline-offset-2 hover:text-amber-950 dark:text-amber-400 dark:hover:text-amber-300"
          >
            {sourceTitle(src, lang)}
            <span className="sr-only"> {t('catalog.newTab')}</span>
          </a>{' '}
          <span className="whitespace-nowrap rounded-md bg-stone-100 px-1.5 py-0.5 text-xs font-medium text-stone-700 dark:bg-stone-700 dark:text-stone-200">
            {t(SOURCE_KIND_KEY[src.kind])}
          </span>
        </li>
      ))}
    </ol>
  )
}
