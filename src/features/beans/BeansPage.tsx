import { useState } from 'react'
import type { MessageKey } from '../../i18n'
import { useT } from '../../i18n/I18nProvider'
import { GearSection } from '../gear/GearSection'
import { BeansSection } from './BeansSection'

const SECTIONS = [
  { id: 'beans', labelKey: 'bean.page.beans' },
  { id: 'gear', labelKey: 'bean.page.gear' },
] as const satisfies readonly { id: string; labelKey: MessageKey }[]

type SectionId = (typeof SECTIONS)[number]['id']

/** แท็บ "เมล็ด" — รวมคลังเมล็ดและอุปกรณ์ไว้ที่เดียว สลับด้วยปุ่มด้านบน */
export default function BeansPage() {
  const t = useT()
  const [section, setSection] = useState<SectionId>('beans')

  return (
    <div className="space-y-4">
      <div role="group" aria-label={t('bean.page.chooseSection')} className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-200 p-1 dark:bg-stone-800">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === section}
            onClick={() => setSection(s.id)}
            className={`min-h-12 rounded-xl text-base font-semibold transition-colors ${
              s.id === section
                ? 'bg-white text-amber-900 shadow-sm dark:bg-stone-600 dark:text-amber-300'
                : 'text-stone-600 dark:text-stone-400'
            }`}
          >
            {t(s.labelKey)}
          </button>
        ))}
      </div>

      {section === 'beans' ? <BeansSection /> : <GearSection />}
    </div>
  )
}
